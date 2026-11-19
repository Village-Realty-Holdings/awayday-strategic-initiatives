import { CONSOLIDATED_REPORTING_SCOPE, selectCurrentObservations } from "@/lib/kpi";
import { BASIS_LABEL, formatKpiValue, TIME_LABEL, type KpiRow } from "@/lib/review-kpi";
import { fmtLong, isoDay, ragAgainst, ragLabel, STATUS_GAP_TEXT, type MeasureOrigin, type MeasureStatusGap, type Rag } from "@/lib/review-model";
import { sameQuantity } from "@/lib/review-format";

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
  /** true = higher is better, false = lower is better, null = not stated (neutral). */
  higherIsBetter: boolean | null;
  targetBudget: number | null;
  /** FY27 stretch, shown for context beside the budget; never a review status. */
  targetStretch?: number | null;
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

/**
 * The figure a status is judged against, and what that figure is. The reviewed
 * October report judges each pillar against its **2026 goal** and shows the FY27
 * budget and stretch beside it; the mapping's own `targetBudget` is FY27
 * planning data. Keeping the reference explicit is what stops an October status
 * from being decided by an FY27 number.
 */
export type StatusReference = { value: number; label: string; lowerIsBetter?: boolean };

/**
 * Why a review status could not be established. The reviewed report states its
 * own rule — "Pillar status is judged against the 2026 goal; FY27 shows budget /
 * stretch from the 12 Nov board pre-read" — so when that goal cannot be
 * established the pillar has no status. It does not inherit one from an FY27
 * figure, and it is never coloured on a comparison the report does not make.
 */
export type StatusGap = MeasureStatusGap;

/** A value rated against a target in the target's own direction. Pure arithmetic. */
export function ragAgainstTarget(value: number, target: number, higherIsBetter: boolean): Rag {
  // Expenses are reported as negative numbers. For a lower-is-better metric
  // whose target is negative, "less negative" is better, so the comparison is
  // on magnitude (-14 against -15 is 1 less spend, which is an improvement).
  // Without this, a negative-budget expense mapping would rate every reduction
  // as worse. Positive targets, and higher-is-better metrics (including a
  // negative EBITDA budget), keep the plain comparison.
  const lowerIsBetter = !higherIsBetter;
  if (lowerIsBetter && target < 0) return ragAgainst(Math.abs(value), Math.abs(target), true);
  return ragAgainst(value, target, lowerIsBetter);
}

/**
 * The October review status: the value against the definition's **2026 goal**,
 * in the mapping's declared direction and reporting basis.
 *
 * There is deliberately no fallback. A pillar whose 2026 goal is absent,
 * unreadable, or written in another quantity gets `GREY` — never a green, amber
 * or red inherited from the FY27 budget, which is a different statement (the
 * board pre-read's planning figures, shown for context only). An undeclared
 * direction, or a mapping that names no reporting basis, is also `GREY`: a
 * status is only claimed when the comparison the report makes can actually be
 * made.
 *
 * A status set by hand (`ReviewPillarStatus`) is applied by the caller after
 * this, and remains authoritative.
 */
export function mappingRag(
  value: number | null,
  mapping: Pick<MeasureMapping, "higherIsBetter" | "timeBasis">,
  quality = "VALID",
  goal: StatusReference | null = null,
): Rag {
  if (mapping.higherIsBetter === null) return "GREY";
  if (!(MAPPING_TIME_BASES as readonly string[]).includes(mapping.timeBasis)) return "GREY";
  if (goal === null || !Number.isFinite(goal.value)) return "GREY";
  if (value === null || !Number.isFinite(value)) return "GREY";
  if (quality === "UNAVAILABLE" || quality === "INVALID") return "GREY";
  // A target and a value in different quantities are not a comparison. The goal
  // may be a percentage while the measure is a unit count (Grow: 3,340 units
  // against a 23% growth goal); claiming green from that ratio would be worse
  // than claiming nothing.
  if (!sameQuantity(value, goal.value)) return "GREY";
  if (quality === "STALE") return "AMBER";
  return ragAgainstTarget(value, goal.value, mapping.higherIsBetter);
}

/** Why a review status could not be established, or null when one was. */
export function statusGap(
  value: number | null,
  mapping: Pick<MeasureMapping, "higherIsBetter" | "timeBasis">,
  quality = "VALID",
  goal: StatusReference | null = null,
): StatusGap | null {
  if (mapping.higherIsBetter === null) return "no-direction";
  if (!(MAPPING_TIME_BASES as readonly string[]).includes(mapping.timeBasis)) return "no-basis";
  if (goal === null || !Number.isFinite(goal.value)) return "no-goal";
  if (value === null || !Number.isFinite(value)) return "no-value";
  if (quality === "UNAVAILABLE" || quality === "INVALID") return "no-value";
  if (!sameQuantity(value, goal.value)) return "goal-not-comparable";
  return null;
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
  return { summary: "No value for this month", details: [] };
}

