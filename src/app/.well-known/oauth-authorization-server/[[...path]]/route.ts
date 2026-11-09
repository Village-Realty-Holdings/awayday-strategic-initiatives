import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

// RFC 8414 authorization server metadata. The issuer is /api/auth, so the
// spec's location is /.well-known/oauth-authorization-server/api/auth; Better
// Auth only serves it under /api/auth, hence this route. ADR 0001.
const metadata = oauthProviderAuthServerMetadata(auth);

export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const path = ((await params).path ?? []).join("/");
  if (path !== "api/auth") return new Response("Not found", { status: 404 });
  return metadata(request);
}
