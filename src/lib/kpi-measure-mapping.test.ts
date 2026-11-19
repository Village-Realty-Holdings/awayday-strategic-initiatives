import { describe, expect, it } from "vitest";
import { deriveMeasure, formatDerivedMeasure, mappingRag, measureOrigin, missingMeasureInputs, parseMeasureNumber, ragAgainstTarget, statusGap, type MeasureMapping, type MeasureOriginInput } from "./kpi-measure-mapping";
import type { KpiRow } from "./review-kpi";

const PERIOD = "2026-09";

function row(value: string, comparisonBasis: string, overrides: Partial<KpiRow> = {}): KpiRow {
  return {
    kpiId: "k",
    value,
    reportingPeriod: PERIOD,
    observedAt: new Date("2026-09-30"),
    refreshedAt: new Date("2026-10-23"),
    quality: "VALID",
    publicationState: "APPROVED",
    revision: 1,
    reportingScope: "AWAYDAY_CONSOLIDATED",
    comparisonBasis,
    timeBasis: "YTD",
    entityScope: "CONSOLIDATED",
    entityId: "AWAYDAY_CONSOLIDATED",
    authorityRank: 15,
    ...overrides,
  } as KpiRow;
}

function mapping(overrides: Partial<MeasureMapping> = {}): MeasureMapping {
  return {
    calculation: "YOY_PCT",
    inputMetricKey: "trevpar",
    denominatorMetricKey: null,
    timeBasis: "YTD",
    displayFormat: "percent",
    higherIsBetter: true,
    targetBudget: 1,
    ...overrides,
  };
}

describe("deriveMeasure", () => {
  it("calculates year-on-year growth from the actual and prior-year rows", () => {
    const rows = new Map([["trevpar", [row("136.30", "ACTUAL"), row("133.00", "PRIOR_YEAR")]]]);
    expect(deriveMeasure(mapping(), rows, PERIOD)?.value).toBeCloseTo(2.481, 3);
  });

  it("returns nothing until every input is present", () => {
    expect(deriveMeasure(mapping(), new Map([["trevpar", [row("136.30", "ACTUAL")]]]), PERIOD)).toBeNull();
    expect(deriveMeasure(mapping({ inputMetricKey: null, calculation: "DIRECT" }), new Map(), PERIOD)).toBeNull();
  });

  it("never mixes time bases, periods or entities", () => {
    const monthlyPrior = row("133", "PRIOR_YEAR", { timeBasis: "MONTHLY" });
    const otherPeriod = row("133", "PRIOR_YEAR", { reportingPeriod: "2026-08" });
    const shop = row("133", "PRIOR_YEAR", { entityScope: "SHOP", entityId: "s1" });
    for (const prior of [monthlyPrior, otherPeriod, shop]) {
      expect(deriveMeasure(mapping(), new Map([["trevpar", [row("136", "ACTUAL"), prior]]]), PERIOD)).toBeNull();
    }
  });

  it("does not divide by a zero prior year", () => {
    expect(deriveMeasure(mapping(), new Map([["trevpar", [row("10", "ACTUAL"), row("0", "PRIOR_YEAR")]]]), PERIOD)).toBeNull();
  });

  it("calculates a ratio's change on prior year in percentage points", () => {
    const rows = new Map([
      ["noi", [row("30", "ACTUAL"), row("25", "PRIOR_YEAR")]],
      ["rev", [row("100", "ACTUAL"), row("100", "PRIOR_YEAR")]],
    ]);
    const result = deriveMeasure(mapping({ calculation: "RATIO_DELTA_PY", inputMetricKey: "noi", denominatorMetricKey: "rev" }), rows, PERIOD);
    expect(result?.value).toBeCloseTo(5, 6);
  });

  it("reads a direct value and marks the result stale when an input is", () => {
    const rows = new Map([["churn", [row("12.9", "ACTUAL", { quality: "STALE" })]]]);
    expect(deriveMeasure(mapping({ calculation: "DIRECT", inputMetricKey: "churn" }), rows, PERIOD)).toEqual({ value: 12.9, quality: "STALE" });
  });
});

