// Pure formatting for KPI values. No database import and no React, so both
// server and client components can format a value the same way.

// ---------------------------------------------------------------------------
// Metric kinds and formatting
// ---------------------------------------------------------------------------

export type MetricFormat = { unit: string | null; displayFormat: string | null; name: string };

export type MetricKind = "currency" | "percent" | "points" | "count" | "number";

/**
 * How a metric's values should be read. The declared unit/format wins; the name
 * is only a fallback for definitions that have no unit yet.
 */
export function metricKind(metric: MetricFormat): MetricKind {
  const name = metric.name.toLowerCase();
  // A margin compared with last year is a difference of two percentages, so it is
  // percentage points even when the definition declares a percent unit. Checked
  // before the declaration for that reason: it can never be read as a percent.
  if (/margin/.test(name) && /\bvs\s*(py|prior year|ly)\b/.test(name)) return "points";

  const declared = `${metric.displayFormat ?? ""} ${metric.unit ?? ""}`.toLowerCase();
  if (/percentage.?point|percentage_points|\bpp\b|points/.test(declared)) return "points";
  if (/percent|\bpct\b|%/.test(declared)) return "percent";
  if (/usd|currency|dollar|\$/.test(declared)) return "currency";
  if (/\bunits?\b|count|night|day|property|properties|review|deal|offer/.test(declared)) return "count";

  // Names that state a rate and a count in the same phrase are resolved by the
  // phrase: "churned units" is a count, while "unit churn" and "owner unit
  // retention" are rates even though the name contains "unit". Without this,
  // "Owner unit churn" read as a count and its percentage goal was refused as a
  // different quantity.
  if (/\bchurn(ed)?\s+units?\b|\bunits?\s+churned\b/.test(name)) return "count";
  if (/margin|occupancy|churn|% of|percentage|growth|take rate|retention/.test(name)) return "percent";
  if (/\bunits?\b|\bdeals?\b|\boffers?\b|reviews received|properties/.test(name)) return "count";
  return "number";
}

const MINUS = "\u2212";

function signed(n: number, body: string): string {
  if (n < 0) return `${MINUS}${body}`;
  return body;
}

