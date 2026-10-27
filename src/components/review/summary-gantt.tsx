import Link from "next/link";
import { daysBetween, fmtDay, shortCode, type ReviewMilestone } from "@/lib/review-model";

const WINDOW_DAYS = 60;

/** Milestones due in the next 60 days, placed on a today → +60 days track. */
export function SummaryGantt({ milestones, today }: { milestones: ReviewMilestone[]; today: string }) {
  const visible = milestones.slice(0, 12);
  if (milestones.length === 0) {
    return <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">No milestones due in the next 60 days.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="grid grid-cols-[minmax(13rem,1fr)_minmax(20rem,2fr)] border-b border-border bg-surface-2/40 px-4 py-2 text-[11px] font-medium text-ink-faint">
        <span>Strategic initiative / milestone</span>
        <div className="relative flex justify-between">
          <span>Today</span>
          <span>+30 days</span>
          <span>+60 days</span>
        </div>
      </div>
      <div className="divide-y divide-border/70">
        {visible.map((m) => {
          const left = m.date ? Math.max(0, Math.min(95, (daysBetween(today, m.date) / WINDOW_DAYS) * 100)) : 0;
          const past = Boolean(m.date && m.date < today && !m.done);
          return (
            <div key={m.id} className={`grid grid-cols-[minmax(13rem,1fr)_minmax(20rem,2fr)] items-center gap-3 px-4 py-2.5 ${past ? "bg-warn-soft/60" : ""}`}>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-ink">{m.title}</p>
                <p className="truncate text-[11px] text-ink-faint">
                  <Link href={`/initiatives/${m.siId}`} className="hover:text-navy hover:underline">
                    {shortCode(m.siCode)} {m.siName}
                  </Link>{" "}
                  · {fmtDay(m.date)}
                  {m.owner ? ` · ${m.owner}` : ""}
                </p>
              </div>
              <div className="relative h-6 rounded bg-surface-2">
                <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-border-strong" aria-hidden />
                <span className="absolute inset-y-0 right-0 border-l border-border/70" aria-hidden />
                <span
                  className={`absolute top-1/2 h-2.5 w-[5%] -translate-y-1/2 rounded-full ${m.done ? "bg-ok" : past ? "bg-warn" : "bg-navy"}`}
                  style={{ left: `${left}%` }}
                  aria-label={m.done ? "Done milestone" : past ? "Passed milestone that needs a status" : "Open milestone"}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border bg-surface-2/30 px-4 py-2 text-[11px] text-ink-faint">
        {milestones.length} milestone{milestones.length === 1 ? "" : "s"} in the next 60 days
        {milestones.length > visible.length ? ` · showing the first ${visible.length}` : ""}
      </div>
    </div>
  );
}
