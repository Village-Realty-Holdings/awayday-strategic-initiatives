// Mail scanners consume single-use sign-in links.
//
// Alex Bevington, 18 September: "request a link via email, click the emailed
// link, it takes me back to the same page I started on". The session table said
// why. Two sessions were created for his account that morning, a minute apart,
// from a Linux browser on an AWS address, while every real session he has ever
// had is Windows from his own IP. A mail security scanner had followed the link
// on delivery, spent the one-time token, and taken the session for itself. By
// the time he clicked, the token was gone and he was bounced to the login page.
//
// That is not a bug in the link. It is what happens when a GET both proves
// possession of a mailbox and burns a credential, and anything in the mail path
// is allowed to make GETs. Awayday's mail runs through Proofpoint, so this
// would eventually have hit everyone, not just Alex.
//
// So the emailed link no longer points at the verify endpoint. It points at a
// confirm page that carries a button, and the button POSTs. Scanners fetch
// pages; they do not submit forms. The token is spent by a person, once.
//
// Two rules hold this together and are worth keeping:
//   1. The confirm page must never auto-navigate. No redirect, no meta refresh,
//      no onload script. Every one of those is something a scanner will follow.
//   2. The target must be checked before we send anyone to it, or the confirm
//      page becomes an open redirect wearing our own domain.

/** The only path a confirm target is ever allowed to point at. */
const VERIFY_PATH = "/api/auth/magic-link/verify";

/**
 * The URL we email: our confirm page, carrying the real verify URL.
 *
 * Returns the original URL unchanged if it cannot be parsed, so a change in the
 * auth library's URL shape degrades to today's behaviour rather than emailing
 * a broken link.
 */
export function confirmLinkFor(verifyUrl: string, baseUrl: string): string {
  try {
    new URL(verifyUrl);
  } catch {
    return verifyUrl;
  }
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/login/confirm?to=${encodeURIComponent(verifyUrl)}`;
}

/**
 * Validate a confirm target before redirecting to it.
 *
 * Same origin as the app and on the verify path, or nothing. An attacker who
 * can get someone to open our domain must not be able to choose where they
 * land next.
 */
export function safeVerifyTarget(to: string | null | undefined, baseUrl: string): string | null {
  if (!to) return null;
  let target: URL;
  let base: URL;
  try {
    target = new URL(to);
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  if (target.origin !== base.origin) return null;
  if (target.pathname !== VERIFY_PATH) return null;
  return target.toString();
}
