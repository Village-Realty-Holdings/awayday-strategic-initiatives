// Geometry and labelling for the KPI gauge, kept free of React so the maths can
// be tested directly: marker positions, clamping at the ends, the lane
// assignment that stops labels overlapping, value formatting and the accessible
// summary.
//
// The gauge never decides a business value. It is handed an actual, a domain and
// the targets the definition already carries, and only works out where they sit.

import { formatValueForKind, type MetricKind } from "@/lib/review-format";
import type { KpiDirection } from "@/lib/kpi-status";

export type GaugeTargetStyle = "goal" | "budget" | "stretch" | "reference";

export type GaugeTarget = {
  id: string;
  /** Shown next to the marker, e.g. "2026 goal" or "FY27 stretch". */
  label: string;
  value: number;
  style?: GaugeTargetStyle;
};

export type GaugeFormat = {
  kind: MetricKind;
  /**
   * True when values are stored as fractions (0.124) rather than as percentages
   * (12.4). Only affects formatting, never the geometry.
   */
  percentIsFraction?: boolean;
};

export type GaugeSpec = {
  /** Domain ends. A negative end is normal (margin vs prior year, TRevPAR growth). */
  min: number;
  max: number;
  /** Null when no observation is loaded: the track and its targets still render. */
  actual: number | null;
  targets: readonly GaugeTarget[];
  direction: KpiDirection;
  format: GaugeFormat;
  /** Decimal places for count kinds; ignored for currency/percent/points. */
  decimals?: number;
};

export const GAUGE_LANES = ["above-1", "below-1", "above-2", "below-2"] as const;
export type GaugeLane = (typeof GAUGE_LANES)[number];

/** Space a label needs, as a percentage of the track, before another may share its lane. */
export const DEFAULT_LABEL_GAP_PERCENT = 16;

/** Labels closer than this to an end align inward so they cannot be clipped. */
export const EDGE_ALIGN_PERCENT = 7;

/**
 * A usable domain: ends in the right order, and never zero-width (which would
 * divide by zero and put everything at the same point).
 */
export function gaugeDomain(spec: Pick<GaugeSpec, "min" | "max">): { min: number; max: number } {
  let { min, max } = spec;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    return { min: min - pad, max: max + pad };
  }
  return { min, max };
}

/** Where a value sits on the track, 0–100. Values outside the domain clamp to an end. */
export function gaugePercent(value: number, min: number, max: number): number {
  const domain = gaugeDomain({ min, max });
  if (!Number.isFinite(value)) return 0;
  const raw = ((value - domain.min) / (domain.max - domain.min)) * 100;
  return Math.min(100, Math.max(0, raw));
}

/** Whether a value is outside the domain, so the component can say so explicitly. */
export function gaugeOverflow(value: number, min: number, max: number): "below" | "above" | null {
  const domain = gaugeDomain({ min, max });
  if (!Number.isFinite(value)) return null;
  if (value < domain.min) return "below";
  if (value > domain.max) return "above";
  return null;
}

function fractionToPercent(value: number, format: GaugeFormat): number {
  return format.percentIsFraction ? value * 100 : value;
}

