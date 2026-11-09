import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifiedOAuthQuery } from "@/lib/oauth-query";
import { MCP_WRITE_SCOPE, needsEntraSignIn } from "@/lib/mcp-oauth";
import { OAuthCard, OAuthLinkExpired } from "../oauth-card";
import { ConsentButtons } from "./consent-buttons";

// Consent step of "Connect Claude" (the OAuth provider's consentPage). The
// provider sends people here once they are signed in with Microsoft. What they
// approve is recorded as an OAuth consent, listed under Settings > Connected
// apps, where it can be disconnected.
export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await verifiedOAuthQuery(await searchParams);
  if (!query) return <OAuthLinkExpired />;

  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  // The consent endpoint refuses these too (auth.ts); this just explains why.
  if (!session || needsEntraSignIn(session.session)) return <OAuthLinkExpired />;

  const clientId = query.get("client_id") ?? "";
  const client = await prisma.oauthClient.findUnique({ where: { clientId }, select: { name: true, disabled: true } });
  if (!client || client.disabled) return <OAuthLinkExpired />;

  const scopes = (query.get("scope") ?? "").split(" ").filter(Boolean);
  const wantsWrite = scopes.includes(MCP_WRITE_SCOPE);
  // Names are chosen by whoever registered the client, so show them as a claim, not a fact.
  const appName = client.name?.slice(0, 80) || "An app";

  return (
    <OAuthCard>
      <h1 className="text-lg font-semibold text-ink">Allow {appName} to use Strategic Initiatives?</h1>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        It will act as <span className="font-medium text-ink">{session.user.name}</span> ({session.user.email}) and can only do what
        you can do in the app. Published months stay locked.
      </p>
      <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 text-xs text-ink-muted">
        <li>Read initiatives, KPIs and the monthly review</li>
        {wantsWrite && <li>Update them, if you choose &ldquo;Allow editing&rdquo;</li>}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">Only continue if you started connecting Claude just now. You can disconnect it any time in Settings &gt; Connected apps.</p>
      <div className="mt-4">
        <ConsentButtons scopes={scopes} wantsWrite={wantsWrite} />
      </div>
    </OAuthCard>
  );
}
