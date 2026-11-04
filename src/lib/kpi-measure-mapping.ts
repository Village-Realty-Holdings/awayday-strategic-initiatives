import { CONSOLIDATED_REPORTING_SCOPE, selectCurrentObservations } from "@/lib/kpi";
import { BASIS_LABEL, formatKpiValue, TIME_LABEL, type KpiRow } from "@/lib/review-kpi";
import { fmtLong, isoDay, ragAgainst, ragLabel, type MeasureOrigin, type Rag } from "@/lib/review-model";

// How a pillar's measure gets its value from the metrics the import publishes.
// One KpiMeasureMapping row per measure says which metrics to read and which
// calculation to run. Values are worked out when the review loads and are never
// written back, so a later revision to an input also changes the result.

export const MEASURE_CALCULATIONS = ["DIRECT", "YOY_PCT", "RATIO_DELTA_PY"] as const;
export const MAPPING_TIME_BASES = ["MONTHLY", "YTD", "LTM", "POINT_IN_TIME"] as const;
export const MAPPING_DISPLAY_FORMATS = ["percent", "currency", "number"] as const;

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
type Basis = "ACTUAL" | "PRIOR_YEAR";

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
  const read = (metricKey: string | null, comparisonBasis: Basis): number | null => {
    const row = findInput(mapping, rows, period, metricKey, comparisonBasis);
    if (!row) return null;
    stale.push(row.quality === "STALE");
    const number = Number(row.value);
    return row.value.trim() !== "" && Number.isFinite(number) ? number : null;
  };

  const value = calculate(mapping, read);
  if (value === null || !Number.isFinite(value)) return null;
  return { value, quality: stale.includes(true) ? "STALE" : "VALID" };
}

/** What the mapping still needs for the period, in words; empty when every input is there. */
export function missingMeasureInputs(mapping: MeasureMapping, rows: RowsByMetric, period: string, names: ReadonlyMap<string, string> = new Map()): string[] {
  if (!mapping.inputMetricKey) return ["an input metric to be chosen"];
  return requiredInputs(mapping)
    .filter(([key, basis]) => !findInput(mapping, rows, period, key, basis))
    .map(([key, basis]) => inputLabel(mapping, key, basis, names));
}

function requiredInputs(mapping: MeasureMapping): [string, Basis][] {
  const { inputMetricKey: input, denominatorMetricKey: denominator } = mapping;
  if (!input) return [];
  if (mapping.calculation === "RATIO_DELTA_PY" && denominator) return [[input, "ACTUAL"], [input, "PRIOR_YEAR"], [denominator, "ACTUAL"], [denominator, "PRIOR_YEAR"]];
  return mapping.calculation === "YOY_PCT" ? [[input, "ACTUAL"], [input, "PRIOR_YEAR"]] : [[input, "ACTUAL"]];
}

function inputLabel(mapping: MeasureMapping, key: string, basis: Basis, names: ReadonlyMap<string, string>): string {
  return `${names.get(key) ?? key}: ${TIME_LABEL[mapping.timeBasis] ?? mapping.timeBasis} ${BASIS_LABEL[basis]}`;
}

function findInput(mapping: MeasureMapping, rows: RowsByMetric, period: string, metricKey: string | null, comparisonBasis: Basis) {
  if (!metricKey) return undefined;
  return selectCurrentObservations(rows.get(metricKey) ?? [], {
    reportingPeriod: period,
    reportingScope: CONSOLIDATED_REPORTING_SCOPE,
    comparisonBasis,
    timeBasis: mapping.timeBasis,
  }).find((o) => (o.entityScope ?? "CONSOLIDATED") === "CONSOLIDATED");
}

