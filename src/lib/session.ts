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

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
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

/**
 * Gate an application by per-user entitlement. Call at the top of each app's
 * entry surfaces. Admins always pass; otherwise the user must be granted the
 * app (User.appAccess). Not entitled → bounce to the launcher.
 */
export async function requireApp(app: AppKey) {
  const session = await requireSession();
  const u = await getSessionUserRow(session.user.id);
  if (!hasApp(u?.role ?? session.user.role, u?.appAccess, app)) redirect("/apps");
  return session;
}
