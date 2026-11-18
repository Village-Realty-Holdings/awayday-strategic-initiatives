import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { KpiObservationRecord } from "@/lib/kpi";
import {
  BASE_BUSINESS_LINES,
  BASE_BUSINESS_SCOPE,
  REPORTED_SCOPE,
  buildBrandChurn,
  buildExecCards,
  buildPillarScorecard,
  buildReportRows,
  buildTrendChart,
  currentPeriodRows,
  formatDelta,
  formatMetricValue,
  formatValueForKind,
  groupReportRows,
  metricKind,
  orderByCatalogue,
  parseNumber,
  parseTargetNumber,
  statusAgainstTarget,
  rowsForScope,
  scopeLabel,
  type ReportMetric,
  type ReportObservation,
  type TrendChartSpec,
} from "./review-report";

// Synthetic fixtures only. The shapes mirror KpiDefinition/KpiObservation; the
// amounts are invented so no private figure is committed.

const PERIOD = "2026-10";

function metric(overrides: Partial<ReportMetric> & Pick<ReportMetric, "id" | "name">): ReportMetric {
  return {
    metricKey: `user_review:${overrides.id}`,
    unit: "USD",
    displayFormat: "currency",
    target: null,
    strategicAreaId: null,
    areaCode: null,
    ...overrides,
  };
}

type ObservationOverrides = Partial<KpiObservationRecord> & Pick<KpiObservationRecord, "value"> & { kpiId: string };

function observation(overrides: ObservationOverrides): ReportObservation {
  return {
    reportingPeriod: PERIOD,
    observedAt: new Date("2026-11-05T12:00:00Z"),
    quality: "VALID",
    publicationState: "APPROVED",
    revision: 1,
    reportingScope: "BASE_BUSINESS",
    entityScope: "BASE_BUSINESS",
    comparisonBasis: "ACTUAL",
    timeBasis: "MONTHLY",
    entityId: null,
    ...overrides,
  } as ReportObservation;
}

const revenue = metric({ id: "rev", name: "Revenue", metricKey: "user_review:revenue" });
const costOfSales = metric({ id: "cos", name: "Cost of sales", metricKey: "user_review:cost_of_sales" });
const shopNoi = metric({ id: "noi", name: "Shop NOI", metricKey: "user_review:shop_noi" });
const shopNoiMargin = metric({ id: "noi-margin", name: "Shop NOI margin", metricKey: "user_review:shop_noi_margin", unit: "percent", displayFormat: "percent" });
const shopNoiMarginExOta = metric({ id: "noi-margin-ex", name: "Shop NOI margin (ex-OTA)", metricKey: "user_review:shop_noi_margin_ex_ota", unit: "percent", displayFormat: "percent" });
const adjustedEbitda = metric({ id: "ebitda", name: "Adjusted EBITDA", metricKey: "user_review:adjusted_ebitda" });
const lenderEbitda = metric({ id: "lender", name: "LTM Pro Forma Lender EBITDA", metricKey: "user_review:ltm_pro_forma_lender_ebitda" });
const trevpar = metric({ id: "trevpar", name: "TRevPAR", metricKey: "user_review:trevpar" });

