// Who may be sent a passwordless sign-in link, and how their address is shown
// back to them.
//
// The magic-link plugin will happily create an account for whatever address it
// is handed. Left open, that turns the app into a way to send mail to any
// address on the internet and to litter the user table. Delivery is therefore
// restricted to existing accounts (this app is invite-only). The check is about
// DELIVERY, not about proving identity: possession of the mailbox is what
// authenticates, and that is enforced by the link itself.

export type MagicLinkFacts = {
  /** An account already exists for this address. */
  isExistingUser: boolean;
};

/**
 * Whether a sign-in link may be sent to this address. Callers give the same
 * answer either way so the endpoint cannot be used to test whether an address
 * is known.
 */
export function magicLinkAllowed(f: MagicLinkFacts): boolean {
  return f.isExistingUser;
}

/**
 * An address with its local part hidden, for "we sent a link to r•••••@…".
 * Enough for the reader to recognise their own address, not enough to learn
 * someone else's. Returns "" for anything that is not an address, so callers
 * render nothing rather than a guess.
 */
export function maskEmail(email: string): string {
  const trimmed = (email ?? "").trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return "";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  // Always at least one dot, so a one-character local part does not read as
  // though nothing was hidden.
  const dots = "•".repeat(Math.max(1, local.length - 1));
  return `${local[0]}${dots}${domain}`;
}
