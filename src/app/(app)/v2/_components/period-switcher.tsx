import Link from "next/link";
import { PERIODS } from "../_mock/selectors";

/** Month switcher. `suffix` is appended after the period id (e.g. "/edit"). */
export function PeriodSwitcher({ current, suffix = "" }: { current: string; suffix?: string }) {
  return (
    <nav aria-label="Review month" className="inline-flex overflow-hidden rounded-md border border-border bg-surface text-xs">
      {PERIODS.map((p) => (
        <Link
          key={p.id}
          href={`/v2/review/${p.id}${suffix}`}
          aria-current={p.id === current ? "page" : undefined}
          className={`px-3 py-1.5 transition-colors ${
            p.id === current ? "bg-navy/10 font-medium text-navy-deep" : "text-ink-muted hover:bg-surface-2"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
