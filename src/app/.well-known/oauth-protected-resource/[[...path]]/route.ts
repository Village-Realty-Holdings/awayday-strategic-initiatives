import { protectedResourceMetadata } from "@/lib/mcp-oauth";

// RFC 9728 protected resource metadata for /api/mcp, at the path-inserted
// location (/.well-known/oauth-protected-resource/api/mcp) the 401 challenge
// points to, and at the root for clients that look there. It names this app's
// own authorization server (ADR 0001).
export async function GET(_request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const path = ((await params).path ?? []).join("/");
  if (path !== "" && path !== "api/mcp") return new Response("Not found", { status: 404 });
  return Response.json(protectedResourceMetadata(process.env), {
    headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
