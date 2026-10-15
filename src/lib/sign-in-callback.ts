// Where a Microsoft or emailed-link sign-in lands once better-auth completes it.
// The login page passes its ?redirect= (set by proxy.ts) through; anything that
// is not a same-origin path falls back to this app's own home, never to another
// app such as Talent. Protocol-relative values ("//host", "/\host") are rejected
// because browsers treat them as off-site.
export const DEFAULT_SIGN_IN_CALLBACK = "/";

export function signInCallbackURL(redirect: string | null | undefined): string {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//") || redirect.startsWith("/\\")) {
    return DEFAULT_SIGN_IN_CALLBACK;
  }
  return redirect;
}
