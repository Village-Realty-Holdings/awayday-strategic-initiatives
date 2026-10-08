const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse a comma-separated recipient list (Setting value or env var),
 * whitespace-tolerant. Invalid entries are dropped, duplicates
 * (case-insensitive) collapse to one. Empty/missing input parses to [].
 */
export function parseRecipients(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const email = part.trim();
    if (!EMAIL_SHAPE.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}
