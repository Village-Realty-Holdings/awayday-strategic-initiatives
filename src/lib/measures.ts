// Pure rules for an initiative's KPIs and leading measures. No Prisma here, so
// the page, the server actions and the tests all share one definition.

import type { Rag } from "@/lib/review-model";

export const MEASURE_KINDS = ["KPI", "LEADING"] as const;
export const MEASURE_UNITS = ["PERCENT", "DOLLARS", "NUMBER", "DAYS"] as const;
export type MeasureUnit = (typeof MEASURE_UNITS)[number];

export const MEASURE_KIND_LABEL: Record<string, string> = { KPI: "KPI", LEADING: "Leading" };
export const MEASURE_UNIT_LABEL: Record<MeasureUnit, string> = { PERCENT: "%", DOLLARS: "$", NUMBER: "Number", DAYS: "Days" };

export type ReadingLite = { value: number; asOf: Date; createdAt: Date };
export type MeasureLite = {
  kind: string;
  baseline: number | null;
  target: number | null;
  order: number;
  createdAt: Date;
  readings: ReadingLite[];
};

/**
 * Parse a typed measure value. Accepts "$", "%", commas, an M/K suffix and a
 * sign, since a measure can legitimately be negative (a margin change, an NPS).
 * Null for blank or unreadable input; callers decide whether that is an error.
 */
export function parseMeasureValue(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const m = String(raw).replace(/[$,%\s]/g, "").match(/^([+-]?(?:\d+\.?\d*|\.\d+))([mMkK])?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const suffix = m[2]?.toLowerCase();
  return suffix === "m" ? n * 1_000_000 : suffix === "k" ? n * 1_000 : n;
}

export function formatMeasureValue(v: number | null | undefined, unit: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const sign = v < 0 ? "-" : "";
  if (unit === "PERCENT") return `${sign}${abs}%`;
  if (unit === "DOLLARS") return `${sign}$${abs}`;
  if (unit === "DAYS") return `${sign}${abs} ${abs === "1" ? "day" : "days"}`;
  return `${sign}${abs}`;
}

/** Plain text for an edit field, without the unit's symbol or thousands commas. */
export function measureValueInput(v: number | null): string {
  return v == null ? "" : String(v);
}

/** Newest first by as-of date, so a back-dated correction doesn't become the latest. */
export function sortReadings<T extends ReadingLite>(readings: T[]): T[] {
  return [...readings].sort((a, b) => b.asOf.getTime() - a.asOf.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Share of the way from baseline to target: can exceed 1, floored at 0 when the
 * measure has moved the wrong way. Null when it can't be worked out.
 */
export function measureProgress(m: Pick<MeasureLite, "baseline" | "target" | "readings">): number | null {
  const latest = sortReadings(m.readings)[0];
  if (!latest || m.baseline == null || m.target == null || m.target === m.baseline) return null;
  return Math.max(0, (latest.value - m.baseline) / (m.target - m.baseline));
}

/** The KPI that stands in for dollars: the first by order. Leading measures never qualify. */
export function primaryKpi<T extends Pick<MeasureLite, "kind" | "order" | "createdAt">>(measures: T[]): T | null {
  const kpis = measures.filter((m) => m.kind === "KPI");
  kpis.sort((a, b) => a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime());
  return kpis[0] ?? null;
}

/** True when an initiative's percent comes from its dollar figures rather than a KPI. */
export function hasDollarProgress(actual: number | null, target: number | null): boolean {
  return actual != null && target != null && target > 0;
}

/**
 * A value initiative's percent complete: value created ÷ value to create when
 * both are set, otherwise the first KPI's progress. Null when neither gives one.
 */
export function derivedPct(actual: number | null, target: number | null, measures: MeasureLite[]): number | null {
  if (hasDollarProgress(actual, target)) return Math.max(0, actual! / target!);
  const kpi = primaryKpi(measures);
  return kpi ? measureProgress(kpi) : null;
}

/** Whether a measure has a value dated within a review month ("2026-10"). */
export function measureUpdatedInPeriod(m: { readings: { asOf: Date }[] }, period: string): boolean {
  return m.readings.some((r) => r.asOf.toISOString().slice(0, 7) === period);
}

/** The as-of date to offer for a month's value: today, or the month's last day once it has passed. */
export function defaultAsOf(period: string, today: string): string {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return today < lastDay ? today : lastDay;
}

/** The measure an SI's card leads with: its first KPI, else its first leading measure. */
export function headlineMeasure<T extends Pick<MeasureLite, "kind" | "order" | "createdAt">>(measures: T[]): T | null {
  const byOrder = [...measures].sort((a, b) => a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime());
  return primaryKpi(measures) ?? byOrder[0] ?? null;
}

/** The newest reading, ignoring any dated after `throughPeriod` ("2026-10") when one is given. */
export function latestReading<T extends ReadingLite>(readings: T[], throughPeriod: string | null): T | null {
  const inRange = throughPeriod ? readings.filter((r) => r.asOf.toISOString().slice(0, 7) <= throughPeriod) : readings;
  return sortReadings(inRange)[0] ?? null;
}

/**
 * A value against its target, by the same rule as a pillar's measure: at or past
 * target is green, within 10% of it amber, otherwise red. A target below the
 * baseline means lower is better. Grey without both a value and a target.
 */
export function measureRag(value: number | null | undefined, m: Pick<MeasureLite, "baseline" | "target">): Rag {
  if (value == null || m.target == null) return "GREY";
  const lowerIsBetter = m.baseline != null && m.target < m.baseline;
  if (lowerIsBetter ? value <= m.target : value >= m.target) return "GREEN";
  const distance = m.target === 0 ? Infinity : Math.abs(value - m.target) / Math.abs(m.target);
  return distance <= 0.1 ? "AMBER" : "RED";
}
