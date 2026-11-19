import { Badge } from "@/components/ui/badge";
import {
  isMixed,
  KPI_STATUS_META,
  statusToneWithRule,
  type KpiStatus,
  type StatusSummary,
  type StatusTone,
} from "@/lib/kpi-status";

// One badge for every KPI status surface (strategy house, executive cards, KPI
// tables, scorecards, gauges). The word is always rendered next to the glyph, so
// nothing depends on colour alone; the tooltip explains what the status claims.

const BADGE_VARIANT: Record<StatusTone, "ok" | "warn" | "risk" | "outline"> = {
  good: "ok",
  warn: "warn",
  crit: "risk",
  neutral: "outline",
};

export function KpiStatusBadge({
  status,
  tone,
  className,
}: {
  status: KpiStatus;
  /** Overrides the documented colour for under_budget / floor_breached only. */
  tone?: StatusTone;
  className?: string;
}) {
  const resolved = statusToneWithRule(status, tone);
  return (
    <Badge
      variant={BADGE_VARIANT[resolved]}
      shape="pill"
      className={className}
      title={statusMeaning(status)}
      data-status={status}
      data-tone={resolved}
    >
      <span aria-hidden className="text-nano leading-none">
        {KPI_STATUS_META[status].glyph}
      </span>
      {KPI_STATUS_META[status].label}
    </Badge>
  );
}

function statusMeaning(status: KpiStatus): string {
  return KPI_STATUS_META[status].meaning;
}

/**
 * Several statuses for one pillar, e.g. volume ahead while CAC is off track. The
 * chip keeps every part visible instead of choosing a headline colour.
 */
export function KpiStatusChips({
  statuses,
  className,
}: {
  statuses: { status: KpiStatus; label?: string; tone?: StatusTone }[];
  className?: string;
}) {
  if (statuses.length === 0) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {statuses.map((entry, index) => (
        <KpiStatusBadge key={`${entry.status}-${entry.label ?? index}`} status={entry.status} tone={entry.tone} />
      ))}
    </span>
  );
}

/**
 * The count-based summary of a scorecard ("2 of 7 measures behind"). Deliberately
 * factual: it reports how many measures sit on each side rather than picking one
 * verdict for a pillar whose results are mixed.
 */
export function MixedPerformanceChip({ summary, className }: { summary: StatusSummary; className?: string }) {
  if (summary.total === 0) return null;
  const variant = BADGE_VARIANT[summary.tone];
  return (
    <Badge
      variant={variant}
      shape="pill"
      className={className}
      data-mixed={isMixed(summary) ? "true" : "false"}
      title={`${summary.ahead} ahead, ${summary.onTrack} on or near plan, ${summary.behind} behind, ${summary.missing} not loaded`}
    >
      <span aria-hidden className="text-nano leading-none">
        {summary.tone === "crit" ? "▼" : summary.tone === "warn" ? "◆" : summary.tone === "good" ? "●" : "○"}
      </span>
      {summary.label}
    </Badge>
  );
}