describe("metric kind and formatting", () => {
  it("reads the declared unit, then falls back to the name", () => {
    expect(metricKind({ unit: "USD", displayFormat: "currency", name: "Revenue" })).toBe("currency");
    expect(metricKind({ unit: "percent", displayFormat: "percent", name: "Occupancy" })).toBe("percent");
    expect(metricKind({ unit: "percentage_points", displayFormat: "percent", name: "Shop NOI margin vs PY" })).toBe("points");
    expect(metricKind({ unit: null, displayFormat: null, name: "Annualized churn" })).toBe("percent");
    expect(metricKind({ unit: null, displayFormat: null, name: "Ending units" })).toBe("count");
  });

  it("shows millions for currency and keeps the sign", () => {
    expect(formatMetricValue(revenue, "136000000")).toBe("$136.0M");
    expect(formatMetricValue(revenue, "-1200000")).toBe("\u2212$1.2M");
    expect(formatMetricValue(revenue, 79900000)).toBe("$79.9M");
    expect(formatMetricValue(revenue, "3849474.21")).toBe("$3.8M");
  });

  it("never turns a percentage difference into a percentage", () => {
    expect(formatMetricValue({ unit: "percent", displayFormat: "percent", name: "Occupancy" }, "62.44")).toBe("62.4%");
    // A change between two percentages is percentage points.
    expect(formatDelta("percent", 2.4)).toBe("+2.4 pp");
    expect(formatDelta("points", -0.25)).toBe("\u22120.25 pp");
    expect(formatDelta("currency", -1200000)).toBe("\u2212$1.2M");
    expect(formatDelta("count", 12)).toBe("+12");
  });

  it("parses formatted numbers and rejects text", () => {
    expect(parseNumber("1,204")).toBe(1204);
    expect(parseNumber("(1.5)")).toBe(-1.5);
    expect(parseNumber("\u22123.8")).toBe(-3.8);
    expect(parseNumber("n/a")).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
});

describe("target parsing and status", () => {
  it("scales a currency target to the observation's base units", () => {
    expect(parseTargetNumber("$26M")).toEqual({ value: 26_000_000, lowerIsBetter: false });
    expect(parseTargetNumber("$1.2B")).toEqual({ value: 1_200_000_000, lowerIsBetter: false });
    expect(parseTargetNumber("<11%")).toEqual({ value: 11, lowerIsBetter: true });
    expect(parseTargetNumber("1,200")).toEqual({ value: 1200, lowerIsBetter: false });
  });

  it("refuses a prose target rather than compare against the wrong number", () => {
    expect(parseTargetNumber("23% budget; 28% stretch")).toBeNull();
    expect(parseTargetNumber("TBD")).toBeNull();
    expect(parseTargetNumber("$26M total; $11M via tuck-ins")).toBeNull();
    expect(parseTargetNumber(null)).toBeNull();
  });

  it("rates a value in the target's unit and direction", () => {
    // $26.0M against a $26M target is at target, not a $26-vs-$26,000,000 comparison.
    expect(statusAgainstTarget("26000000", "$26M")).toBe("on_track");
    expect(statusAgainstTarget("30000000", "$26M")).toBe("ahead");
    expect(statusAgainstTarget("20000000", "$26M")).toBe("behind");
    expect(statusAgainstTarget("12.7", "<11%")).toBe("behind");
    expect(statusAgainstTarget("10.5", "<11%")).toBe("on_track");
    expect(statusAgainstTarget("4", "5")).toBe("behind");
    expect(statusAgainstTarget(null, "5")).toBe("no_data");
    expect(statusAgainstTarget("4", "TBD")).toBe("no_data");
  });
});

describe("current observations", () => {
  it("keeps the stronger approved row for an identity and drops superseded or invalid rows", () => {
    const rows = [
      observation({ kpiId: "rev", value: "100", observedAt: new Date("2026-11-05T12:00:00Z") }),
      observation({ kpiId: "rev", value: "110", observedAt: new Date("2026-11-06T12:00:00Z") }),
      observation({ kpiId: "rev", value: "999", publicationState: "SUPERSEDED" }),
      observation({ kpiId: "rev", value: "999", quality: "INVALID" }),
      observation({ kpiId: "rev", value: "999", reportingPeriod: "2026-09" }),
    ];
    const current = currentPeriodRows(rows, PERIOD);
    expect(current).toHaveLength(1);
    expect(current[0].value).toBe("110");
  });

  it("keeps monthly and YTD facts apart even though they share a metric", () => {
    const rows = [
      observation({ kpiId: "rev", value: "100", timeBasis: "MONTHLY" }),
      observation({ kpiId: "rev", value: "900", timeBasis: "YTD" }),
    ];
    expect(currentPeriodRows(rows, PERIOD)).toHaveLength(2);
  });
});

describe("report table", () => {
  const rows = [
    observation({ kpiId: "rev", value: "1000000", timeBasis: "MONTHLY", comparisonBasis: "ACTUAL" }),
    observation({ kpiId: "rev", value: "1200000", timeBasis: "MONTHLY", comparisonBasis: "BUDGET" }),
    observation({ kpiId: "rev", value: "900000", timeBasis: "MONTHLY", comparisonBasis: "PRIOR_YEAR" }),
    observation({ kpiId: "rev", value: "8000000", timeBasis: "YTD", comparisonBasis: "ACTUAL" }),
    observation({ kpiId: "rev", value: "7500000", timeBasis: "YTD", comparisonBasis: "BUDGET" }),
    observation({ kpiId: "cos", value: "-400000", timeBasis: "MONTHLY", comparisonBasis: "ACTUAL" }),
  ];
  const metrics = [revenue, costOfSales];

  it("separates the month from year to date and budget from prior year", () => {
    const revenueRow = buildReportRows(metrics, rows).find((row) => row.id === "user_review:revenue")!;
    expect(revenueRow.monthActual.display).toBe("$1.0M");
    expect(revenueRow.monthVsBudget.display).toBe("\u2212$200K");
    expect(revenueRow.monthVsPriorYear.display).toBe("+$100K");
    expect(revenueRow.ytdActual.display).toBe("$8.0M");
    expect(revenueRow.ytdVsBudget.display).toBe("+$500K");
    // No YTD prior year was loaded, so the cell stays empty rather than reusing budget.
    expect(revenueRow.ytdVsPriorYear.display).toBeNull();
  });

  it("shows a negative value with its sign and no invented comparison", () => {
    const costRow = buildReportRows(metrics, rows).find((row) => row.id === "user_review:cost_of_sales")!;
    expect(costRow.monthActual.display).toBe("\u2212$400K");
    expect(costRow.monthVsBudget.display).toBeNull();
    expect(costRow.ytdActual.display).toBeNull();
  });

  it("never mixes populations", () => {
    const mixed = [
      ...rows,
      observation({ kpiId: "rev", value: "5000000", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" }),
    ];
    const base = buildReportRows(metrics, rowsForScope(mixed, PERIOD, BASE_BUSINESS_SCOPE));
    const reported = buildReportRows(metrics, rowsForScope(mixed, PERIOD, REPORTED_SCOPE));
    expect(base.find((row) => row.id === "user_review:revenue")!.monthActual.display).toBe("$1.0M");
    expect(reported.find((row) => row.id === "user_review:revenue")!.monthActual.display).toBe("$5.0M");
    expect(scopeLabel(BASE_BUSINESS_SCOPE)).toBe("Base Business");
    expect(scopeLabel(REPORTED_SCOPE)).toBe("Finance reported");
  });

  it("orders known Base Business lines and keeps unknown metrics visible", () => {
    const extra = metric({ id: "other", name: "A brand new measure" });
    const table = buildReportRows([revenue, costOfSales, shopNoi, shopNoiMargin, shopNoiMarginExOta, extra], [
      observation({ kpiId: "rev", value: "1" }),
      observation({ kpiId: "cos", value: "2" }),
      observation({ kpiId: "noi", value: "3" }),
      observation({ kpiId: "noi-margin", value: "4" }),
      observation({ kpiId: "noi-margin-ex", value: "5" }),
      observation({ kpiId: "other", value: "6" }),
    ]);
    const ordered = orderByCatalogue(table, BASE_BUSINESS_LINES);
    expect(ordered.map((row) => row.label)).toEqual([
      "Revenue",
      "Cost of sales",
      "Shop NOI",
      "Shop NOI margin (reported)",
      "Shop NOI margin (ex-OTA)",
      "A brand new measure",
    ]);
    // The ex-OTA line is not swallowed by the generic Shop NOI line.
    expect(ordered.filter((row) => row.label === "Shop NOI")).toHaveLength(1);
  });

  it("groups operating metrics into families without merging definitions", () => {
    const rows = buildReportRows(
      [
        metric({ id: "t1", name: "TRevPAR reported" }),
        metric({ id: "t2", name: "TRevPAR ex-OTA" }),
        metric({ id: "c1", name: "Annualized churn", unit: "percent" }),
        metric({ id: "u1", name: "Net unit adds" }),
      ],
      [
        observation({ kpiId: "t1", value: "1" }),
        observation({ kpiId: "t2", value: "2" }),
        observation({ kpiId: "c1", value: "3" }),
        observation({ kpiId: "u1", value: "4" }),
      ],
    );
    const groups = groupReportRows(rows);
    expect(groups.map((group) => group.id)).toEqual(["trevpar", "units", "churn"]);
    expect(groups.find((group) => group.id === "trevpar")!.rows.map((row) => row.label)).toEqual(["TRevPAR ex-OTA", "TRevPAR reported"]);
  });
});

describe("executive summary cards", () => {
  it("finds each headline figure in its own population", () => {
    const metrics = [adjustedEbitda, lenderEbitda, shopNoi];
    const rows = [
      observation({ kpiId: "ebitda", value: "-1200000", timeBasis: "MONTHLY", comparisonBasis: "ACTUAL" }),
      observation({ kpiId: "ebitda", value: "-1000000", timeBasis: "MONTHLY", comparisonBasis: "BUDGET" }),
      observation({ kpiId: "ebitda", value: "79900000", timeBasis: "YTD", comparisonBasis: "ACTUAL" }),
      observation({ kpiId: "lender", value: "136000000", timeBasis: "LTM", comparisonBasis: "ACTUAL", reportingScope: "BASE_BUSINESS", entityScope: "BASE_BUSINESS" }),
      observation({ kpiId: "noi", value: "3800000", timeBasis: "MONTHLY", comparisonBasis: "ACTUAL" }),
      observation({ kpiId: "noi", value: "3600000", timeBasis: "MONTHLY", comparisonBasis: "PRIOR_YEAR" }),
    ];
    const cards = buildExecCards(metrics, rows, PERIOD);
    expect(cards.map((card) => card.title)).toEqual(["Adjusted EBITDA", "Adjusted EBITDA · YTD", "LTM Pro Forma Lender EBITDA", "Shop NOI"]);
    expect(cards[0].value).toBe("\u2212$1.2M");
    expect(cards[0].delta.display).toBe("\u2212$200K");
    expect(cards[0].deltaLabel).toBe("vs budget");
    expect(cards[1].value).toBe("$79.9M");
    expect(cards[2].value).toBe("$136.0M");
    expect(cards[2].scopeLabel).toBe("Base Business");
    expect(cards[3].value).toBe("$3.8M");
    expect(cards[3].deltaLabel).toBe("vs prior year");
  });

  it("does not fill a Base Business card from the consolidated population", () => {
    const cards = buildExecCards(
      [adjustedEbitda],
      [observation({ kpiId: "ebitda", value: "5000", reportingScope: "AWAYDAY_CONSOLIDATED", entityScope: "CONSOLIDATED" })],
      PERIOD,
    );
    expect(cards[0].value).toBeNull();
    expect(cards[0].expected).toBe("Monthly actual · Adjusted EBITDA · Base Business");
    // The badge names the population the card is about; the value stays empty.
    expect(cards[0].scopeLabel).toBe("Base Business");
    expect(cards[0].metricName).toBeNull();
  });

  it("names the missing identity instead of showing a number", () => {
    const cards = buildExecCards([], [], PERIOD);
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.value).toBeNull();
      expect(card.expected.length).toBeGreaterThan(10);
    }
  });
});

describe("pillar scorecards", () => {
  const area = { id: "area-ma", code: "M&A", name: "M&A" };
  const acquired = metric({
    id: "acq",
    name: "Acquired EBITDA closed",
    metricKey: "user_review:acquired_ebitda_closed",
    unit: "USD",
    target: "$26M",
  });
  const expectations = [
    acquired,
    metric({ id: "loi", name: "Active LOI pipeline", metricKey: "user_review:active_loi_pipeline", unit: "count", target: "5" }),
  ].map((definition) => ({ ...definition, strategicAreaId: "area-ma" }));

  it("lists loaded metrics and marks the expected lines that are missing", () => {
    const rows = [observation({ kpiId: "acq", value: "26000000" }), observation({ kpiId: "loi", value: "4" })];
    const scorecard = buildPillarScorecard(area, expectations, rows, PERIOD);
    expect(scorecard.loaded).toBe(2);
    // The M&A expectation list has ten lines; two are loaded.
    expect(scorecard.expectedMissing).toBe(8);
    expect(scorecard.rows.filter((row) => row.expectedOnly).map((row) => row.label)).toContain("Tuck-in EBITDA");
    expect(scorecard.rows.find((row) => row.label === "Acquired EBITDA closed")!.value).toBe("$26.0M");
    // 4 against a target of 5 is 20% short, outside the 10% "near target" band.
    expect(scorecard.rows.find((row) => row.label === "Active LOI pipeline")!.status).toBe("behind");
  });

  it("gives a narrow expectation the row a broad one would otherwise claim", () => {
    const areaT = { id: "area-t", code: "TREVPAR", name: "TRevPAR Expansion" };
    const definitions = [
      { ...trevpar, strategicAreaId: "area-t" },
      { ...metric({ id: "trevpar-ex", name: "TRevPAR ex-OTA", metricKey: "user_review:trevpar_ex_ota" }), strategicAreaId: "area-t" },
    ];
    const scorecard = buildPillarScorecard(areaT, definitions, [observation({ kpiId: "trevpar", value: "100" }), observation({ kpiId: "trevpar-ex", value: "90" })], PERIOD);
    const loaded = scorecard.rows.filter((row) => !row.expectedOnly).map((row) => row.label);
    expect(loaded).toContain("TRevPAR ex-OTA");
    expect(scorecard.rows.filter((row) => row.expectedOnly).map((row) => row.label)).not.toContain("TRevPAR ex-OTA");
  });

  it("fills a pillar scorecard from unlinked reviewed metrics by their identity", () => {
    // The definition has no strategicAreaId; the M&A scorecard still finds it by name.
    const unlinked = { ...expectations[0], strategicAreaId: null };
    const scorecard = buildPillarScorecard({ id: null, code: "M&A", name: "M&A" }, [unlinked], [observation({ kpiId: "acq", value: "26000000" })], PERIOD);
    expect(scorecard.loaded).toBe(1);
    expect(scorecard.rows.find((row) => row.label === "Acquired EBITDA closed")!.value).toBe("$26.0M");
  });

  it("does not re-attribute a metric linked to another area", () => {
    const other = { ...expectations[0], id: "someone-elses", strategicAreaId: "area-other" };
    const scorecard = buildPillarScorecard({ id: null, code: "M&A", name: "M&A" }, [other], [observation({ kpiId: "someone-elses", value: "1" })], PERIOD);
    expect(scorecard.loaded).toBe(0);
  });

  it("has no rows for an area nothing is linked to", () => {
    const scorecard = buildPillarScorecard({ id: null, code: "UNKNOWN", name: "Unknown" }, [expectations[0]], [], PERIOD);
    expect(scorecard.loaded).toBe(0);
    expect(scorecard.rows).toHaveLength(0);
  });
});

describe("historical series", () => {
  const spec: TrendChartSpec = {
    id: "test",
    title: "Test series",
    description: "",
    series: [{ key: "lender", label: "Lender", match: (definition) => /lender/.test(definition.name.toLowerCase()), timeBasis: "LTM", scope: null }],
  };

  it("orders months chronologically and flags a restated point", () => {
    const rows = [
      observation({ kpiId: "lender", value: "3", timeBasis: "LTM", reportingPeriod: "2026-10", revision: 2 }),
      observation({ kpiId: "lender", value: "1", timeBasis: "LTM", reportingPeriod: "2025-12" }),
      observation({ kpiId: "lender", value: "2", timeBasis: "LTM", reportingPeriod: "2026-01" }),
    ];
    const chart = buildTrendChart(spec, [lenderEbitda], rows);
    expect(chart.periods).toEqual(["2025-12", "2026-01", "2026-10"]);
    expect(chart.series[0].points.map((point) => point.period)).toEqual(["2025-12", "2026-01", "2026-10"]);
    expect(chart.series[0].points[2].restated).toBe(true);
  });

  it("keeps one point per month and ignores superseded history", () => {
    const rows = [
      observation({ kpiId: "lender", value: "1", timeBasis: "LTM", reportingPeriod: "2026-09" }),
      observation({ kpiId: "lender", value: "1.5", timeBasis: "LTM", reportingPeriod: "2026-09", observedAt: new Date("2026-11-07T12:00:00Z") }),
      observation({ kpiId: "lender", value: "999", timeBasis: "LTM", reportingPeriod: "2026-08", publicationState: "SUPERSEDED" }),
    ];
    const chart = buildTrendChart(spec, [lenderEbitda], rows);
    expect(chart.series[0].points).toHaveLength(1);
    expect(chart.series[0].points[0].value).toBe(1.5);
  });

  it("never mixes two populations in one series", () => {
    const rows = [
      observation({ kpiId: "lender", value: "1", timeBasis: "LTM", reportingPeriod: "2026-09" }),
      observation({ kpiId: "lender", value: "9", timeBasis: "LTM", reportingPeriod: "2026-10", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" }),
    ];
    const chart = buildTrendChart(spec, [lenderEbitda], rows);
    // The series picks one population (the one with most points) and stays there.
    expect(new Set(chart.series.map((series) => series.scopeLabel)).size).toBe(1);
    expect(chart.series[0].points.every((point) => [1].includes(point.value))).toBe(true);
  });

  it("returns no series when nothing matches", () => {
    const chart = buildTrendChart(spec, [revenue], [observation({ kpiId: "rev", value: "1" })]);
    expect(chart.series).toHaveLength(0);
    expect(chart.periods).toHaveLength(0);
  });
});

describe("brand churn", () => {
  const definitions = [
    metric({ id: "bookable", name: "Bookable units" }),
    metric({ id: "month", name: "Churned units" }),
    metric({ id: "annual", name: "Annualized churn", unit: "percent" }),
    metric({ id: "ltm-units", name: "LTM churned units" }),
    metric({ id: "ltm-pct", name: "LTM churn %", unit: "percent" }),
  ];
  const brandRow = (kpiId: string, value: string, brand: string, scope: "BASE_BUSINESS" | "USER_REVIEWED_REPORTED" = "BASE_BUSINESS") =>
    observation({
      kpiId,
      value,
      entityId: brand,
      entityScope: "BRAND",
      reportingScope: scope,
      timeBasis: "MONTHLY",
    });

  it("builds a row per brand and reads the LTM count as LTM, not as the month", () => {
    const churn = buildBrandChurn(definitions, [
      brandRow("bookable", "100", "Brand A"),
      brandRow("month", "2", "Brand A"),
      brandRow("annual", "24", "Brand A"),
      brandRow("ltm-units", "30", "Brand A"),
      brandRow("ltm-pct", "12.5", "Brand A"),
      brandRow("bookable", "50", "Brand B"),
      brandRow("month", "1", "Brand B"),
    ], PERIOD);

    expect(churn.rows.map((row) => row.brand)).toEqual(["Brand A", "Brand B"]);
    const a = churn.rows[0];
    expect(a.bookableUnits).toBe(100);
    expect(a.monthChurned).toBe(2);
    expect(a.ltmChurned).toBe(30);
    expect(a.ltmPct).toBe(12.5);
    expect(churn.totals).toEqual({ brands: 2, bookableUnits: 150, monthChurned: 3, ltmChurned: 30 });
    expect(churn.totals).not.toHaveProperty("ltmPct");
  });

  it("lists no brands and no totals when no entity-level rows exist", () => {
    const churn = buildBrandChurn(definitions, [observation({ kpiId: "bookable", value: "100" })], PERIOD);
    expect(churn.rows).toHaveLength(0);
    expect(churn.totals.brands).toBe(0);
    expect(churn.totals.bookableUnits).toBeNull();
  });

  it("keeps two populations visible when they are present", () => {
    const churn = buildBrandChurn(definitions, [
      brandRow("bookable", "100", "Brand A"),
      brandRow("bookable", "50", "Brand C", "USER_REVIEWED_REPORTED"),
    ], PERIOD);
    expect(churn.scopeLabels).toEqual(["Base Business", "Finance reported"]);
  });

  it("never blends one brand's columns across two populations, and adds up no total across them", () => {
    const churn = buildBrandChurn(definitions, [
      brandRow("bookable", "100", "Brand A"),
      brandRow("month", "2", "Brand A"),
      // Same brand name, different population: its own row, not a merge.
      brandRow("bookable", "40", "Brand A", "USER_REVIEWED_REPORTED"),
      brandRow("ltm-units", "99", "Brand A", "USER_REVIEWED_REPORTED"),
    ], PERIOD);

    expect(churn.rows).toHaveLength(2);
    expect(churn.totalsMixed).toBe(true);
    expect(churn.rows[0]).toMatchObject({ brand: "Brand A", scopeLabel: "Base Business", bookableUnits: 100, monthChurned: 2, ltmChurned: null });
    expect(churn.rows[1]).toMatchObject({ brand: "Brand A", scopeLabel: "Finance reported", bookableUnits: 40, monthChurned: null, ltmChurned: 99 });
    // A count summed across two populations would double count Brand A.
    expect(churn.totals.bookableUnits).toBeNull();
    expect(churn.totals.monthChurned).toBeNull();
    expect(churn.totals.ltmChurned).toBeNull();
    expect(churn.totals.brands).toBe(1);
  });

  it("ignores a non-actual brand row rather than letting it overwrite the actual", () => {
    const churn = buildBrandChurn(definitions, [
      brandRow("bookable", "100", "Brand A"),
      observation({ kpiId: "bookable", value: "500", entityId: "Brand A", entityScope: "BRAND", timeBasis: "MONTHLY", comparisonBasis: "BUDGET" }) as ReportObservation,
    ], PERIOD);
    expect(churn.rows[0].bookableUnits).toBe(100);
    expect(churn.totalsMixed).toBe(false);
  });
});

describe("review presentation guard rails", () => {
  const root = join(__dirname, "..");

  it("keeps the review page behind the app guard", () => {
    const page = readFileSync(join(root, "app/(app)/page.tsx"), "utf8");
    expect(page).toMatch(/requireApp\("initiatives"\)/);
  });

  it("never renders reviewed content as raw HTML", () => {
    for (const file of ["components/review/report-sections.tsx", "components/review/pillar-scorecard.tsx", "components/review/brand-churn-table.tsx", "components/review/trend-chart.tsx"]) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });

  it("contains no business figures in the presentation rules", () => {
    // Metric identities and thresholds are allowed; money or percentages as
    // literals in the report module would be hardcoded business data.
    const source = readFileSync(join(root, "lib/review-report.ts"), "utf8")
      // Comments carry formatting examples; only executable code matters here.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(source).not.toMatch(/(?<![\w$.])\d{1,3}(,\d{3})+(\.\d+)?/);
    // A hardcoded amount would read like "$1.2M" or "$26,000".
    expect(source).not.toMatch(/\$\d[\d,.]*[KMB]\b/);
  });

  it("exports a single formatter for each metric kind", () => {
    expect(formatValueForKind("count", 1204)).toBe("1,204");
    expect(formatValueForKind("percent", 62.44)).toBe("62.4%");
  });
});
