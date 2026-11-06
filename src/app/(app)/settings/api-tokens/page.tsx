import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { canonicalAppUrl } from "@/lib/app-url";
import { fmtDay, isoDay } from "@/lib/review-model";
import { ApiTokenForm } from "@/components/api-token-form";
import { ConfirmAction } from "@/components/confirm-action";
import { revokeApiToken } from "./actions";

// The signed-in user's API tokens, for connecting Claude (or another MCP
// client) to the review through /api/mcp. A token can do what its owner can.
export default async function ApiTokensPage() {
  const session = await requireSession();
  const now = new Date();
  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, scope: true, expiresAt: true, lastUsedAt: true, revokedAt: true, createdAt: true },
  });
  const mcpUrl = `${canonicalAppUrl()}/api/mcp`;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">API tokens</h1>
        <p className="mt-1 text-xs text-ink-muted">
          Connect Claude to the monthly review at <code className="font-mono">{mcpUrl}</code>. A token can read and update
          exactly what you can in the app, and nothing more. Published months stay locked.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <ApiTokenForm mcpUrl={mcpUrl} />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {tokens.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">No tokens yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {tokens.map((t) => {
              const state = t.revokedAt ? "Revoked" : t.expiresAt <= now ? "Expired" : null;
              return (
                <li key={t.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {t.name} <span className="font-mono text-xs font-normal text-ink-muted">{t.prefix}…</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {t.scope === "read" ? "Read only" : "Read and update"} · created {fmtDay(isoDay(t.createdAt))} ·{" "}
                      {t.lastUsedAt ? `last used ${fmtDay(isoDay(t.lastUsedAt))}` : "never used"} ·{" "}
                      {state ?? `expires ${fmtDay(isoDay(t.expiresAt))}`}
                    </p>
                  </div>
                  {!state && (
                    <ConfirmAction
                      title="Revoke token?"
                      description={`Anything using “${t.name}” stops working straight away. This can't be undone.`}
                      confirmLabel="Revoke"
                      action={revokeApiToken}
                      fields={{ id: t.id }}
                      triggerProps={{ variant: "destructive", size: "sm" }}
                    >
                      Revoke
                    </ConfirmAction>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
