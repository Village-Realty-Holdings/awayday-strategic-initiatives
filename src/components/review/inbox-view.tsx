import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemChecklist, type MyItem } from "./my-updates";

export type InboxSi = { id: string; shortCode: string; name: string };
export type InboxAsk = { id: string; siId: string; siLabel: string; request: string; kind: string; raisedLabel: string; open: boolean };

function Panel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Badge variant={count > 0 ? "default" : "secondary"}>{count}</Badge>
      </div>
      {children}
    </section>
  );
}

export function InboxView({
  needUpdate,
  items,
  asks,
  periodLabel,
}: {
  needUpdate: InboxSi[];
  items: MyItem[];
  asks: InboxAsk[];
  periodLabel: string;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title={`SIs needing a ${periodLabel} update`} count={needUpdate.length}>
        {needUpdate.length === 0 ? (
          <p className="text-xs text-ink-faint">All caught up.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {needUpdate.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2.5">
                <Link href={`/initiatives/${s.id}`} className="text-sm font-medium text-ink hover:text-navy-deep">
                  <span className="tabular mr-2 text-[10px] text-ink-faint">{s.shortCode}</span>
                  {s.name}
                </Link>
                <Button asChild size="xs" variant="secondary"><Link href={`/my#si-${s.id}`}>Update</Link></Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="ELT asks on my SIs" count={asks.filter((a) => a.open).length}>
        {asks.length === 0 ? (
          <p className="text-xs text-ink-faint">No asks.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {asks.map((a) => (
              <li key={a.id} className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/initiatives/${a.siId}`} className="text-xs text-navy hover:underline">{a.siLabel}</Link>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="secondary">{a.kind === "INVESTMENT" ? "Investment" : "Support"}</Badge>
                    <Badge variant={a.open ? "warn" : "ok"}>{a.open ? "Open" : "Decided"}</Badge>
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-ink">{a.request}</p>
                <p className="mt-1 text-[11px] text-ink-faint">Raised {a.raisedLabel}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="xl:col-span-2">
        <Panel title="My open milestones and action items" count={items.length}>
          {items.length === 0 ? <p className="text-xs text-ink-faint">Nothing open.</p> : <ItemChecklist title="Tick off what's done" items={items} />}
        </Panel>
      </div>
    </div>
  );
}