describe("ragAgainstTarget — the arithmetic a status is made of", () => {
  it("treats lower as better when the caller says so", () => {
    expect(ragAgainstTarget(9, 11, false)).toBe("GREEN");
    expect(ragAgainstTarget(10.5, 11, false)).toBe("AMBER");
    expect(ragAgainstTarget(11.5, 11, false)).toBe("AMBER");
    expect(ragAgainstTarget(12.9, 11, false)).toBe("RED");
    expect(ragAgainstTarget(9, 11, true)).toBe("RED");
  });

  it("evaluates negative EBITDA in the declared higher-is-better direction", () => {
    // A wider loss is worse; a smaller loss is better. The sign of the values
    // must not flip the verdict.
    expect(ragAgainstTarget(-1_200_000, -1_000_000, true)).toBe("RED");
    expect(ragAgainstTarget(-800_000, -1_000_000, true)).toBe("GREEN");
  });

  it("evaluates negative expenses as less spend being better", () => {
    expect(ragAgainstTarget(-13, -15, false)).toBe("GREEN");
    expect(ragAgainstTarget(-15, -15, false)).toBe("AMBER");
    expect(ragAgainstTarget(-17, -15, false)).toBe("RED");
    // The same expense budget stored as a positive number reaches the same verdict.
    expect(ragAgainstTarget(13, 15, false)).toBe("GREEN");
    expect(ragAgainstTarget(17, 15, false)).toBe("RED");
  });

  it("compares percentage-point moves as points, not as a percentage change", () => {
    expect(ragAgainstTarget(0.8, 0.7, true)).toBe("GREEN");
    expect(ragAgainstTarget(0.6, 0.7, true)).toBe("RED");
  });
});

