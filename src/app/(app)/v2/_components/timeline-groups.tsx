import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MOCK_TODAY } from "../_mock/data";
import { areaName, isPastDue, milestoneDateLabel, names, siByCode, siShortCode } from "../_mock/selectors";
import type { MockMilestone } from "../_mock/types";

function kindLabel(m: MockMilestone): string {
  if (m.kind === "SI_PROCESS") return "SI process";
  if (m.kind === "ALL" && m.pillar === "ALL") return "All";
  return areaName(m.pillar);
}

/** Milestones grouped by date. Presentational only (usable from server and client). */
export function TimelineGroups({
  milestones,
  doneIds,
  today = MOCK_TODAY,
}: {
  milestones: MockMilestone[];
  /** Optional client-side override of which milestones are done. */
  doneIds?: ReadonlySet<string>;
  today?: string;
}) {
  if (milestones.length === 0) {
    return <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">No milestones match these filters.</p>;
  }
  const groups = new Map<string, MockMilestone[]>();
  for (const m of milestones) {
    const list = groups.get(m.date) ?? [];
    list.push(m);
    groups.set(m.date, list);
  }
  return (
    <ol className="flex flex-col gap-3">
      {[...groups.entries()].map(([date, items]) => {
        const first = items[0];
        return (
          <li key={date} className="grid gap-2 sm:grid-cols-[6rem_1fr]">
            <p className={`tabular pt-3 text-sm font-semibold ${date < today ? "text-ink-muted" : "text-ink"}`}>{milestoneDateLabel(first)}</p>
            <ul className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface">
              {items.map((m) => {
                const done = doneIds ? doneIds.has(m.id) : m.done;
                const past = isPastDue({ ...m, done }, today);
                const si = m.siCode ? siByCode(m.siCode) : undefined;
                return (
                  <li key={m.id} className={`flex flex-col gap-1.5 px-4 py-3 ${past ? "bg-warn-soft/60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{kindLabel(m)}</Badge>
                      {past && <Badge variant="warn">Needs a status</Badge>}
                      {done && <Badge variant="ok">Done</Badge>}
                    </div>
                    <p className={`text-sm ${done ? "text-ink-muted line-through" : "text-ink"}`}>{m.title}</p>
                    <p className="text-xs text-ink-muted">
                      Owner: {names(m.ownerIds)}
                      {si && (
                        <>
                          {" · "}
                          <Link href={`/v2/si/${si.code}`} className="text-navy hover:underline">
                            {siShortCode(si.code)} {si.name}
                          </Link>
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
