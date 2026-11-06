import { prisma } from "@/lib/prisma";
import { hasApp } from "@/lib/apps";
import { rateLimit } from "@/lib/rate-limit";
import type { Actor } from "@/lib/review-edits";

// ---------------------------------------------------------------------------
// Personal API tokens for the MCP endpoint. A token is "asi_" + 32 random
// bytes (base64url). Only its SHA-256 hash is stored, so a database leak gives
// out nothing usable, and the token is shown once, when created.
//
// A token carries no permissions of its own: every request loads the user's
// role, ban and app access fresh from the database, so a role change, a ban or
// removed access applies on the very next call. "read" tokens are further
// limited to the read-only tools.
// ---------------------------------------------------------------------------

export const TOKEN_PREFIX = "asi_";
export const TOKEN_SCOPES = ["read", "write"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];
export const TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;
export const MAX_ACTIVE_TOKENS = 10;
/** Requests per token per minute. Generous for an assistant, tight for a runaway loop. */
export const TOKEN_RATE_LIMIT = 120;

const TOKEN_PATTERN = /^asi_[A-Za-z0-9_-]{43}$/;

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A new random token (Web Crypto, so it runs the same on Node and Workers). */
export function generateToken(): string {
  return TOKEN_PREFIX + base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** Hex SHA-256 of the token: what is stored and looked up. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** What the token list shows: "asi_Ab12Cd34…". */
export function tokenPrefix(token: string): string {
  return token.slice(0, TOKEN_PREFIX.length + 8);
}

export function parseScope(raw: string | null | undefined): TokenScope {
  return raw === "read" ? "read" : "write";
}

export type TokenActor = Actor & { scope: TokenScope; tokenId: string };

export type TokenAuth =
  | { ok: true; actor: TokenActor }
  | { ok: false; status: 401 | 403 | 429; error: string; retryAfterSec?: number };

const INVALID: TokenAuth = { ok: false, status: 401, error: "Missing, invalid, expired or revoked API token." };

/** Bearer token from an Authorization header, or null. */
export function bearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}

/**
 * Authenticate an API request from its Authorization header. Expired, revoked
 * and unknown tokens all get the same 401 so the response says nothing about
 * which tokens exist.
 */
export async function authenticateToken(authorization: string | null, now: Date = new Date()): Promise<TokenAuth> {
  const token = bearerToken(authorization);
  if (!token || !TOKEN_PATTERN.test(token)) return INVALID;
  const row = await prisma.apiToken.findUnique({
    where: { hash: await hashToken(token) },
    select: {
      id: true,
      scope: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      user: { select: { id: true, name: true, role: true, banned: true, banExpires: true, appAccess: true } },
    },
  });
  if (!row || row.revokedAt || row.expiresAt <= now) return INVALID;
  const { user } = row;
  if (user.banned && (!user.banExpires || user.banExpires > now)) return { ok: false, status: 403, error: "This account is suspended." };
  if (!hasApp(user.role, user.appAccess, "initiatives")) return { ok: false, status: 403, error: "This account does not have access to Strategic Initiatives." };

  const limit = await rateLimit(`api-token:${row.id}`, TOKEN_RATE_LIMIT, 60_000);
  if (!limit.allowed) return { ok: false, status: 429, error: "Too many requests for this token. Slow down and try again shortly.", retryAfterSec: limit.retryAfterSec };

  // At most one write a minute per token, not one per request.
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > 60_000) {
    await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  }
  return { ok: true, actor: { id: user.id, name: user.name, role: user.role, scope: parseScope(row.scope), tokenId: row.id } };
}