// The reviewed report states its own rule: "Pillar status is judged against the
// 2026 goal; FY27 shows budget / stretch from the 12 Nov board pre-read." These
// tests pin that rule, including every case where the goal cannot be used.
describe("mappingRag — the October status, judged against the 2026 goal only", () => {
  // Every mapping states its quantity through displayFormat, and every goal
  // states its own. Nothing here relies on the numbers looking similar.
  const MA = { higherIsBetter: true, timeBasis: "YTD", displayFormat: "currency" } as const;
  const GOAL_23M = { value: 23_000_000, label: "2026 goal", quantity: "currency" as const };

  it("judges the value by the 2026 goal the definition states", () => {
    // M&A: the board pre-read's FY27 budget is $26M; the 2026 goal is $23M. A
    // $24M year-to-date result is within 10% of the goal, so amber — and it is
    // ahead once it clears the goal by more than the tolerance.
    expect(mappingRag(24_000_000, MA, "VALID", GOAL_23M)).toBe("AMBER");
    expect(mappingRag(25_500_000, MA, "VALID", GOAL_23M)).toBe("GREEN");
    expect(mappingRag(20_000_000, MA, "VALID", GOAL_23M)).toBe("RED");
  });

  it("never falls back to an FY27 target when no 2026 goal is stated", () => {
    expect(mappingRag(24_000_000, MA, "VALID", null)).toBe("GREY");
    expect(mappingRag(34_800_000, MA, "VALID", null)).toBe("GREY");
    expect(mappingRag(24_000_000, MA)).toBe("GREY");
  });

  it("keeps the declared direction when a goal is supplied", () => {
    // Churn: 2026 goal 12%, and lower is better. The goal figure being different
    // from the FY27 budget must not flip the verdict.
    const churn = { higherIsBetter: false, timeBasis: "YTD", displayFormat: "percent" } as const;
    const goal12 = { value: 12, label: "2026 goal", quantity: "percent" as const };
    expect(mappingRag(12.4, churn, "VALID", goal12)).toBe("AMBER");
    expect(mappingRag(13.5, churn, "VALID", goal12)).toBe("RED");
    expect(mappingRag(10.5, churn, "VALID", goal12)).toBe("GREEN");
  });

  it("claims no status when the goal and the measure are in different quantities", () => {
    // Grow: a count measure against a 23% growth goal is not a comparison.
    const grow = { higherIsBetter: true, timeBasis: "YTD", displayFormat: "number" } as const;
    expect(mappingRag(3340, grow, "VALID", { value: 23, label: "2026 goal", quantity: "percent" }, "count")).toBe("GREY");
    // The same numbers in the same quantity are a comparison.
    expect(mappingRag(3340, grow, "VALID", { value: 2_608, label: "2026 goal", quantity: "count" }, "count")).toBe("GREEN");
  });

  it("never treats a percentage as a count just because the numbers are alike", () => {
    // 12% against 12 units: identical magnitudes, different quantities.
    const churn = { higherIsBetter: false, timeBasis: "YTD", displayFormat: "percent" } as const;
    expect(mappingRag(12, churn, "VALID", { value: 12, label: "2026 goal", quantity: "count" }, "percent")).toBe("GREY");
    // ... and currency against a count is likewise refused.
    expect(mappingRag(5, MA, "VALID", { value: 5, label: "2026 goal", quantity: "count" })).toBe("GREY");
  });

  it("compares percentage points only with percentage points", () => {
    const margin = { higherIsBetter: true, timeBasis: "YTD", displayFormat: "number" } as const;
    expect(mappingRag(0.8, margin, "VALID", { value: 0.7, label: "2026 goal", quantity: "points" }, "points")).toBe("GREEN");
    // A points measure against a percent goal is a different quantity.
    expect(mappingRag(0.8, margin, "VALID", { value: 0.7, label: "2026 goal", quantity: "percent" }, "points")).toBe("GREY");
  });

  it("stays neutral when a quantity is not stated on either side", () => {
    const bare = { higherIsBetter: true, timeBasis: "YTD", displayFormat: "number" } as const;
    const noQuantity = { value: 100, label: "2026 goal" };
    expect(mappingRag(120, bare, "VALID", noQuantity)).toBe("GREY");
    expect(mappingRag(120, bare, "VALID", { value: 100, label: "2026 goal", quantity: "count" })).toBe("GREY");
    expect(statusGap(120, bare, "VALID", { value: 100, label: "2026 goal", quantity: "count" })).toBe("goal-quantity-unknown");
  });

  it("never colours a measure when the mapping states no direction", () => {
    const unknown = { higherIsBetter: null, timeBasis: "YTD", displayFormat: "number" } as const;
    expect(mappingRag(120, unknown, "VALID", { value: 100, label: "2026 goal", quantity: "count" })).toBe("GREY");
    expect(mappingRag(80, unknown, "VALID", { value: 100, label: "2026 goal", quantity: "count" })).toBe("GREY");
    expect(mappingRag(100, unknown, "VALID", { value: 100, label: "2026 goal", quantity: "count" })).toBe("GREY");
  });

  it("claims no status when the mapping declares no reporting basis", () => {
    expect(mappingRag(25_000_000, { higherIsBetter: true, timeBasis: "", displayFormat: "currency" }, "VALID", GOAL_23M)).toBe("GREY");
    expect(mappingRag(25_000_000, { higherIsBetter: true, timeBasis: "QUARTERLY", displayFormat: "currency" }, "VALID", GOAL_23M)).toBe("GREY");
  });

  it("is grey with no value or an unusable one, and amber only when a status is otherwise claimable", () => {
    expect(mappingRag(null, MA, "VALID", GOAL_23M)).toBe("GREY");
    expect(mappingRag(Number.NaN, MA, "VALID", GOAL_23M)).toBe("GREY");
    expect(mappingRag(24_000_000, MA, "UNAVAILABLE", GOAL_23M)).toBe("GREY");
    expect(mappingRag(24_000_000, MA, "STALE", GOAL_23M)).toBe("AMBER");
    expect(mappingRag(24_000_000, MA, "STALE", null)).toBe("GREY");
  });

  it("keeps the magnitude guard as a second check inside one quantity", () => {
    // Both are currency, but $26 beside $26M is a parse error, not a result.
    expect(mappingRag(26, MA, "VALID", GOAL_23M)).toBe("GREY");
    expect(statusGap(26, MA, "VALID", GOAL_23M)).toBe("goal-not-comparable");
  });

  it("names why no status was claimed, so the review can say what to configure", () => {
    expect(statusGap(24_000_000, { higherIsBetter: null, timeBasis: "YTD", displayFormat: "currency" }, "VALID", GOAL_23M)).toBe("no-direction");
    expect(statusGap(24_000_000, { higherIsBetter: true, timeBasis: "", displayFormat: "currency" }, "VALID", GOAL_23M)).toBe("no-basis");
    expect(statusGap(24_000_000, MA, "VALID", null)).toBe("no-goal");
    expect(statusGap(3340, { higherIsBetter: true, timeBasis: "YTD", displayFormat: "number" }, "VALID", { value: 23, label: "2026 goal", quantity: "percent" }, "count")).toBe("goal-not-comparable");
    expect(statusGap(null, MA, "VALID", GOAL_23M)).toBe("no-value");
    expect(statusGap(24_000_000, MA, "VALID", GOAL_23M)).toBeNull();
  });
});

