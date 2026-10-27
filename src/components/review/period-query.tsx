import Link from "next/link";
import { periodLabel } from "@/lib/review-model";

/** Month switcher for pages that take the period as ?period= (newest = no parameter). */
export function PeriodSwitcherQuery({ periods, current, basePath }: { periods: string[]; current: string; basePath: string }) {
  if (periods.length <= 1) return null;
  return (
    <nav aria-label="Review month" className="inline-flex overflow-hidden rounded-md border border-border bg-surface text-xs">
      {periods.map((p, i) => (
        <Link
          key={p}
          href={i === 0 ? basePath : `${basePath}?period=${p}`}
          aria-current={p === current ? "page" : undefined}
          className={`px-3 py-1.5 transition-colors ${p === current ? "bg-navy/10 font-medium text-navy-deep" : "text-ink-muted hover:bg-surface-2"}`}
        >
          {periodLabel(p)}
        </Link>
      ))}
    </nav>
  );
}
