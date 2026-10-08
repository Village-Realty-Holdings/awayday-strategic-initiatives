import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exemptFromAppTotp } from "@/lib/mfa-policy";
import { SetupMfaForm } from "./setup-mfa-form";

export const metadata = { title: "Set up MFA | Awayday" };

/**
 * Enrollment asks for a password only from accounts that have one.
 *
 * requireSession no longer sends a passwordless account here at all: mfa-policy
 * exempts anyone with no password to enrol with. But the page stays reachable
 * by URL, and an account that arrives here without a password used to meet a
 * password box it could never satisfy. Mohan Chandolu, 18 September: "I got the
 * OTP... and I think this is where we were going in circles."
 *
 * So the same rule decides both things, read from the account's real rows
 * rather than from anything the browser claims: no password, no password box.
 */
export default async function SetupMfaPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  // Already enrolled: nothing to set up, and leaving the page reachable would
  // let someone re-roll a working authenticator by accident.
  if (session.user.twoFactorEnabled) redirect("/apps");

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: { providerId: true, password: true },
  });

  return <SetupMfaForm needsPassword={!exemptFromAppTotp(accounts)} />;
}
