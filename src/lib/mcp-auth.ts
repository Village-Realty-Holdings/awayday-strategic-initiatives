import { verifyJwsAccessToken } from "better-auth/oauth2";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasApp } from "@/lib/apps";
import { rateLimit } from "@/lib/rate-limit";
import { mcpAccessFromScopes, mcpResourceUrl, oauthIssuer } from "@/lib/mcp-oauth";
import type { Actor } from "@/lib/review-edits";

// ---------------------------------------------------------------------------
// Authenticates a request to /api/mcp from its OAuth access token (ADR 0001).
//
// The token is a JWT signed by this app's own authorization server. It is
// verified in-process against the app's signing keys (auth.api.getJwks), not
// by fetching /api/auth/jwks over HTTP: a Cloudflare Worker cannot reliably
// call its own hostname. Then, on every request:
//   - the person's approval for that Claude client must still exist, so
//     disconnecting in Settings > Connected apps cuts Claude off at once
//     rather than when the 15-minute token expires;
//   - role, ban and app access are read fresh, so a change applies on the
//     next call;
//   - each connection is rate limited.
// ---------------------------------------------------------------------------

/** "read" connections see only the read-only tools. */
export type McpAccess = "read" | "write";
export type McpActor = Actor & { scope: McpAccess; clientId: string };

export type McpAuth =
  | { ok: true; actor: McpActor }
  | { ok: false; status: 401 | 403 | 429; error: string; challenge?: "missing" | "invalid_token"; retryAfterSec?: number };

/** Requests per connection per minute. Generous for an assistant, tight for a runaway loop. */
export const MCP_RATE_LIMIT = 120;

const MISSING: McpAuth = { ok: false, status: 401, error: "Sign in to connect: this endpoint needs an OAuth access token.", challenge: "missing" };
const INVALID: McpAuth = { ok: false, status: 401, error: "The access token is invalid, expired or no longer approved.", challenge: "invalid_token" };

/** Bearer token from an Authorization header, or null. */
export function bearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}

// Keyed on this module so jose's JWKS cache is shared across requests in an isolate.
const JWKS_CACHE_KEY = {};

async function verifiedClaims(token: string): Promise<Record<string, unknown> | null> {
  if (token.split(".").length !== 3) return null;
  try {
    return await verifyJwsAccessToken(token, {
      jwksFetch: async () => auth.api.getJwks(),
      jwksCacheKey: JWKS_CACHE_KEY,
      verifyOptions: {
        issuer: oauthIssuer(process.env),
        audience: mcpResourceUrl(process.env),
        requiredClaims: ["sub", "azp", "exp"],
      },
    });
  } catch {
    return null;
  }
}

export async function authenticateMcpRequest(authorization: string | null, now: Date = new Date()): Promise<McpAuth> {
  const token = bearerToken(authorization);
  if (!token) return MISSING;
  const claims = await verifiedClaims(token);
  if (!claims) return INVALID;
  // Sender-constrained (DPoP) tokens need a proof this endpoint does not check; refuse them rather than accept them as bearer.
  if (claims.cnf) return INVALID;
  const userId = typeof claims.sub === "string" ? claims.sub : null;
  const clientId = typeof claims.azp === "string" ? claims.azp : null;
  const scope = mcpAccessFromScopes(claims.scope);
  if (!userId || !clientId) return INVALID;
  if (!scope) return { ok: false, status: 403, error: "This connection was not granted access to the review." };

  const [consent, user] = await Promise.all([
    prisma.oauthConsent.findFirst({ where: { userId, clientId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, banned: true, banExpires: true, appAccess: true } }),
  ]);
  if (!consent || !user) return INVALID;
  if (user.banned && (!user.banExpires || user.banExpires > now)) return { ok: false, status: 403, error: "This account is suspended." };
  if (!hasApp(user.role, user.appAccess, "initiatives")) return { ok: false, status: 403, error: "This account does not have access to Strategic Initiatives." };

  const limit = await rateLimit(`mcp-oauth:${clientId}:${userId}`, MCP_RATE_LIMIT, 60_000);
  if (!limit.allowed) return { ok: false, status: 429, error: "Too many requests. Slow down and try again shortly.", retryAfterSec: limit.retryAfterSec };

  return { ok: true, actor: { id: user.id, name: user.name, role: user.role, scope, clientId } };
}
