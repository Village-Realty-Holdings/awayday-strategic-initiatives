import Link from "next/link";
import { ProgressBar, StatusBadge } from "@/components/badges";
import { Check, X } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { ItemChecklist, SiUpdateDialog, type MyItem, type MySiRow } from "./my-updates";

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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div>
      <dt className="text-note text-ink-faint">{label}</dt>
      <dd className={`tabular text-lg font-semibold ${tone === "warn" ? "text-risk" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

/** How the signed-in lead is doing on this month's asks. */
function Tracker({ sis, kpis, openAsks, pastDue, periodLabel, dueLabel, locked }: { sis: MySiRow[]; kpis: { updated: number; total: number }; openAsks: number; pastDue: number; periodLabel: string; dueLabel: string | null; locked: boolean }) {
  const updated = sis.filter((s) => s.updated).length;
  const allDone = updated === sis.length;
  return (
    <section aria-label={`${periodLabel} progress`} className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">
          {allDone ? `All caught up for ${periodLabel}` : `${updated} of ${sis.length} SIs updated for ${periodLabel}`}
        </h2>
        <p className="text-xs text-ink-muted">
          {locked ? `The ${periodLabel} review is published, so its updates are final.` : `${dueLabel ? `Due ${dueLabel}. ` : ""}Saved updates appear on the review straight away.`}
        </p>
      </div>
      <div className="mt-3"><ProgressBar value={updated / sis.length} hideLabel /></div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="SIs updated" value={`${updated} / ${sis.length}`} />
        <Stat label="KPIs updated" value={kpis.total > 0 ? `${kpis.updated} / ${kpis.total}` : "None yet"} />
        <Stat label="Open ELT asks" value={String(openAsks)} />
        <Stat label="Past-due items" value={String(pastDue)} tone={pastDue > 0 ? "warn" : undefined} />
      </dl>
    </section>
  );
}

/** One row per SI: a red x until the month's update is saved, then a green check. */
function UpdateChecklist({ sis, period, asOf, locked }: { sis: MySiRow[]; period: string; asOf: string; locked: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {sis.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2.5">
          <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full ${s.updated ? "bg-ok-soft text-ok" : "bg-risk-soft text-risk"}`}>
            {s.updated ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              <Link href={`/initiatives/${s.id}`} aria-label={`Open ${s.shortCode} ${s.name}`} className="tabular mr-2 text-micro text-navy underline underline-offset-2 hover:text-navy-deep">
                {s.shortCode}
              </Link>
              {s.name}
            </p>
            <p className={`text-note ${s.updated ? "text-ok" : "text-risk"}`}>{s.updated ? "Updated" : "Needs an update"}</p>
          </div>
          {s.updated && <StatusBadge status={s.status} />}
          <SiUpdateDialog row={s} period={period} asOf={asOf} locked={locked} />
        </li>
      ))}
    </ul>
  );
}

export function InboxView({
  sis,
  kpis,
  items,
  asks,
  period,
  asOf,
  periodLabel,
  dueLabel,
  locked,
}: {
  sis: MySiRow[];
  kpis: { updated: number; total: number };
  items: MyItem[];
  asks: InboxAsk[];
  period: string;
  /** The as-of date offered when entering a KPI value. */
  asOf: string;
  periodLabel: string;
  dueLabel: string | null;
  /** The month's review is published: updates are read-only. */
  locked: boolean;
}) {
  const openAsks = asks.filter((a) => a.open).length;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {sis.length > 0 && (
        <div className="xl:col-span-2">
          <Tracker sis={sis} kpis={kpis} openAsks={openAsks} pastDue={items.filter((i) => i.pastDue).length} periodLabel={periodLabel} dueLabel={dueLabel} locked={locked} />
        </div>
      )}

      <Panel title={`My SIs for ${periodLabel}`} count={locked ? 0 : sis.filter((s) => !s.updated).length}>
        {sis.length === 0 ? <p className="text-xs text-ink-faint">You don&apos;t lead any SIs.</p> : <UpdateChecklist sis={sis} period={period} asOf={asOf} locked={locked} />}
      </Panel>

      <Panel title="ELT asks on my SIs" count={openAsks}>
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
                <p className="mt-1 text-note text-ink-faint">Raised {a.raisedLabel}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="xl:col-span-2">
        <Panel title="My milestones and action items" count={items.filter((i) => !i.done).length}>
          {items.length === 0 ? <p className="text-xs text-ink-faint">Nothing yet.</p> : <ItemChecklist title="Tick off what's done" items={items} />}
        </Panel>
      </div>
    </div>
  );
}
