import Link from "next/link";
import { periodLabel } from "@/lib/review-model";

/** Month switcher for the review. The newest period lives at `/`. */
export function PeriodSwitcher({ periods, current }: { periods: string[]; current: string }) {
  if (periods.length <= 1) return null;
  return (
    <nav aria-label="Review month" className="inline-flex overflow-hidden rounded-md border border-border bg-surface text-xs">
      {periods.map((p, i) => (
        <Link
          key={p}
          href={i === 0 ? "/" : `/review/${p}`}
          aria-current={p === current ? "page" : undefined}
          className={`px-3 py-1.5 transition-colors ${p === current ? "bg-navy/10 font-medium text-navy-deep" : "text-ink-muted hover:bg-surface-2"}`}
        >
          {periodLabel(p)}
        </Link>
      ))}
    </nav>
  );
}
