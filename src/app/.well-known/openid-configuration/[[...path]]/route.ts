import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

// OpenID Connect discovery at the path-inserted location for the /api/auth
// issuer, which MCP clients try after RFC 8414. ADR 0001.
const metadata = oauthProviderOpenIdConfigMetadata(auth);

export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const path = ((await params).path ?? []).join("/");
  if (path !== "api/auth") return new Response("Not found", { status: 404 });
  return metadata(request);
}