function calculate(mapping: MeasureMapping, read: (metricKey: string | null, basis: Basis) => number | null): number | null {
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

const CALCULATION_TEXT: Record<string, string> = {
  DIRECT: "Imported value, unchanged.",
  YOY_PCT: "Growth vs prior year: (actual − prior year) ÷ prior year.",
  RATIO_DELTA_PY: "Margin change: actual margin − prior-year margin, in points.",
};

const STATUS_RULE = "Green when more than 10% better than the target, yellow within 10% either side, red when more than 10% worse.";

function documentLine(row: { sourceDocumentName?: string | null; sourceLocation?: string | null }): string | null {
  return [row.sourceDocumentName, row.sourceLocation?.replace(/^sheet:/, "")].filter(Boolean).join(" · ") || null;
}

function formatInUnits(value: number, displayFormat: string): string {
  if (displayFormat === "percent") return `${Number(value.toFixed(2))}%`;
  return displayFormat === "currency" ? formatKpiValue(String(value), { unit: null, displayFormat }) : value.toLocaleString("en-US");
}

function formatDifference(difference: number, budget: number, displayFormat: string): string {
  const sign = difference < 0 ? "−" : "+";
  const size = Math.abs(difference);
  const amount = displayFormat === "percent" ? `${Number(size.toFixed(2))} pts` : formatInUnits(size, displayFormat);
  const percent = budget === 0 ? "" : ` (${sign}${Math.abs((difference / budget) * 100).toFixed(1)}%)`;
  return `${sign}${amount}${percent}`;
}

function valueOrigin(input: MeasureOriginInput): MeasureOrigin["value"] {
  const { source, observation, mapping, rows, period, names } = input;
  const when = isoDay(observation?.observedAt);
  if (source === "manual") {
    return { summary: "Entered by hand", details: [observation?.evidence, when && `Saved ${fmtLong(when)}`].filter((d): d is string => Boolean(d)) };
  }
  if (source === "import") {
    const document = observation ? documentLine(observation) : null;
    return { summary: "Published directly on this measure", details: [document, when && `Observed ${fmtLong(when)}`].filter((d): d is string => Boolean(d)) };
  }
  if (source === "derived" && mapping) {
    const details = requiredInputs(mapping).map(([key, basis]) => {
      const row = findInput(mapping, rows, period, key, basis) as KpiRow | undefined;
      const document = row ? documentLine(row) : null;
      return `${inputLabel(mapping, key, basis, names)} = ${row?.value ?? "—"}${document ? ` (${document})` : ""}`;
    });
    return { summary: CALCULATION_TEXT[mapping.calculation] ?? "Calculated from imported metrics.", details };
  }
  if (mapping) {
    const missing = missingMeasureInputs(mapping, rows, period, names);
    return { summary: "No value for this month", details: missing.length ? [`Waiting for ${missing.join("; ")}.`] : ["The inputs can't be calculated, for example a prior-year value of zero."] };
  }
  return { summary: "No value for this month", details: ["This measure isn't mapped to imported metrics."] };
}

export type MeasureOriginInput = {
  source: "manual" | "import" | "derived" | null;
  /** The observation on the measure itself, when it has one. */
  observation: Pick<KpiRow, "observedAt" | "sourceDocumentName" | "sourceLocation" | "evidence"> | null;
  /** The number the status compares with the target. */
  number: number | null;
  rag: Rag;
  target: string | null;
  mapping: (MeasureMapping & { active?: boolean }) | null;
  rows: RowsByMetric;
  names: ReadonlyMap<string, string>;
  period: string;
};

/** Where a measure's value came from and how its status was reached. */
export function measureOrigin(input: MeasureOriginInput): MeasureOrigin {
  const { number, rag, target, mapping } = input;
  const value = valueOrigin(input);
  const label = ragLabel(rag);
  if (!mapping) {
    const basis = target ? `Compared with the first number in the target text, "${target}". ${STATUS_RULE}` : "No target to compare with.";
    return { value, status: { label, budget: null, difference: null, verdict: null, direction: null, basis } };
  }
  const direction = mapping.higherIsBetter ? "Higher is better" : "Lower is better";
  if (mapping.targetBudget === null) return { value, status: { label, budget: null, difference: null, verdict: null, direction, basis: "No budget target is set on the mapping, so there's no rating." } };
  const budget = formatInUnits(mapping.targetBudget, mapping.displayFormat);
  if (number === null) return { value, status: { label, budget, difference: null, verdict: null, direction, basis: `No value to compare with the budget target. ${STATUS_RULE}` } };
  const difference = number - mapping.targetBudget;
  const verdict = difference === 0 ? "on target" : difference > 0 === mapping.higherIsBetter ? "better" : "worse";
  return {
    value,
    status: { label, budget, difference: formatDifference(difference, mapping.targetBudget, mapping.displayFormat), verdict, direction, basis: STATUS_RULE },
  };
}
