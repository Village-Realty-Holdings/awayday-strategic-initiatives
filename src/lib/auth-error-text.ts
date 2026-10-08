// Codes better-auth appends as ?error= when an OAuth round trip fails
// (onAPIError.errorURL in auth.ts), mapped to plain English for the login page.
// Lives outside the page file because Next only allows its own exports there.
const AUTH_ERROR_TEXT: Record<string, string> = {
  state_mismatch: "That sign-in attempt expired or started on a different address. Please try again from this page.",
  invalid_code: "Microsoft accepted the sign-in but the app could not complete it. Please try again; if it repeats, the app's Microsoft configuration needs checking.",
  unable_to_get_user_info: "Microsoft did not return a usable profile for this account.",
  email_not_found: "Your Microsoft account did not share an email address, so the app cannot match it to a user.",
  unable_to_link_account: "This Microsoft account could not be linked to your existing user. Sign in with the email link instead and tell Michael.",
  "email_doesn't_match": "The Microsoft account's email does not match the account you are signed in as.",
};

export function authErrorText(code: string | undefined): string {
  if (!code) return "";
  return AUTH_ERROR_TEXT[code] ?? `Sign-in failed (${code}).`;
}