function calculatedOrigin({ calculatedValue, mapping, rows, period, names }: MeasureOriginInput): MeasureOrigin["calculated"] {
  if (calculatedValue) return { value: calculatedValue, note: null };
  if (!mapping) return { value: null, note: "This measure isn't mapped to imported metrics." };
  const missing = missingMeasureInputs(mapping, rows, period, names);
  return { value: null, note: missing.length ? `Waiting for ${missing.join("; ")}.` : "The inputs can't be calculated, for example a prior-year value of zero." };
}

export type MeasureOriginInput = {
  source: "manual" | "import" | "derived" | null;
  /** The observation on the measure itself, when it has one. */
  observation: Pick<KpiRow, "observedAt" | "sourceDocumentName" | "sourceLocation" | "evidence"> | null;
  /** The number the status compares with the target. */
  number: number | null;
  /** What the mapped inputs work out to, formatted, even when another value is showing. */
  calculatedValue?: string | null;
  rag: Rag;
  target: string | null;
  mapping: (MeasureMapping & { active?: boolean }) | null;
  /**
   * The figure the status is judged against: the definition's 2026 goal. There
   * is no fallback to the mapping's FY27 budget.
   */
  reference?: StatusReference | null;
  /** Why no status is claimed, when one is not. */
  gap?: StatusGap | null;
  rows: RowsByMetric;
  names: ReadonlyMap<string, string>;
  period: string;
};

/** Where a measure's value came from and how its status was reached. */
export function measureOrigin(input: MeasureOriginInput): MeasureOrigin {
  const { number, rag, target, mapping, reference, gap } = input;
  const value = valueOrigin(input);
  const calculated = calculatedOrigin(input);
  const label = ragLabel(rag, gap ?? null);
  if (!mapping) {
    const basis = target ? `Compared with the first number in the target text, "${target}". ${STATUS_RULE}` : "No target to compare with.";
    return { value, calculated, status: { label, budget: null, reference: null, context: null, gap: gap ?? null, difference: null, verdict: null, direction: null, basis } };
  }
  const direction = mapping.higherIsBetter === null ? null : mapping.higherIsBetter ? "Higher is better" : "Lower is better";
  // FY27 planning figures are context only. They are never the reference a
  // review status is judged against, so they are reported in their own field.
  const context = fy27Context(mapping);
  if (mapping.higherIsBetter === null || gap) {
    return {
      value,
      calculated,
      status: {
        label,
        budget: null,
        reference: null,
        context,
        gap: gap ?? "no-direction",
        difference: null,
        verdict: null,
        direction,
        basis: STATUS_GAP_TEXT[gap ?? "no-direction"],
      },
    };
  }
  if (!reference) {
    // Defensive: a status with no gap and no goal should not reach here, but if
    // it does the review claims nothing rather than falling back to FY27.
    return { value, calculated, status: { label, budget: null, reference: null, context, gap: "no-goal", difference: null, verdict: null, direction, basis: STATUS_GAP_TEXT["no-goal"] } };
  }
  const budget = formatInUnits(reference.value, mapping.displayFormat);
  if (number === null) return { value, calculated, status: { label, budget, reference: reference.label, context, gap: "no-value", difference: null, verdict: null, direction, basis: `No value to compare with the ${reference.label.toLowerCase()}.` } };
  const difference = number - reference.value;
  const verdict = difference === 0 ? "on target" : difference > 0 === Boolean(mapping.higherIsBetter) ? "better" : "worse";
  return {
    value,
    calculated,
    status: {
      label,
      budget,
      reference: reference.label,
      context,
      gap: null,
      difference: formatDifference(difference, reference.value, mapping.displayFormat),
      verdict,
      direction,
      basis: `Compared with the ${reference.label.toLowerCase()}, the figure this measure's definition states. ${STATUS_RULE}`,
    },
  };
}

/** "FY27 budget $26.0M · stretch $47.0M", or null when the mapping states neither. */
function fy27Context(mapping: Pick<MeasureMapping, "displayFormat" | "targetBudget" | "targetStretch">): string | null {
  const budget = mapping.targetBudget === null || mapping.targetBudget === undefined ? null : formatInUnits(mapping.targetBudget, mapping.displayFormat);
  const stretch = mapping.targetStretch === null || mapping.targetStretch === undefined ? null : formatInUnits(mapping.targetStretch, mapping.displayFormat);
  if (!budget && !stretch) return null;
  return [budget && `FY27 budget ${budget}`, stretch && `stretch ${stretch}`].filter((part): part is string => Boolean(part)).join(" · ");
}
