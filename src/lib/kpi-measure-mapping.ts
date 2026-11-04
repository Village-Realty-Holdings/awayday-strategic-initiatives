import { CONSOLIDATED_REPORTING_SCOPE, selectCurrentObservations } from "@/lib/kpi";
import { formatKpiValue, type KpiRow } from "@/lib/review-kpi";
import { ragAgainst, type Rag } from "@/lib/review-model";

// How a pillar's measure gets its value from the metrics the import publishes.
// One KpiMeasureMapping row per measure says which metrics to read and which
// calculation to run. Values are worked out when the review loads and are never
// written back, so a later revision to an input also changes the result.

export const MEASURE_CALCULATIONS = ["DIRECT", "YOY_PCT", "RATIO_DELTA_PY"] as const;

export type MeasureMapping = {
  calculation: string;
  inputMetricKey: string | null;
  denominatorMetricKey: string | null;
  timeBasis: string;
  displayFormat: string;
  higherIsBetter: boolean;
  targetBudget: number | null;
};

export type DerivedMeasure = { value: number; quality: string };

type RowsByMetric = ReadonlyMap<string, readonly KpiRow[]>;

/** The metric keys a mapping reads, in order. */
export function mappingInputKeys(mapping: Pick<MeasureMapping, "inputMetricKey" | "denominatorMetricKey">): string[] {
  return [mapping.inputMetricKey, mapping.denominatorMetricKey].filter((key): key is string => Boolean(key));
}

/** A number from stored text, in base units: "$26M" is 26000000, "12.9%" is 12.9. */
export function parseMeasureNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.replace(/[$,%\s]/g, "").replace("−", "-").match(/^([+-]?\d+(?:\.\d+)?)([KMB])?/i);
  if (!match) return null;
  const scale = { K: 1e3, M: 1e6, B: 1e9 }[match[2]?.toUpperCase() ?? ""] ?? 1;
  const number = Number(match[1]) * scale;
  return Number.isFinite(number) ? number : null;
}

/** Works out a measure for the period, or null when any input is missing or unusable. */
export function deriveMeasure(mapping: MeasureMapping, rows: RowsByMetric, period: string): DerivedMeasure | null {
  const stale: boolean[] = [];
  const read = (metricKey: string | null, comparisonBasis: "ACTUAL" | "PRIOR_YEAR"): number | null => {
    if (!metricKey) return null;
    const [row] = selectCurrentObservations(rows.get(metricKey) ?? [], {
      reportingPeriod: period,
      reportingScope: CONSOLIDATED_REPORTING_SCOPE,
      comparisonBasis,
      timeBasis: mapping.timeBasis,
    }).filter((o) => (o.entityScope ?? "CONSOLIDATED") === "CONSOLIDATED");
    if (!row) return null;
    stale.push(row.quality === "STALE");
    const number = Number(row.value);
    return row.value.trim() !== "" && Number.isFinite(number) ? number : null;
  };

  const value = calculate(mapping, read);
  if (value === null || !Number.isFinite(value)) return null;
  return { value, quality: stale.includes(true) ? "STALE" : "VALID" };
}

function calculate(mapping: MeasureMapping, read: (metricKey: string | null, basis: "ACTUAL" | "PRIOR_YEAR") => number | null): number | null {
  const { inputMetricKey: input, denominatorMetricKey: denominator } = mapping;
  switch (mapping.calculation) {
    case "DIRECT":
      return read(input, "ACTUAL");
    case "YOY_PCT": {
      const actual = read(input, "ACTUAL");
      const prior = read(input, "PRIOR_YEAR");
      if (actual === null || !prior) return null;
      return ((actual - prior) / Math.abs(prior)) * 100;
    }
    case "RATIO_DELTA_PY": {
      const actual = ratio(read(input, "ACTUAL"), read(denominator, "ACTUAL"));
      const prior = ratio(read(input, "PRIOR_YEAR"), read(denominator, "PRIOR_YEAR"));
      return actual === null || prior === null ? null : (actual - prior) * 100;
    }
    default:
      return null;
  }
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  return numerator === null || !denominator ? null : numerator / denominator;
}

export function formatDerivedMeasure(value: number, mapping: Pick<MeasureMapping, "calculation" | "displayFormat">): string {
  if (mapping.displayFormat !== "percent") return formatKpiValue(String(value), { unit: null, displayFormat: mapping.displayFormat });
  if (mapping.calculation === "DIRECT") return `${value.toFixed(1)}%`;
  // Margin targets are as small as +0.25, which one decimal place would misstate.
  const digits = mapping.calculation === "RATIO_DELTA_PY" ? 2 : 1;
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

/** Rates a value against the mapping's budget target, in its stated direction. */
export function mappingRag(value: number | null, mapping: Pick<MeasureMapping, "higherIsBetter" | "targetBudget">, quality = "VALID"): Rag {
  if (value === null || mapping.targetBudget === null) return "GREY";
  if (quality === "UNAVAILABLE" || quality === "INVALID") return "GREY";
  if (quality === "STALE") return "AMBER";
  return ragAgainst(value, mapping.targetBudget, !mapping.higherIsBetter);
}
