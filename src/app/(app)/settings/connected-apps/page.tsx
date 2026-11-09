import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { canonicalAppUrl } from "@/lib/app-url";
import { MCP_WRITE_SCOPE } from "@/lib/mcp-oauth";
import { fmtDay, isoDay } from "@/lib/review-model";
import { ConfirmAction } from "@/components/confirm-action";
import { CopyField } from "@/components/copy-field";
import { disconnectApp } from "./actions";

// The apps (Claude) the signed-in user has connected to /api/mcp through
// OAuth, with a way to disconnect each one. ADR 0001.
export default async function ConnectedAppsPage() {
  const session = await requireSession();
  const consents = await prisma.oauthConsent.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, scopes: true, createdAt: true, updatedAt: true, oauthclient: { select: { name: true } } },
  });
  const mcpUrl = `${canonicalAppUrl()}/api/mcp`;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Connected apps</h1>
        <p className="mt-1 text-xs text-ink-muted">
          Claude can read and update exactly what you can in the app, and nothing more. Published months stay locked. Connecting
          needs a Microsoft sign-in.
        </p>
      </div>

      <section aria-labelledby="connect-claude" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
        <h2 id="connect-claude" className="text-sm font-semibold text-ink">Connect Claude</h2>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-ink">claude.ai, Claude Desktop and the mobile apps</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-ink-muted">
            <li>
              In Claude, open <strong className="text-ink">Customize → Connectors</strong>, click <strong className="text-ink">+ Add</strong>,
              then <strong className="text-ink">Add custom connector</strong>.
            </li>
            <li>
              Name it <strong className="text-ink">Awayday</strong> and paste this URL. Leave the OAuth client ID and secret empty, then
              click <strong className="text-ink">Add</strong>.
            </li>
          </ol>
          <CopyField value={mcpUrl} label="Connector URL" />
          <ol start={3} className="list-decimal space-y-1.5 pl-5 text-xs text-ink-muted">
            <li>
              Click <strong className="text-ink">Connect</strong>. Sign in with Microsoft, then choose{" "}
              <strong className="text-ink">Allow editing</strong> or <strong className="text-ink">Allow read only</strong>. The
              connection shows up below.
            </li>
          </ol>
          <p className="text-xs text-ink-muted">
            On a Team or Enterprise plan, an owner adds the connector once for the organization; each person then clicks Connect and
            signs in as themselves.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-ink">Claude Code</h3>
          <p className="text-xs text-ink-muted">Run this, then run <code className="font-mono">/mcp</code> in Claude Code and choose Authenticate.</p>
          <CopyField value={`claude mcp add --transport http awayday ${mcpUrl}`} label="Claude Code command" />
        </div>
      </section>

      <div className="rounded-xl border border-border bg-surface">
        {consents.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">No apps connected.</p>
        ) : (
          <ul className="divide-y divide-border">
            {consents.map((c) => {
              const name = c.oauthclient.name?.slice(0, 80) || "Unnamed app";
              return (
                <li key={c.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{name}</p>
                    <p className="text-xs text-ink-muted">
                      {c.scopes.includes(MCP_WRITE_SCOPE) ? "Read and update" : "Read only"} · connected {fmtDay(isoDay(c.createdAt))}
                      {c.updatedAt.getTime() !== c.createdAt.getTime() && ` · approved again ${fmtDay(isoDay(c.updatedAt))}`}
                    </p>
                  </div>
                  <ConfirmAction
                    title="Disconnect app?"
                    description={`${name} loses access straight away. You can connect it again from Claude.`}
                    confirmLabel="Disconnect"
                    action={disconnectApp}
                    fields={{ id: c.id }}
                    triggerProps={{ variant: "destructive", size: "sm" }}
                  >
                    Disconnect
                  </ConfirmAction>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
