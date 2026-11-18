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
  const declared = `${metric.displayFormat ?? ""} ${metric.unit ?? ""}`.toLowerCase();
  if (/percentage.?point|percentage_points|\bpp\b|points/.test(declared)) return "points";
  if (/percent|\bpct\b|%/.test(declared)) return "percent";
  if (/usd|currency|dollar|\$/.test(declared)) return "currency";
  if (/\bunits?\b|count|night|day|property|properties|review|deal|offer/.test(declared)) return "count";

  const name = metric.name.toLowerCase();
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
    case "points":
      return signed(n, `${trimZeros(Math.abs(n).toFixed(2))}`);
    case "count":
      return formatCount(n);
    default:
      return signed(n, trimZeros(Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })));
  }
}

/** A value in its own unit, e.g. "$3.8M", "62.4%", "1,204". */
export function formatMetricValue(metric: MetricFormat, value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : parseNumber(value);
  if (n === null) {
    if (typeof value === "string" && value.trim() !== "") return value;
    return "—";
  }
  return formatValueForKind(metricKind(metric), n);
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

/** Parses an observation value without accepting junk: "1,204" yes, "n/a" no. */
export function parseNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const text = value.trim();
  if (text === "") return null;
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/[,$%\s]/g, "").replace(/\u2212/g, "-").replace(/^\((.*)\)$/, "$1");
  const n = Number(cleaned);
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
  const match = text.match(/^([<>\u2264\u2265~]?)\s*\$?\s*(-?\d+(?:[.,]\d+)*)\s*([kmb])?\s*%?$/i);
  if (!match) return null;
  const [, sign, raw, suffix] = match;
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const scale = suffix?.toLowerCase() === "b" ? 1_000_000_000 : suffix?.toLowerCase() === "m" ? 1_000_000 : suffix?.toLowerCase() === "k" ? 1_000 : 1;
  return { value: value * scale, lowerIsBetter: sign === "<" || sign === "\u2264" };
}
