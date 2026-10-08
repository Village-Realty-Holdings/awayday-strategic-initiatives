"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { APPS } from "@/lib/apps";
import { sendEmail, emailConfigured } from "@/lib/email";
import { canonicalAppUrl } from "@/lib/app-url";
import { buildPlatformInviteEmail } from "@/lib/invite-email";
import { audit } from "@/lib/audit";
import {
  AI_BUDGET_KEY,
  AI_BUDGET_RECIPIENTS_KEY,
  AI_BUDGET_ALERT_KEY_PREFIX,
  getAiBudgetUsd,
  monthWindow,
  parseBudgetInput,
  parseRecipientsInput,
} from "@/lib/ai-budget";

export type AdminResult = { ok: true; message: string; tempPassword?: string } | { ok: false; error: string };

const ROLES = ["admin", "editor", "user"] as const;
type Role = (typeof ROLES)[number];

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
const plain = (o: unknown) => JSON.parse(JSON.stringify(o));

async function hash(password: string): Promise<string> {
  const ctx = await auth.$context;
  return ctx.password.hash(password);
}

// 12 base64url chars of Web Crypto randomness plus a fixed suffix that satisfies
// common complexity rules (Web Crypto rather than node:crypto: runs on Workers).
function generatedPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
  return b64 + "aA1!";
}

export async function adminCreateUser(fd: FormData): Promise<AdminResult> {
  const session = await requireSession({ role: "admin" });
  const email = s(fd, "email").toLowerCase();
  const name = s(fd, "name") || email;
  const role = (ROLES.includes(s(fd, "role") as Role) ? s(fd, "role") : "user") as Role;
  // Blank password = auto-generate and email the credentials (Michael 8/13:
  // admins add people without a developer or an out-of-band password handoff).
  const typedPassword = s(fd, "password");
  const password = typedPassword || generatedPassword();
  // App access chosen at grant time. Least-privilege: grant ONLY what was
  // selected (no fallback to all apps). A user created with none simply has no
  // app access until an admin grants it; the launcher handles that state.
  const appAccess = fd.getAll("apps").map(String).filter((a) => (APP_KEYS as readonly string[]).includes(a));

  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (typedPassword && typedPassword.length < 12) return { ok: false, error: "Password must be at least 12 characters." };
  if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "A user with that email already exists." };

  const id = crypto.randomUUID();
  await prisma.user.create({ data: { id, email, name, emailVerified: true, role, appAccess } });
  await prisma.account.create({
    data: { id: crypto.randomUUID(), userId: id, accountId: id, providerId: "credential", password: await hash(password) },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", entity: "User", entityId: id, after: plain({ email, name, role, appAccess }) },
  });
  revalidatePath("/admin");
  revalidatePath("/people");

  const granted = `${role}, apps: ${appAccess.join(", ") || "none"}`;
  // Admin typed the password themselves: they'll share it their own way.
  if (typedPassword) return { ok: true, message: `Created ${email} (${granted}). They set up MFA on first login.` };

  // Auto-generated: email the credentials; if that can't happen, show the
  // password once so the invite is never lost.
  if (emailConfigured()) {
    const appNames = APPS.filter((a) => appAccess.includes(a.key) || role === "admin").map((a) => a.name);
    const mail = buildPlatformInviteEmail({
      name,
      email,
      tempPassword: password,
      appUrl: canonicalAppUrl((await headers()).get("host")),
      appNames,
    });
    const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text, replyTo: session.user.email });
    if (sent.ok) return { ok: true, message: `Created ${email} (${granted}). Their login details were emailed to them; they set up MFA on first login.` };
  }
  return {
    ok: true,
    tempPassword: password,
    message: `Created ${email} (${granted}), but the credentials email could not be sent. Share this temporary password with them securely; it is shown only once: ${password}`,
  };
}

// Derived from the app registry, never hand-listed. A hardcoded pair here
// silently dropped "nps" from every submitted set, so granting a user Talent
// wiped their eNPS access (cost the client's HRBP her access on 2026-07-29).
// Dark-launched apps are included on purpose: entitlement is exactly how a
// hidden module is reached.
const APP_KEYS = APPS.map((a) => a.key);

// Grant/revoke which applications a user can open from the launcher. Admins are
// never restricted (they always have all apps), so this targets non-admin users.
export async function adminSetAppAccess(fd: FormData): Promise<AdminResult> {
  const session = await requireSession({ role: "admin" });
  const id = s(fd, "id");
  const apps = fd.getAll("apps").map(String).filter((a) => (APP_KEYS as readonly string[]).includes(a));
  const before = await prisma.user.findUnique({ where: { id }, select: { appAccess: true, email: true } });
  if (!before) return { ok: false, error: "User not found." };
  await prisma.user.update({ where: { id }, data: { appAccess: apps } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "User", entityId: id, before: plain({ appAccess: before.appAccess }), after: plain({ appAccess: apps }) },
  });
  revalidatePath("/admin");
  revalidatePath("/people");
  return { ok: true, message: `Updated app access for ${before.email}: ${apps.length ? apps.join(", ") : "none"}.` };
}

export async function adminSetRole(fd: FormData): Promise<AdminResult> {
  const session = await requireSession({ role: "admin" });
  const id = s(fd, "id");
  const role = s(fd, "role") as Role;
  if (!ROLES.includes(role)) return { ok: false, error: "Unknown role." };
  if (id === session.user.id) return { ok: false, error: "You can't change your own role (avoids locking yourself out)." };

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "User not found." };
  await prisma.user.update({ where: { id }, data: { role } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "User", entityId: id, before: plain({ role: before.role }), after: plain({ role }) },
  });
  revalidatePath("/admin");
  revalidatePath("/people");
  return { ok: true, message: `Updated ${before.email} to ${role}.` };
}