describe("parseMeasureNumber", () => {
  it("reads typed-in values in base units", () => {
    expect(parseMeasureNumber("$26M")).toBe(26_000_000);
    expect(parseMeasureNumber("12.9%")).toBe(12.9);
    expect(parseMeasureNumber("−0.4%")).toBe(-0.4);
    expect(parseMeasureNumber("+0.25")).toBe(0.25);
    expect(parseMeasureNumber("n/a")).toBeNull();
  });
});

describe("formatDerivedMeasure", () => {
  it("signs changes and keeps enough precision for small margin moves", () => {
    expect(formatDerivedMeasure(2.481, mapping())).toBe("+2.5%");
    expect(formatDerivedMeasure(-0.8, mapping())).toBe("-0.8%");
    expect(formatDerivedMeasure(0.25, mapping({ calculation: "RATIO_DELTA_PY" }))).toBe("+0.25%");
    expect(formatDerivedMeasure(12.9, mapping({ calculation: "DIRECT" }))).toBe("12.9%");
    expect(formatDerivedMeasure(26_000_000, mapping({ calculation: "DIRECT", displayFormat: "currency" }))).toBe("$26.0M");
  });
});

describe("missingMeasureInputs", () => {
  it("names exactly what is still needed", () => {
    const names = new Map([["trevpar", "TRevPAR"]]);
    expect(missingMeasureInputs(mapping({ inputMetricKey: null }), new Map(), PERIOD)).toEqual(["an input metric to be chosen"]);
    expect(missingMeasureInputs(mapping(), new Map([["trevpar", [row("136", "ACTUAL")]]]), PERIOD, names)).toEqual(["TRevPAR: YTD PY"]);
    expect(missingMeasureInputs(mapping(), new Map([["trevpar", [row("136", "ACTUAL"), row("133", "PRIOR_YEAR")]]]), PERIOD)).toEqual([]);
  });
});