/** A value in the metric's own unit, using the app's shared formatters. */
export function formatGaugeValue(value: number, format: GaugeFormat, decimals?: number): string {
  const scaled = format.kind === "percent" ? fractionToPercent(value, format) : value;
  if (format.kind === "count" && decimals != null) {
    return scaled.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return formatValueForKind(format.kind, scaled);
}

export type GaugeLabelAlignment = "left" | "center" | "right";

export type GaugeLabelPlacement = {
  id: string;
  /** Left edge of the marker, 0–100. */
  percent: number;
  lane: GaugeLane;
  align: GaugeLabelAlignment;
};

function alignmentFor(percent: number): GaugeLabelAlignment {
  if (percent <= EDGE_ALIGN_PERCENT) return "left";
  if (percent >= 100 - EDGE_ALIGN_PERCENT) return "right";
  return "center";
}

/**
 * Place each target's label without letting two overlap.
 *
 * Labels are visited left to right. Each takes the first lane whose previous
 * label is at least `minGapPercent` away; when every lane is busy the least
 * recently used one is reused (an honest worst case: a very crowded gauge is
 * still readable because the marker itself stays exact and the value is in the
 * accessible summary and the data table). Labels near either end align inward.
 */
export function layoutGaugeLabels(
  targets: readonly GaugeTarget[],
  { min, max }: { min: number; max: number },
  { minGapPercent = DEFAULT_LABEL_GAP_PERCENT }: { minGapPercent?: number } = {},
): GaugeLabelPlacement[] {
  const placed = targets.map((target) => ({ id: target.id, percent: gaugePercent(target.value, min, max) }));
  const order = placed.map((item, index) => ({ ...item, index })).sort((a, b) => a.percent - b.percent || a.index - b.index);

  const lastInLane: (number | null)[] = GAUGE_LANES.map(() => null);
  const lanes: GaugeLane[] = [];

  for (const item of order) {
    let laneIndex = lastInLane.findIndex((last) => last === null || item.percent - last >= minGapPercent);
    if (laneIndex === -1) {
      // Every lane is crowded: take the one whose label is furthest left.
      laneIndex = lastInLane.reduce<number>(
        (best, last, index) => ((last ?? -Infinity) < (lastInLane[best] ?? -Infinity) ? index : best),
        0,
      );
    }
    lastInLane[laneIndex] = item.percent;
    lanes[item.index] = GAUGE_LANES[laneIndex];
  }

  return targets.map((target, index) => ({
    id: target.id,
    percent: placed[index].percent,
    lane: lanes[index],
    align: alignmentFor(placed[index].percent),
  }));
}

/** Every mark on the track, actual included, in ascending position order. */
export function gaugeMarks(spec: GaugeSpec): { id: string; percent: number }[] {
  const marks = spec.targets.map((target) => ({ id: target.id, percent: gaugePercent(target.value, spec.min, spec.max) }));
  if (spec.actual != null) marks.push({ id: "actual", percent: gaugePercent(spec.actual, spec.min, spec.max) });
  return marks.sort((a, b) => a.percent - b.percent);
}

/**
 * The whole gauge as one sentence, for `aria-label`. Values and targets are all
 * present, so nothing depends on seeing a colour or a marker.
 */
export function gaugeAriaLabel(spec: GaugeSpec): string {
  const domain = gaugeDomain(spec);
  const parts: string[] = [];
  parts.push(
    spec.actual == null
      ? "No actual loaded"
      : `Actual ${formatGaugeValue(spec.actual, spec.format, spec.decimals)}${
          gaugeOverflow(spec.actual, domain.min, domain.max) ? " (outside the charted range)" : ""
        }`,
  );
  for (const target of spec.targets) {
    parts.push(`${target.label} ${formatGaugeValue(target.value, spec.format, spec.decimals)}`);
  }
  parts.push(spec.direction === "lower" ? "Lower is better" : "Higher is better");
  parts.push(
    `Range ${formatGaugeValue(domain.min, spec.format, spec.decimals)} to ${formatGaugeValue(domain.max, spec.format, spec.decimals)}`,
  );
  return parts.join(". ") + ".";
}

/**
 * A sensible domain around an actual and its targets, so a caller with only a
 * value and one target still gets a readable gauge: 20% headroom, snapped to a
 * round step, and always including zero for non-negative measures so the bar
 * cannot flatter a shortfall.
 */
export function suggestDomain(values: readonly number[]): { min: number; max: number } {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 1 };
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const span = high - low || Math.abs(high) || 1;
  const pad = span * 0.15;
  const roundedMin = roundStep(low >= 0 ? 0 : low - pad);
  const roundedMax = roundStep(high + pad);
  // A tight cluster can snap both ends to the same round number ("4.5 to 4.5"
  // for a 4.64 actual against a 4.5 goal), which leaves the actual outside its
  // own axis and the gauge unreadable. Keep at least one step of range, and step
  // up again if rounding landed below the largest value.
  const max = roundedMax > roundedMin ? roundedMax : roundedMin + stepFor(roundedMin);
  return { min: roundedMin, max: max < high ? max + stepFor(max) : max };
}

/** The rounding step `roundStep` uses at this magnitude. */
function stepFor(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude === 0) return 1;
  return magnitude >= 100 ? 10 : magnitude >= 10 ? 1 : magnitude >= 1 ? 0.5 : 0.1;
}

function roundStep(value: number): number {
  const step = stepFor(value);
  return Math.round(value / step) * step;
}

/**
 * The unit a gauge should print in, read from how the value and target are
 * already written ("12.4%", "$34.8M", "+0.8 pt"). Presentation only: it changes
 * the suffix, never the number.
 */
export function inferGaugeFormat(...texts: readonly (string | null | undefined)[]): GaugeFormat {
  const text = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\bpt\b|points?\b/.test(text)) return { kind: "points" };
  if (/%|percent/.test(text)) return { kind: "percent" };
  if (/\$|usd|dollars?/.test(text)) return { kind: "currency" };
  return { kind: "number" };
}

/**
 * Whether an actual and its targets are almost certainly measuring different
 * things, so the gauge should not be drawn at all.
 *
 * A level ("138,000") plotted against growth targets ("1% budget; 5% stretch")
 * produces an axis that means nothing. The cheap, honest test is: if one side is
 * written as a percentage and the other is not, and the magnitudes are orders of
 * magnitude apart, the definition is mixing two quantities. Small spreads stay,
 * because a percent target against a bare number ("11" against "<11%") is the
 * same measure written two ways.
 */
export function looksLikeDifferentQuantity({
  actual,
  targets,
  actualText,
  targetText,
}: {
  actual: number;
  targets: readonly number[];
  actualText?: string | null;
  targetText?: string | null;
}): boolean {
  const finiteTargets = targets.filter((value) => Number.isFinite(value));
  if (!Number.isFinite(actual) || finiteTargets.length === 0) return false;
  const percent = (text: string | null | undefined) => /%|percent/.test(text ?? "");
  if (percent(actualText) === percent(targetText)) return false;
  const magnitudes = [Math.abs(actual), ...finiteTargets.map(Math.abs)].filter((value) => value > 0);
  if (magnitudes.length < 2) return false;
  const ratio = Math.max(...magnitudes) / Math.min(...magnitudes);
  return ratio > 100;
}
