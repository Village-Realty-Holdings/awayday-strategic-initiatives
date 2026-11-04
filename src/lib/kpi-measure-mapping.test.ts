import { describe, expect, it } from "vitest";
import { deriveMeasure, formatDerivedMeasure, mappingRag, measureOrigin, missingMeasureInputs, parseMeasureNumber, type MeasureMapping, type MeasureOriginInput } from "./kpi-measure-mapping";
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

describe("mappingRag", () => {
  it("treats lower as better when the mapping says so, unlike the target text", () => {
    const churn = { higherIsBetter: false, targetBudget: 11 };
    expect(mappingRag(9, churn)).toBe("GREEN");
    expect(mappingRag(10.5, churn)).toBe("AMBER");
    expect(mappingRag(11.5, churn)).toBe("AMBER");
    expect(mappingRag(12.9, churn)).toBe("RED");
  });

  it("is grey without a value or target and amber when stale", () => {
    expect(mappingRag(null, { higherIsBetter: true, targetBudget: 1 })).toBe("GREY");
    expect(mappingRag(5, { higherIsBetter: true, targetBudget: null })).toBe("GREY");
    expect(mappingRag(5, { higherIsBetter: true, targetBudget: 1 }, "STALE")).toBe("AMBER");
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
  const base: MeasureOriginInput = { source: "manual", observation: { observedAt: new Date("2026-11-04T12:00:00Z"), evidence: "Entered on the review by Erin" }, number: 34_500_000, rag: "GREEN", target: "$26M", mapping: mapping({ calculation: "DIRECT", displayFormat: "currency", targetBudget: 26_000_000 }), rows: new Map(), names: new Map(), period: PERIOD };

  it("shows who entered a value and how far it is from budget", () => {
    const origin = measureOrigin(base);
    expect(origin.value).toEqual({ summary: "Entered by hand", details: ["Entered on the review by Erin", "Saved 4 Nov 2026"] });
    expect(origin.status).toMatchObject({ label: "On track", budget: "$26.0M", difference: "+$8.5M (+32.7%)", verdict: "better", direction: "Higher is better" });
  });

  it("calls a higher value worse when lower is better", () => {
    const origin = measureOrigin({ ...base, number: 12.4, rag: "RED", mapping: mapping({ calculation: "DIRECT", higherIsBetter: false, targetBudget: 11 }) });
    expect(origin.status).toMatchObject({ budget: "11%", difference: "+1.4 pts (+12.7%)", verdict: "worse", direction: "Lower is better" });
  });

  it("lists each input and its source cell for a calculated value", () => {
    const rows = new Map([["trevpar", [row("136.30", "ACTUAL", { sourceDocumentName: "Sept.xlsx", sourceLocation: "sheet:Base Shop!B378" } as Partial<KpiRow>), row("133.00", "PRIOR_YEAR")]]]);
    const origin = measureOrigin({ ...base, source: "derived", observation: null, number: 2.48, mapping: mapping(), rows, names: new Map([["trevpar", "TRevPAR"]]) });
    expect(origin.value.summary).toContain("Growth vs prior year");
    expect(origin.value.details).toEqual(["TRevPAR: YTD Actual = 136.30 (Sept.xlsx · Base Shop!B378)", "TRevPAR: YTD PY = 133.00"]);
  });

  it("says what is missing when there's no value, and gives no difference", () => {
    const origin = measureOrigin({ ...base, source: null, observation: null, number: null, rag: "GREY", mapping: mapping(), names: new Map([["trevpar", "TRevPAR"]]) });
    expect(origin.value.details[0]).toContain("TRevPAR: YTD Actual");
    expect(origin.status.difference).toBeNull();
  });
});
