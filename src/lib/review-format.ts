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

  // Counts first: "churned units" is a count while "annualized churn" is a rate.
  if (/\bunits?\b|\bdeals?\b|\boffers?\b|reviews received|properties/.test(name)) return "count";
  if (/margin|occupancy|churn|% of|percentage|growth|take rate|retention/.test(name)) return "percent";
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
};

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
    return [{ id: "goal-0", label: "Goal", value: first.value, style: "goal", lowerIsBetter: first.lowerIsBetter }];
  }
  const segments = text.split(/\s*[;·]\s*|\s+and\s+/i).filter((s) => s.trim() !== "");
  const markers: TargetMarker[] = [];
  const seen = new Set<string>();
  for (const segment of segments) {
    // The scale letter must not run into the next word: "3,152 budget" is a bare
    // 3,152, not "3,152b" (three trillion). An earlier pattern allowed `\s*`
    // before `[kmb]`, so the b of "budget" became a billions suffix and every
    // "… budget" target was plotted a billion times too large.
    const figures = segment.match(/[<>\u2264\u2265~]?\s*\$?\s*[-+]?\d+(?:[.,]\d+)*(?:[kmb](?![a-z0-9])|\s+[kmb](?![a-z0-9]))?\s*%?/gi) ?? [];
    if (figures.length !== 1) continue; // ambiguous: not attributable to one target
    const kind = TARGET_STYLES.find((k) => k.pattern.test(segment));
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
    });
  }
  return markers;
}
