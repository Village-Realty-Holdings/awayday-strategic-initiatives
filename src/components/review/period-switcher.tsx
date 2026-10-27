import Link from "next/link";
import { periodLabel } from "@/lib/review-model";

/**
 * Month switcher for the review. The `home` month (the newest published one)
 * lives at `/`; the others at `/review/[period]`. With `suffix` (the editor's
 * "/edit") every month links to `/review/[period]<suffix>`.
 */
export function PeriodSwitcher({ periods, current, home, suffix }: { periods: string[]; current: string; home: string; suffix?: string }) {
  if (periods.length <= 1) return null;
  return (
    <nav aria-label="Review month" className="inline-flex overflow-hidden rounded-md border border-border bg-surface text-xs">
      {periods.map((p) => (
        <Link
          key={p}
          href={suffix ? `/review/${p}${suffix}` : p === home ? "/" : `/review/${p}`}
          aria-current={p === current ? "page" : undefined}
          className={`px-3 py-1.5 transition-colors ${p === current ? "bg-navy/10 font-medium text-navy-deep" : "text-ink-muted hover:bg-surface-2"}`}
        >
          {periodLabel(p)}
        </Link>
      ))}
    </nav>
  );
}