function trimZeros(text: string): string {
  return text.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** 136000000 → "$136.0M"; -1200000 → "−$1.2M"; 3849474 → "$3.8M". */
export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return signed(n, `$${(abs / 1_000_000_000).toFixed(1)}B`);
  if (abs >= 1_000_000) return signed(n, `$${(abs / 1_000_000).toFixed(1)}M`);
  if (abs >= 10_000) return signed(n, `$${Math.round(abs / 1_000)}K`);
  if (abs >= 1_000) return signed(n, `$${trimZeros((abs / 1_000).toFixed(1))}K`);
  return signed(n, `$${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
}

/** Percentage differences are percentage points, never percentages. */
export function formatPoints(n: number): string {
  return signed(n, `${trimZeros(Math.abs(n).toFixed(2))} pp`);
}

export function formatCount(n: number): string {
  return signed(n, Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(n) ? 0 : 1 }));
}

/** A number in the unit a metric kind implies; used for values, axes and totals. */
export function formatValueForKind(kind: MetricKind, n: number): string {
  switch (kind) {
    case "currency":
      return formatCurrency(n);
    case "percent":
      return signed(n, `${trimZeros(Math.abs(n).toFixed(1))}%`);
    case "points": {
      // A value that is itself a point difference reads like the report: "+0.5 pt".
      const body = `${trimZeros(Math.abs(n).toFixed(2))} pt`;
      return n > 0 ? `+${body}` : n < 0 ? `${MINUS}${body}` : body;
    }
    case "count":
      return formatCount(n);
    default:
      return signed(n, trimZeros(Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })));
  }
}

/**
 * A metric whose own value is already a comparison ("TRevPAR growth vs PY",
 * "Shop NOI margin vs PY", "change"). Its positive values carry a "+", as the
 * reviewed report prints them.
 */
export function isDeltaMetric(metric: MetricFormat): boolean {
  const name = metric.name.toLowerCase();
  return /\bvs\s*(py|prior year|ly|budget)\b|\bgrowth\b|\bchange\b|\bdifference\b|percentage.?point|\bpt\b/.test(name);
}

/** A value in its own unit, e.g. "$3.8M", "62.4%", "+4.1%", "1,204". */
export function formatMetricValue(metric: MetricFormat, value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : parseNumber(value);
  if (n === null) {
    if (typeof value === "string" && value.trim() !== "") return value;
    return "—";
  }
  const kind = metricKind(metric);
  const text = formatValueForKind(kind, n);
  if (n > 0 && (kind === "percent" || kind === "number") && isDeltaMetric(metric)) return `+${text}`;
  return text;
}

/** A change between two values of the same metric, always signed. */
export function formatDelta(kind: MetricKind, delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? MINUS : "";
  const abs = Math.abs(delta);
  switch (kind) {
    case "currency":
      return `${sign}${formatCurrency(abs)}`;
    case "percent":
    case "points":
      return `${sign}${trimZeros(abs.toFixed(2))} pp`;
    case "count":
      return `${sign}${abs.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
    default:
      return `${sign}${trimZeros(abs.toLocaleString("en-US", { maximumFractionDigits: 2 }))}`;
  }
}

/**
 * Parses an observation value without accepting junk: "1,204" yes, "$69.4M" yes,
 * "n/a" no. A single trailing K/M/B is read as a scale, because a reviewed value
 * typed as it appears in the report is still a number; anything else ambiguous
 * returns null rather than a guess.
 */
export function parseNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const text = value.trim();
  if (text === "") return null;
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/[,$%\s]/g, "").replace(/\u2212/g, "-").replace(/^\((.*)\)$/, "$1");
  const match = cleaned.match(/^([+-]?\d*\.?\d+)([kmb])$/i);
  const n = match ? Number(match[1]) * (match[2].toLowerCase() === "b" ? 1_000_000_000 : match[2].toLowerCase() === "m" ? 1_000_000 : 1_000) : Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}


/**
 * Parses a display target ("$26M", "<11%", "1,200", "4.5") into a number in base
 * units, so it can be compared with a stored observation. Prose targets that
 * combine several figures ("23% budget; 28% stretch", "TBD") return null: a
 * status is better absent than guessed against the wrong number.
 */
export function parseTargetNumber(target: string | null | undefined): { value: number; lowerIsBetter: boolean } | null {
  if (!target) return null;
  const text = target.trim();
  if (text === "") return null;
  const match = text.match(/^([<>\u2264\u2265~]?)\s*\$?\s*([-+]?\d+(?:[.,]\d+)*)\s*([kmb])?\s*%?$/i);
  if (!match) return null;
  const [, sign, raw, suffix] = match;
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const scale = suffix?.toLowerCase() === "b" ? 1_000_000_000 : suffix?.toLowerCase() === "m" ? 1_000_000 : suffix?.toLowerCase() === "k" ? 1_000 : 1;
  return { value: value * scale, lowerIsBetter: sign === "<" || sign === "\u2264" };
}

/**
 * Which planning context a target belongs to, when its own words say so. The
 * reviewed October report sets the 2026 goal beside the FY27 budget and stretch
 * and judges status against the 2026 goal; the two are different statements and
 * are never compared with one another. `null` means the text does not say, and
 * nothing is assumed.
 */
export type TargetReference = "2026" | "FY27" | null;

/** The unit a target's own figure is written in, so a goal is never compared across quantities. */
export type TargetUnit = "percent" | "points" | "currency" | "count";

/** One target marker read out of a definition's target prose. */
export type TargetMarker = {
  /** Stable id for React and for tests. */
  id: string;
  /** Short label for the gauge ("Goal", "Budget", "Stretch"). */
  label: string;
  /** Base units, the same scale as parseNumber/parseTargetNumber. */
  value: number;
  style: "goal" | "budget" | "stretch";
  /** An explicit "<" on the figure means lower is better for that target. */
  lowerIsBetter: boolean;
  /** The planning context the text names, or null when it names none. */
  reference: TargetReference;
  /** The quantity the figure is written in. */
  unit: TargetUnit;
};