export async function adminSetPassword(fd: FormData): Promise<AdminResult> {
  const session = await requireSession({ role: "admin" });
  const id = s(fd, "id");
  const password = s(fd, "password");
  if (password.length < 12) return { ok: false, error: "Password must be at least 12 characters." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false, error: "User not found." };
  const acct = await prisma.account.findFirst({ where: { userId: id, providerId: "credential" } });
  const data = { password: await hash(password) };
  if (acct) await prisma.account.update({ where: { id: acct.id }, data });
  else await prisma.account.create({ data: { id: crypto.randomUUID(), userId: id, accountId: id, providerId: "credential", ...data } });

  await prisma.session.deleteMany({ where: { userId: id } }); // force re-login with the new password
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "User", entityId: id, after: plain({ passwordReset: true }) },
  });
  revalidatePath("/admin");
  revalidatePath("/people");
  return { ok: true, message: `Password reset for ${user.email}. Their existing sessions were signed out.` };
}

export async function adminResetMfa(fd: FormData): Promise<AdminResult> {
  const session = await requireSession({ role: "admin" });
  const id = s(fd, "id");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false, error: "User not found." };

  await prisma.twoFactor.deleteMany({ where: { userId: id } });
  await prisma.user.update({ where: { id }, data: { twoFactorEnabled: false } });
  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "User", entityId: id, after: plain({ mfaReset: true }) },
  });
  revalidatePath("/admin");
  revalidatePath("/people");
  return { ok: true, message: `MFA reset for ${user.email}. They'll set up a new authenticator on next login.` };
}

export async function adminRemoveUser(fd: FormData): Promise<AdminResult> {
  const session = await requireSession({ role: "admin" });
  const id = s(fd, "id");
  if (id === session.user.id) return { ok: false, error: "You can't delete your own account." };
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false, error: "User not found." };

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: id } }),
    prisma.account.deleteMany({ where: { userId: id } }),
    prisma.twoFactor.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", entity: "User", entityId: id, before: plain({ email: user.email, role: user.role }) },
  });
  revalidatePath("/admin");
  revalidatePath("/people");
  return { ok: true, message: `Removed ${user.email}.` };
}

// ── AI spend guardrail settings (/admin/ai-telemetry) ───────────────────────
// Both live in the Setting table (src/lib/ai-budget.ts). Admin only; every
// change is audit-logged with before/after.

/**
 * Set the monthly AI budget. A number caps spend for the month, "0" / "off"
 * removes the cap, blank clears the override so env / default applies again.
 * Changing the budget also resets this month's 80% / 100% alert dedupe keys,
 * so the thresholds re-arm against the new figure (raising the budget after a
 * 100% alert would otherwise never alert again this month).
 */
export async function adminSetAiBudget(fd: FormData): Promise<AdminResult> {
  const session = await requireSession({ role: "admin" });
  const parsed = parseBudgetInput(s(fd, "budget"));
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const before = await prisma.setting.findUnique({ where: { key: AI_BUDGET_KEY } });
  if (parsed.store == null) {
    if (before) await prisma.setting.delete({ where: { key: AI_BUDGET_KEY } });
  } else {
    await prisma.setting.upsert({
      where: { key: AI_BUDGET_KEY },
      update: { value: parsed.store },
      create: { key: AI_BUDGET_KEY, value: parsed.store },
    });
  }
  const month = monthWindow().label;
  const rearmed = await prisma.setting.deleteMany({ where: { key: { startsWith: `${AI_BUDGET_ALERT_KEY_PREFIX}.${month}.` } } });
  const effective = await getAiBudgetUsd();
  await audit(session.user.id, "UPDATE", "Setting", AI_BUDGET_KEY, {
    before: { value: before?.value ?? null },
    after: { value: parsed.store, effectiveBudgetUsd: effective, alertsRearmed: rearmed.count },
  });
  revalidatePath("/admin/ai-telemetry");

  if (effective == null) return { ok: true, message: "Monthly AI budget removed. AI spend is uncapped until a budget is set." };
  if (parsed.store == null) return { ok: true, message: `Override cleared. The effective monthly AI budget is $${effective.toFixed(2)} (environment or default).` };
  return { ok: true, message: `Monthly AI budget set to $${effective.toFixed(2)}. Alerts at 80% and 100% are re-armed for ${month}.` };
}

/** Set who receives the 80% / 100% budget alert emails (comma-separated). Empty is allowed. */
export async function adminSetAiBudgetRecipients(fd: FormData): Promise<AdminResult> {
  const session = await requireSession({ role: "admin" });
  const parsed = parseRecipientsInput(s(fd, "recipients").slice(0, 2000));
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const before = await prisma.setting.findUnique({ where: { key: AI_BUDGET_RECIPIENTS_KEY } });
  await prisma.setting.upsert({
    where: { key: AI_BUDGET_RECIPIENTS_KEY },
    update: { value: parsed.store },
    create: { key: AI_BUDGET_RECIPIENTS_KEY, value: parsed.store },
  });
  await audit(session.user.id, "UPDATE", "Setting", AI_BUDGET_RECIPIENTS_KEY, {
    before: { value: before?.value ?? null },
    after: { value: parsed.store, recipients: parsed.list },
  });
  revalidatePath("/admin/ai-telemetry");
  return {
    ok: true,
    message:
      parsed.list.length === 0
        ? "Recipient list cleared. Budget alerts go to the AI_BUDGET_ALERT_TO environment value if one is set, otherwise nobody."
        : `Saved. Budget alerts go to ${parsed.list.length} ${parsed.list.length === 1 ? "recipient" : "recipients"}.`,
  };
}
