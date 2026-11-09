import { authenticateMcpRequest } from "@/lib/mcp-auth";
import { handleMcpMessage, PARSE_ERROR, rpcError } from "@/lib/mcp";
import { bearerChallenge } from "@/lib/mcp-oauth";
import { buildTrustedOrigins } from "@/lib/trusted-origins";

// MCP endpoint (Streamable HTTP; MCP 2026-07-28, with the 2025 handshake for
// older clients). Authenticated by an OAuth access token from the app's own
// authorization server (ADR 0001): add the server in Claude by URL, and Claude
// discovers the OAuth endpoints from the 401 below and walks the person
// through Microsoft sign-in and consent.
// It sits outside the cookie gate in proxy.ts: a token, not a session, is the
// credential here, and authenticateMcpRequest checks it on every request.

const NO_STORE = { "Cache-Control": "no-store" };
const trustedOrigins = buildTrustedOrigins(process.env);

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export async function POST(request: Request) {
  // The spec asks servers to check Origin against DNS rebinding. MCP clients
  // don't send one; a browser page on another site does.
  const origin = request.headers.get("origin");
  if (origin && !trustedOrigins.includes(origin)) return json({ error: "Origin not allowed." }, 403);

  const auth = await authenticateMcpRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    const headers: Record<string, string> = {};
    // RFC 9728: point the client at the protected resource metadata so it can start OAuth.
    if (auth.status === 401) headers["WWW-Authenticate"] = bearerChallenge(process.env, auth.challenge === "invalid_token" ? "invalid_token" : undefined);
    if (auth.retryAfterSec) headers["Retry-After"] = String(auth.retryAfterSec);
    return json({ error: auth.error }, auth.status, headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(rpcError(null, PARSE_ERROR, "Parse error: the body is not JSON."), 400);
  }
  const reply = await handleMcpMessage(body, request.headers, auth.actor);
  if (!reply.body) return new Response(null, { status: reply.status, headers: NO_STORE });
  return json(reply.body, reply.status);
}

// No server-to-client stream (subscriptions/listen is not offered) and no session to end.
function methodNotAllowed() {
  return new Response("Method not allowed. POST JSON-RPC messages to this endpoint.", { status: 405, headers: { Allow: "POST", ...NO_STORE } });
}
export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
