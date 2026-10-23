import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MOCK_TODAY } from "../_mock/data";
import { areaName, daysBetween, milestoneDateLabel, siByCode, siShortCode } from "../_mock/selectors";
import type { MockMilestone } from "../_mock/types";

const WINDOW_DAYS = 60;

export function SummaryGantt({ milestones }: { milestones: MockMilestone[] }) {
  const start = MOCK_TODAY;
  const visible = milestones.slice(0, 12);

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
        {visible.map((milestone) => {
          const left = Math.max(0, Math.min(100, (daysBetween(start, milestone.date) / WINDOW_DAYS) * 100));
          const width = milestone.endDate
            ? Math.max(5, Math.min(100 - left, (daysBetween(milestone.date, milestone.endDate) / WINDOW_DAYS) * 100))
            : 5;
          const si = milestone.siCode ? siByCode(milestone.siCode) : undefined;
          return (
            <div key={milestone.id} className="grid grid-cols-[minmax(13rem,1fr)_minmax(20rem,2fr)] items-center gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-ink">{milestone.title}</p>
                <p className="truncate text-[11px] text-ink-faint">
                  {si ? (
                    <Link href={`/v2/si/${si.code}`} className="hover:text-navy hover:underline">
                      {siShortCode(si.code)} {si.name}
                    </Link>
                  ) : (
                    areaName(milestone.pillar)
                  )}{" "}
                  · {milestoneDateLabel(milestone)}
                </p>
              </div>
              <div className="relative h-6 rounded bg-surface-2">
                <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-border-strong" aria-hidden />
                <span className="absolute inset-y-0 right-0 border-l border-border/70" aria-hidden />
                <span
                  className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full ${milestone.done ? "bg-ok" : "bg-navy"}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  aria-label={`${milestone.done ? "Done" : "Open"} milestone`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-border bg-surface-2/30 px-4 py-2 text-[11px] text-ink-faint">
        <span>{milestones.length} milestones in the next 60 days</span>
        <Badge variant="secondary">Embedded on Summary</Badge>
      </div>
    </div>
  );
}
