import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { canonicalAppUrl } from "@/lib/app-url";
import { MCP_WRITE_SCOPE } from "@/lib/mcp-oauth";
import { fmtDay, isoDay } from "@/lib/review-model";
import { ConfirmAction } from "@/components/confirm-action";
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
          To connect Claude, add a custom connector with the URL <code className="font-mono">{mcpUrl}</code>. Claude sends you here to
          sign in with Microsoft and approve it. It can then read and update exactly what you can in the app, and nothing more.
          Published months stay locked.
        </p>
      </div>

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