const FY27_REFERENCE = /\bfy\s*-?\s*(?:27|2027)\b|\b(?:in|for)\s+2027\b|\bnext\s+year\b/i;
const Y2026_REFERENCE = /\b2026\b|\bfy\s*-?\s*26\b|\bthis\s+year\b/i;

function targetReference(text: string): TargetReference {
  if (FY27_REFERENCE.test(text)) return "FY27";
  if (Y2026_REFERENCE.test(text)) return "2026";
  return null;
}

function targetUnit(figure: string, segment: string): TargetUnit {
  const words = segment.toLowerCase();
  if (/\bpt\b|\bpts\b|percentage\s*point|\bpp\b/.test(words)) return "points";
  if (/%/.test(figure)) return "percent";
  if (/\$|\busd\b/.test(figure.toLowerCase())) return "currency";
  return "count";
}

const TARGET_STYLES: { style: TargetMarker["style"]; label: string; pattern: RegExp }[] = [
  { style: "stretch", label: "Stretch", pattern: /\bstretch\b|\bupside\b|\baspiration/i },
  { style: "budget", label: "Budget", pattern: /\bbudget\b|\bplan\b|\bnext year\b/i },
  { style: "goal", label: "Goal", pattern: /\bgoal\b|\btarget\b|\btotal\b|\bexco\b|\bboard\b|\bcommit/i },
];

/**
 * Reads the labelled figures out of a definition's target prose, so a gauge can
 * show the goal and the stretch (and a budget, where the definition states one)
 * without any figure being written into code.
 *
 * One plain figure keeps the parseTargetNumber behaviour: "23%" and "<11%" are
 * goals. Prose is split on its own separators and a figure is used only when its
 * segment names what it is, so "$26M total; $11M via tuck-ins; $47M stretch"
 * yields a goal and a stretch and ignores the tuck-in component rather than
 * plotting it as a second goal. Anything ambiguous yields no marker: a missing
 * marker is better than one drawn against the wrong number.
 */
