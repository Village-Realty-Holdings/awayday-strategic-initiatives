// Who must enrol the app's own TOTP before reaching the shell.
//
// The app requires MFA for every account, and its TOTP enrolment confirms the
// account PASSWORD first (see /setup-mfa). Two kinds of account have no
// password, so they can never complete that step and would dead-end there:
//
//   - Microsoft Entra sign-in. Entra enforces MFA on its side for the Awayday
//     tenant, so the app's TOTP would be a second factor on top of a second
//     factor. First hit on the Cloudflare build in August (Mohan, 8/5).
//   - Passwordless sign-in links (Michael, 9/11). Possession of the mailbox is
//     what authenticates a review participant; that decision is recorded in
//     magic-link-policy.ts.
//
// So the rule is: an app password is what obliges you to enrol app TOTP.
// Anyone holding a password credential must still enrol, admins included.
// Kept pure so it is testable without a session or a database.

export type AccountFacts = {
  providerId: string;
  /** Present only on the "credential" (email + password) account row. */
  password: string | null;
};

/**
 * True when this user may enter the app without the app's own TOTP enrolled,
 * because they hold no password to enrol it with. An empty list (a user with
 * no account rows at all, which is how a sign-in-link user looks before
 * better-auth writes one) is also exempt for the same reason.
 */
export function exemptFromAppTotp(accounts: AccountFacts[]): boolean {
  return !accounts.some((a) => a.password != null);
}
