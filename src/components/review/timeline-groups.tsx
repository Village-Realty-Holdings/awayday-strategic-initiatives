import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { fmtDay, shortCode, type ReviewMilestone } from "@/lib/review-model";

/** Milestones grouped by date. Presentational only (usable from server and client). */
export function TimelineGroups({
  milestones,
  today,
  areaNames,
}: {
  milestones: ReviewMilestone[];
  today: string;
  areaNames: Record<string, string>;
}) {
  if (milestones.length === 0) {
    return <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">No milestones match these filters.</p>;
  }
  const groups = new Map<string, ReviewMilestone[]>();
  for (const m of milestones) {
    const key = m.date ?? "undated";
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return (
    <ol className="flex flex-col gap-3">
      {[...groups.entries()].map(([date, items]) => (
        <li key={date} className="grid gap-2 sm:grid-cols-[6rem_1fr]">
          <p className={`tabular pt-3 text-sm font-semibold ${date !== "undated" && date < today ? "text-ink-muted" : "text-ink"}`}>
            {date === "undated" ? "No date" : fmtDay(date)}
          </p>
          <ul className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface">
            {items.map((m) => {
              const past = Boolean(m.date && m.date < today && !m.done);
              return (
                <li key={m.id} className={`flex flex-col gap-1.5 px-4 py-3 ${past ? "bg-warn-soft/60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{areaNames[m.areaCode] ?? m.areaCode}</Badge>
                    {past && <Badge variant="warn">Needs a status</Badge>}
                    {m.done && <Badge variant="ok">Done</Badge>}
                  </div>
                  <p className={`text-sm ${m.done ? "text-ink-muted line-through" : "text-ink"}`}>{m.title}</p>
                  <p className="text-xs text-ink-muted">
                    Owner: {m.owner ?? "TBD"}
                    {" · "}
                    <Link href={`/initiatives/${m.siId}`} className="text-navy hover:underline">
                      {shortCode(m.siCode)} {m.siName}
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
