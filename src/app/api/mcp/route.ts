import { authenticateToken } from "@/lib/api-tokens";
import { handleMcpMessage, PARSE_ERROR, rpcError } from "@/lib/mcp";
import { buildTrustedOrigins } from "@/lib/trusted-origins";

// MCP endpoint (Streamable HTTP, stateless). Authenticated by a personal API
// token from Settings > API tokens, sent as `Authorization: Bearer asi_…`.
// It sits outside the cookie gate in proxy.ts: a token, not a session, is the
// credential here, and authenticateToken checks it on every request.

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

  const auth = await authenticateToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const headers: Record<string, string> = {};
    if (auth.status === 401) headers["WWW-Authenticate"] = 'Bearer realm="awayday", error="invalid_token"';
    if (auth.retryAfterSec) headers["Retry-After"] = String(auth.retryAfterSec);
    return json({ error: auth.error }, auth.status, headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(rpcError(null, PARSE_ERROR, "Parse error: the body is not JSON."), 400);
  }
  const reply = await handleMcpMessage(body, auth.actor);
  if (reply === null) return new Response(null, { status: 202, headers: NO_STORE });
  return json(reply);
}

// Stateless server: no server-to-client stream and no session to end.
function methodNotAllowed() {
  return new Response("Method not allowed. POST JSON-RPC messages to this endpoint.", { status: 405, headers: { Allow: "POST", ...NO_STORE } });
}
export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
