import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exemptFromAppTotp } from "@/lib/mfa-policy";
import { hasApp, type AppKey } from "@/lib/apps";
import { devAuthEmail } from "@/lib/dev-auth";

// Per-request memoized user row (role + app entitlement). React's cache() dedupes
// repeated calls within a single request, so the app layout and requireApp (and
// any other caller) don't each issue their own query (#15).
export const getSessionUserRow = cache(async (userId: string) => {
  return prisma.user.findUnique({ where: { id: userId }, select: { role: true, appAccess: true } });
});

const mfaExempt = cache(async (userId: string): Promise<boolean> => {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { providerId: true, password: true },
  });
  return exemptFromAppTotp(accounts);
});

// Per-request memoized session lookup. The app layout and the page (and any
// helper) each call requireSession, so without this every render validated the
// session more than once. Keyed on nothing: one lookup per request.
//
// disableRefresh: a page render can't set cookies, so a refresh here would
// extend the session in the DB while the browser cookie kept its old expiry,
// and the day's refresh would be used up. Renewal happens in SessionKeepalive's
// call to /api/auth/get-session, a route handler that can write the cookie.
const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } }),
);

type RequireOptions = {
  /** Require completed MFA enrollment (default true). Set false only for the MFA setup flow. */
  requireMFA?: boolean;
  /** Require a specific role (e.g. "admin"). */
  role?: "admin";
};

/**
 * The single authorization choke point. Call this at the top of every server
 * component, server action, and route handler that touches protected data —
 * never trust a parent layout's redirect to protect a sibling handler.
 */
export async function requireSession(options: RequireOptions = {}) {
  const { requireMFA = true, role } = options;

  // Local review only, and it grants nothing: the named user's REAL row is
  // loaded, so their actual role, entitlements and shop scoping apply. It
  // skips proving you are that person, not the permissions of being them.
  // Unreachable on any deployment; see lib/dev-auth.ts for the three guards.
  const devEmail = devAuthEmail();
  if (devEmail !== null) {
    const dev = await prisma.user.findUnique({
      where: { email: devEmail },
      select: { id: true, name: true, email: true, role: true },
    });
    // Fail closed: naming a user who does not exist logs in as nobody.
    if (!dev) redirect("/login");
    const devSession = {
      user: { ...dev, twoFactorEnabled: true },
    } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>;
    if (role && dev.role !== role) redirect("/");
    return devSession!;
  }

  const session = await getSession();
  if (!session) {
    // The proxy only sees that a cookie exists; an expired or revoked session
    // lands here. Keep the page so sign-in can return to it.
    const from = (await headers()).get("x-pathname");
    redirect(from && from !== "/" ? `/login?redirect=${encodeURIComponent(from)}` : "/login");
  }
  // App TOTP is required unless the account holds no password to enrol it with
  // (Entra SSO, sign-in link); see mfa-policy.ts. The account lookup only runs
  // for users who are not yet enrolled, so enrolled password users pay nothing.
  if (requireMFA && !session.user.twoFactorEnabled && !(await mfaExempt(session.user.id))) {
    redirect("/setup-mfa");
  }
  if (role && session.user.role !== role) redirect("/");
  return session;
}

/** Write access: admins and editors can modify; viewers are read-only. */
export function canEdit(role?: string | null): boolean {
  return role === "admin" || role === "editor";
}

/** Require an authenticated, MFA'd session with write access, or redirect home. */
export async function requireEditor() {
  const session = await requireSession();
  if (!canEdit(session.user.role)) redirect("/");
  return session;
}

/** Require an authenticated, MFA'd admin session, or redirect home. */
export async function requireAdmin() {
  return requireSession({ role: "admin" });
}

/**
 * Gate an application by per-user entitlement. Call at the top of each app's
 * entry surfaces. Admins always pass; otherwise the user must be granted the
 * app (User.appAccess). Not entitled → /no-access.
 */
export async function requireApp(app: AppKey) {
  const session = await requireSession();
  const u = await getSessionUserRow(session.user.id);
  if (!hasApp(u?.role ?? session.user.role, u?.appAccess, app)) redirect("/no-access");
  return session;
}
