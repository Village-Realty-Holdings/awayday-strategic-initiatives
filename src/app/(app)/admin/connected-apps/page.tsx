import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { MCP_WRITE_SCOPE } from "@/lib/mcp-oauth";
import { fmtDay, isoDay } from "@/lib/review-model";
import { ConfirmAction } from "@/components/confirm-action";
import { adminDisconnectAllForUser, adminDisconnectApp } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connected apps · Awayday" };

const LIMIT = 500;

// Admin: every MCP OAuth connection (Claude) across all users, with
// disconnect per app or per person. ADR 0001.
export default async function AdminConnectedAppsPage() {
  await requireAdmin();
  const [consents, total] = await Promise.all([
    prisma.oauthConsent.findMany({
      where: { userId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        scopes: true,
        createdAt: true,
        updatedAt: true,
        oauthclient: { select: { name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.oauthConsent.count({ where: { userId: { not: null } } }),
  ]);
  const people = new Set(consents.map((c) => c.user?.id)).size;

  return (
    <div className="flex w-full flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Connected apps</h1>
        <p className="mt-1 text-xs text-ink-muted">
          Apps (Claude) people have connected to Strategic Initiatives. Each acts only as its person, with their role and access.
          Disconnecting cuts the app off on its next request; the person can connect again from Claude, unless their access is
          removed. {total} connection{total === 1 ? "" : "s"} across {people} {people === 1 ? "person" : "people"}
          {total > LIMIT && ` (showing the ${LIMIT} most recent)`}.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {consents.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">No apps connected.</p>
        ) : (
          <ul className="divide-y divide-border">
            {consents.map((c) => {
              const app = c.oauthclient.name?.slice(0, 80) || "Unnamed app";
              const who = c.user?.name ?? "Unknown user";
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {who} <span className="font-normal text-ink-muted">· {app}</span>
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {c.user?.email} · {c.scopes.includes(MCP_WRITE_SCOPE) ? "Read and update" : "Read only"} · connected{" "}
                      {fmtDay(isoDay(c.createdAt))}
                      {c.updatedAt.getTime() !== c.createdAt.getTime() && ` · approved again ${fmtDay(isoDay(c.updatedAt))}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <ConfirmAction
                      title="Disconnect app?"
                      description={`${app} loses access to ${who}'s account straight away.`}
                      confirmLabel="Disconnect"
                      action={adminDisconnectApp}
                      fields={{ id: c.id }}
                      triggerProps={{ variant: "destructive", size: "sm" }}
                    >
                      Disconnect
                    </ConfirmAction>
                    {c.user && (
                      <ConfirmAction
                        title={`Disconnect all of ${who}'s apps?`}
                        description="Every app they have connected loses access straight away."
                        confirmLabel="Disconnect all"
                        action={adminDisconnectAllForUser}
                        fields={{ userId: c.user.id }}
                        triggerProps={{ variant: "secondary", size: "sm" }}
                      >
                        All for this person
                      </ConfirmAction>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