describe("measureOrigin", () => {
  const base: MeasureOriginInput = {
    source: "manual",
    observation: { observedAt: new Date("2026-11-04T12:00:00Z"), evidence: "Entered on the review by Erin" },
    number: 25_500_000,
    rag: "GREEN",
    target: "2026 goal $23M · FY27 $26M budget · $47M stretch",
    mapping: mapping({ calculation: "DIRECT", displayFormat: "currency", targetBudget: 26_000_000, targetStretch: 47_000_000 }),
    reference: { value: 23_000_000, label: "2026 goal" },
    gap: null,
    rows: new Map(),
    names: new Map(),
    period: PERIOD,
  };

  it("shows who entered a value and how far it is from the 2026 goal", () => {
    const origin = measureOrigin(base);
    expect(origin.value).toEqual({ summary: "Entered by hand", details: ["Entered on the review by Erin", "Saved 4 Nov 2026"] });
    expect(origin.status).toMatchObject({ label: "Ahead", budget: "$23.0M", reference: "2026 goal", difference: "+$2.5M (+10.9%)", verdict: "better", direction: "Higher is better", gap: null });
    expect(origin.status.basis).toContain("2026 goal");
  });

  it("reports the FY27 budget and stretch as context, never as the yardstick", () => {
    expect(measureOrigin(base).status.context).toBe("FY27 budget $26.0M · stretch $47.0M");
  });

  it("claims no status and says why when no 2026 goal is stated", () => {
    const origin = measureOrigin({ ...base, reference: null, gap: "no-goal", rag: "GREY" });
    expect(origin.status).toMatchObject({ label: "Not configured", budget: null, reference: null, difference: null, verdict: null, gap: "no-goal" });
    expect(origin.status.basis).toContain("No 2026 goal is stated");
    expect(origin.status.basis).toContain("context only");
    // The FY27 figures are still available, in their own field.
    expect(origin.status.context).toBe("FY27 budget $26.0M · stretch $47.0M");
  });

  it("calls a higher value worse when lower is better", () => {
    const origin = measureOrigin({ ...base, number: 12.4, rag: "RED", mapping: mapping({ calculation: "DIRECT", higherIsBetter: false, targetBudget: 11 }), reference: { value: 12, label: "2026 goal" } });
    expect(origin.status).toMatchObject({ budget: "12%", difference: "+0.4 pts (+3.3%)", verdict: "worse", direction: "Lower is better" });
  });

  it("claims no status when the mapping states no direction", () => {
    const origin = measureOrigin({ ...base, rag: "GREY", gap: "no-direction", mapping: mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: null, targetBudget: 26_000_000 }) });
    expect(origin.status).toMatchObject({ label: "Not configured", budget: null, difference: null, verdict: null, direction: null, gap: "no-direction" });
    expect(origin.status.basis).toContain("does not state which direction is better");
  });

  it("reports the calculated value even when another value is showing", () => {
    expect(measureOrigin({ ...base, calculatedValue: "+2.5%" }).calculated).toEqual({ value: "+2.5%", note: null });
  });

  it("lists each input and its source cell for a calculated value", () => {
    const rows = new Map([["trevpar", [row("136.30", "ACTUAL", { sourceDocumentName: "Sept.xlsx", sourceLocation: "sheet:Base Shop!B378" } as Partial<KpiRow>), row("133.00", "PRIOR_YEAR")]]]);
    const origin = measureOrigin({ ...base, source: "derived", observation: null, number: 2.48, mapping: mapping(), rows, names: new Map([["trevpar", "TRevPAR"]]) });
    expect(origin.value.summary).toContain("Growth vs prior year");
    expect(origin.value.details).toEqual(["TRevPAR: YTD Actual = 136.30 (Sept.xlsx · Base Shop!B378)", "TRevPAR: YTD PY = 133.00"]);
  });

  it("says what is missing when there's no value, and gives no difference", () => {
    const origin = measureOrigin({ ...base, source: null, observation: null, number: null, rag: "GREY", gap: "no-value", mapping: mapping(), names: new Map([["trevpar", "TRevPAR"]]) });
    expect(origin.value).toEqual({ summary: "No value for this month", details: [] });
    expect(origin.calculated.value).toBeNull();
    expect(origin.calculated.note).toContain("TRevPAR: YTD Actual");
    expect(origin.status.difference).toBeNull();
    expect(origin.status.gap).toBe("no-value");
  });
});
