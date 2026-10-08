import { createHash } from "node:crypto";

// Rate-limit keys live in the Setting table, readable to anyone with database
// access. A raw seller token there is a working portal credential, so keys
// carry a hash of it instead (security review, 28 September 2026). 32 hex
// characters (128 bits) keeps buckets distinct without storing the token.

/** The part of a rate-limit key that stands for a bearer token. */
export function tokenKeyPart(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}