export function parseTargetMarkers(target: string | null | undefined): TargetMarker[] {
  if (!target) return [];
  const text = target.trim();
  if (!text) return [];
  const first = parseTargetNumber(text);
  if (first) {
    return [
      {
        id: "goal-0",
        label: "Goal",
        value: first.value,
        style: "goal",
        lowerIsBetter: first.lowerIsBetter,
        reference: targetReference(text),
        unit: targetUnit(text, text),
      },
    ];
  }
  const segments = text.split(/\s*[;·]\s*|\s+and\s+/i).filter((s) => s.trim() !== "");
  const markers: TargetMarker[] = [];
  const seen = new Set<string>();
  for (const segment of segments) {
    // A planning-context token is not a figure: "2026 goal $23M" states one
    // number, and "FY27 12%" states one. Scrubbing the year (and the FY label)
    // before counting figures keeps the "one figure per segment" rule honest —
    // otherwise the year counted as a second figure and the marker was dropped.
    const scrubbed = segment.replace(/\bfy\s*-?\s*\d{2,4}\b/gi, " ").replace(/\b(?:19|20)\d{2}\b/g, " ");
    // The scale letter must not run into the next word: "3,152 budget" is a bare
    // 3,152, not "3,152b" (three trillion). An earlier pattern allowed `\s*`
    // before `[kmb]`, so the b of "budget" became a billions suffix and every
    // "… budget" target was plotted a billion times too large.
    const figures = scrubbed.match(/[<>\u2264\u2265~]?\s*\$?\s*[-+]?\d+(?:[.,]\d+)*(?:[kmb](?![a-z0-9])|\s+[kmb](?![a-z0-9]))?\s*%?/gi) ?? [];
    if (figures.length !== 1) continue; // ambiguous: not attributable to one target
    const kind = TARGET_STYLES.find((k) => k.pattern.test(segment)) ?? (targetReference(segment) ? { style: "goal" as const, label: "Goal" } : undefined);
    if (!kind) continue; // an unlabelled figure in prose is a component, not a target
    const parsed = parseTargetNumber(figures[0].replace(/\s+/g, ""));
    if (!parsed) continue;
    const key = `${kind.style}:${parsed.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    markers.push({
      id: `${kind.style}-${markers.length}`,
      label: kind.label,
      value: parsed.value,
      style: kind.style,
      lowerIsBetter: parsed.lowerIsBetter,
      reference: targetReference(segment),
      unit: targetUnit(figures[0], segment),
    });
  }
  return markers;
}

/**
 * Whether a marker's figure is in the same quantity as a metric of `kind`. A
 * count goal is never compared with a percentage measure: the reviewed report
 * states Grow's 2026 goal as a growth percentage while the pillar measure is a
 * unit count, and comparing them would rate 3,340 units against 23%.
 */
export function markerMatchesKind(marker: TargetMarker, kind: MetricKind): boolean {
  switch (kind) {
    case "currency":
      return marker.unit === "currency";
    case "percent":
      return marker.unit === "percent";
    case "points":
      // A margin goal is written either "+0.7 pt" or "+0.7%" and means the same.
      return marker.unit === "points" || marker.unit === "percent";
    case "count":
      return marker.unit === "count";
    default:
      return marker.unit === "count" || marker.unit === "percent";
  }
}

/**
 * Whether a value and a target are plausibly the same quantity. Two figures more
 * than two orders of magnitude apart are not a comparison: a unit count of
 * 3,340 against a 23% growth target, or a $34.8M result against a $26 target,
 * would otherwise produce a confident status from a meaningless ratio. Zero
 * carries no scale evidence either way, so it does not veto.
 */
export function sameQuantity(actual: number, target: number): boolean {
  const a = Math.abs(actual);
  const t = Math.abs(target);
  if (a === 0 || t === 0) return true;
  const ratio = a / t;
  return ratio >= 0.01 && ratio <= 100;
}

/**
 * The target the reviewed report judges a status against: the goal, preferring
 * one whose own text says 2026 over an unlabelled goal, and never a budget, a
 * stretch, or a figure the text labels FY27. When a metric kind is supplied,
 * only a goal written in that quantity qualifies, so a unit count is never
 * rated against a growth percentage.
 */
export function primaryGoalMarker(markers: readonly TargetMarker[], kind?: MetricKind): TargetMarker | null {
  const goals = markers.filter(
    (marker) => marker.style === "goal" && marker.reference !== "FY27" && (kind === undefined || markerMatchesKind(marker, kind)),
  );
  return goals.find((marker) => marker.reference === "2026") ?? goals[0] ?? null;
}

/**
 * Whether an unlabelled goal figure is indistinguishable from one of the
 * mapping's FY27 planning figures (budget or stretch). Target text that states
 * only "$26M total" carries the FY27 budget; it is not a 2026 goal and must not
 * set an October status. A figure the text explicitly calls 2026 is never
 * refused this way — the business has said which one it means.
 *
 * The comparison allows a small relative tolerance so "$26.0M" written in the
 * text still matches a stored 25,980,000, but stays tight enough that a genuine
 * nearby goal (23 against a 23.4 budget) is not mistaken for planning data.
 */
export function isPlanningFigure(value: number, figures: readonly (number | null | undefined)[], tolerance = 0.005): boolean {
  if (!Number.isFinite(value)) return false;
  return figures.some((figure) => {
    if (figure === null || figure === undefined || !Number.isFinite(figure)) return false;
    const scale = Math.max(Math.abs(figure), Math.abs(value));
    if (scale === 0) return true;
    return Math.abs(value - figure) <= scale * tolerance;
  });
}

/** How a target marker is labelled, naming its planning context when the text does. */
export function targetMarkerLabel(marker: TargetMarker): string {
  if (marker.reference === "2026") return marker.style === "goal" ? "2026 goal" : `2026 ${marker.style}`;
  if (marker.reference === "FY27") return marker.style === "goal" ? "FY27 goal" : `FY27 ${marker.style}`;
  return marker.label;
}
