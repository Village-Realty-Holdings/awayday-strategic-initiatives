import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ACTION_ITEMS, ELT_ASKS } from "../_mock/data";
import { areaName, fmtDay, leaderGroups, names, openItemsForSi, siShortCode, snapshotFor, updateStateFor } from "../_mock/selectors";
import { SiStatusBadge, UpdateStateBadge } from "./status";

export function AsksByLeader({ periodId, compact = false }: { periodId: string; compact?: boolean }) {
  const groups = leaderGroups();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((g) => {
        const submitted = g.sis.filter((s) => updateStateFor(s.code, periodId) === "SUBMITTED").length;
        const totals = g.sis.reduce(
          (acc, s) => {
            const o = openItemsForSi(s.code);
            acc.ms += o.milestones.length;
            acc.act += o.actions.length;
            acc.asks += o.asks.length;
            return acc;
          },
          { ms: 0, act: 0, asks: 0 },
        );
        return (
          <article key={g.leaderId ?? "tbd"} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-ink">{g.leaderName}</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {g.sis.length} SI{g.sis.length === 1 ? "" : "s"} · {submitted} of {g.sis.length} updated this month
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{totals.ms} open milestones</Badge>
                <Badge variant="secondary">{totals.act} action items</Badge>
                {totals.asks > 0 && <Badge variant="default">{totals.asks} ELT asks</Badge>}
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {g.sis.map((si) => {
                const state = updateStateFor(si.code, periodId);
                const snap = snapshotFor(si.code, periodId);
                const open = openItemsForSi(si.code);
                const next = open.milestones.sort((a, b) => a.date.localeCompare(b.date))[0];
                return (
                  <li key={si.code} className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/v2/si/${si.code}`} className="text-sm font-medium text-ink hover:text-navy-deep">
                        <span className="tabular mr-2 text-[10px] text-ink-faint">{siShortCode(si.code)}</span>
                        {si.name}
                      </Link>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <SiStatusBadge status={snap.status} />
                        <UpdateStateBadge state={state} />
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-faint">{areaName(si.areaCode)}</p>
                    {!compact && (
                      <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
                        {next && (
                          <li>
                            <span className="font-medium text-ink">Next milestone:</span> {next.title} ({fmtDay(next.date)})
                          </li>
                        )}
                        {ACTION_ITEMS.filter((a) => a.siCode === si.code && !a.done).map((a) => (
                          <li key={a.id}>
                            <span className="font-medium text-ink">Action:</span> {a.text} (due {fmtDay(a.due)})
                          </li>
                        ))}
                        {ELT_ASKS.filter((a) => a.siCode === si.code && a.open).map((a) => (
                          <li key={a.id}>
                            <span className="font-medium text-ink">Ask from {names([a.fromId])}:</span> {a.text}
                          </li>
                        ))}
                        {!next && open.actions.length === 0 && open.asks.length === 0 && <li className="text-ink-faint">No open items.</li>}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
