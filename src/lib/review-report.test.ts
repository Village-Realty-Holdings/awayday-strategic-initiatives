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
  isStrongerRow,
  metricKind,
  orderByCatalogue,
  parseNumber,
  parseTargetNumber,
  statusAgainstTarget,
  rowsForScope,
  scopeLabel,
  TREND_CHART_SPECS,
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
    expect(parseNumber("$69.4M")).toBe(69_400_000);
    expect(parseNumber("(1.2M)")).toBe(-1_200_000);
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

describe("observation authority", () => {
  const ranked = (authorityRank: number | null, overrides: Partial<ReportObservation> = {}) =>
    observation({ kpiId: "rev", value: "1", authorityRank, ...overrides });

  it("prefers the lower authority rank when both are populated", () => {
    expect(isStrongerRow(ranked(5), ranked(10))).toBe(true);
    expect(isStrongerRow(ranked(10), ranked(5))).toBe(false);
  });

  it("prefers a populated rank over a missing one, even when the unranked row is newer", () => {
    const rankedOlder = ranked(5, { observedAt: new Date("2026-11-01T00:00:00Z") });
    const unrankedNewer = ranked(null, { observedAt: new Date("2026-11-10T00:00:00Z") });
    expect(isStrongerRow(rankedOlder, unrankedNewer)).toBe(true);
    expect(isStrongerRow(unrankedNewer, rankedOlder)).toBe(false);
  });

  it("does not let an older but ranked candidate replace a newer unranked current row", () => {
    const rankedOlder = ranked(5, { observedAt: new Date("2026-11-01T00:00:00Z") });
    const unrankedNewer = ranked(null, { observedAt: new Date("2026-11-10T00:00:00Z") });
    expect(isStrongerRow(rankedOlder, unrankedNewer)).toBe(true);
  });

  it("falls back to observation time when neither row has a rank", () => {
    const older = ranked(null, { observedAt: new Date("2026-11-01T00:00:00Z") });
    const newer = ranked(null, { observedAt: new Date("2026-11-10T00:00:00Z") });
    expect(isStrongerRow(newer, older)).toBe(true);
    expect(isStrongerRow(older, newer)).toBe(false);
    // Both missing must not produce NaN/Infinity ordering: equal rows are not stronger.
    expect(isStrongerRow(older, { ...older })).toBe(false);
  });

  it("uses the refresh time when ranks and observation times are equal", () => {
    const at = new Date("2026-11-05T00:00:00Z");
    const older = ranked(5, { observedAt: at, refreshedAt: new Date("2026-11-06T00:00:00Z") });
    const newer = ranked(5, { observedAt: at, refreshedAt: new Date("2026-11-08T00:00:00Z") });
    expect(isStrongerRow(newer, older)).toBe(true);
    expect(isStrongerRow(older, newer)).toBe(false);
  });

  it("uses the revision when rank, observation and refresh times are equal", () => {
    const newerRevision = ranked(5, { revision: 2 });
    const olderRevision = ranked(5, { revision: 1 });
    expect(isStrongerRow(newerRevision, olderRevision)).toBe(true);
    expect(isStrongerRow(olderRevision, newerRevision)).toBe(false);
  });

  it("still drops superseded, unapproved and invalid rows before comparing", () => {
    const rows = [
      observation({ kpiId: "rev", value: "1", authorityRank: 1 }),
      observation({ kpiId: "rev", value: "2", authorityRank: 9, publicationState: "SUPERSEDED" }),
      observation({ kpiId: "rev", value: "3", authorityRank: 9, quality: "INVALID" }),
      observation({ kpiId: "rev", value: "4", authorityRank: 9, publicationState: "DRAFT" }),
    ];
    const current = currentPeriodRows(rows, PERIOD);
    expect(current.map((row) => row.value)).toEqual(["1"]);
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
      "Shop NOI margin (reported basis)",
      "Shop NOI margin (ex-OTA basis)",
      "A brand new measure",
    ]);
    // The ex-OTA line is not swallowed by the generic Shop NOI line.
    expect(ordered.filter((row) => row.label === "Shop NOI")).toHaveLength(1);
  });

  it("gives a catalogue line to its exact match, not to whichever row sorts first", () => {
    // "Gross Revenue" sorts first and matches "revenue" weakly; the exact "Revenue"
    // row must still take the canonical line.
    const grossRevenue = metric({ id: "gross-rev", name: "Gross Revenue", metricKey: "user_review:gross_rev" });
    const rows = buildReportRows(
      [grossRevenue, revenue],
      [
        observation({ kpiId: "gross-rev", value: "25200000" }),
        observation({ kpiId: "rev", value: "25200000" }),
      ],
    );
    const ordered = orderByCatalogue(rows, BASE_BUSINESS_LINES);
    expect(ordered[0]).toMatchObject({ metricKey: "user_review:revenue", label: "Revenue" });
    // The weakly matching row keeps its own name rather than being relabelled.
    expect(ordered.some((row) => row.metricKey === "user_review:gross_rev" && row.label === "Gross Revenue")).toBe(true);
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
    // The reviewed report's own card names.
    expect(cards.map((card) => card.title)).toEqual(["Oct Adj. EBITDA (base business)", "YTD Adj. EBITDA", "LTM PF Lender EBITDA", "Oct Shop NOI"]);
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

  it("resolves a definition published under two populations the same way every time", () => {
    const scorecardOf = () =>
      buildPillarScorecard({ id: null, code: "M&A", name: "M&A" }, [metric({ id: "acq", name: "Acquired EBITDA closed" })], [
        observation({ kpiId: "acq", value: "300000", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" }),
        observation({ kpiId: "acq", value: "900000", reportingScope: "BASE_BUSINESS", entityScope: "BASE_BUSINESS" }),
      ], PERIOD);

    const first = scorecardOf();
    const second = scorecardOf();
    // Deterministic (sorted by population), and the row says which population won.
    expect(first.rows[0].value).toBe(first.rows[0].value);
    expect(first.rows[0].scopeLabel).toBe(second.rows[0].scopeLabel);
    expect(first.scopeLabels).toEqual(["Base Business", "Finance reported"]);
    expect(first.rows[0].value).toBe("$900K");
  });

  it("labels the basis of a value that falls back from monthly to another basis", () => {
    const scorecard = buildPillarScorecard({ id: null, code: "M&A", name: "M&A" }, [metric({ id: "acq", name: "Acquired EBITDA closed" })], [
      observation({ kpiId: "acq", value: "34800000", timeBasis: "YTD" }),
    ], PERIOD);
    // The month column shows a YTD figure only with its own label, never as the month.
    expect(scorecard.rows[0].value).toBe("$34.8M");
    expect(scorecard.rows[0].basisLabel).toBe("YTD");
  });

  it("attributes a metric to one pillar only when two areas' expectations overlap", () => {
    const closeCycle = metric({ id: "close", name: "Accounting close cycle time" });
    const rows = [observation({ kpiId: "close", value: "5", timeBasis: "MONTHLY" })];
    const mna = buildPillarScorecard({ id: null, code: "M&A", name: "M&A" }, [closeCycle], rows, PERIOD);
    const finance = buildPillarScorecard({ id: null, code: "FINANCE", name: "FINANCE" }, [closeCycle], rows, PERIOD);
    expect(mna.loaded).toBe(0);
    expect(finance.rows.some((row) => row.label === "Accounting close cycle time" && !row.expectedOnly)).toBe(true);
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
    series: [
      {
        key: "lender",
        label: "Lender",
        match: (definition) => /lender/.test(definition.name.toLowerCase()),
        timeBasis: "LTM",
        scope: null,
        missing: "LTM lender series",
      },
    ],
  };

  it("orders months chronologically and flags a restated point", () => {
    const rows = [
      observation({ kpiId: "lender", value: "3", timeBasis: "LTM", reportingPeriod: "2026-10", revision: 2 }),
      observation({ kpiId: "lender", value: "1", timeBasis: "LTM", reportingPeriod: "2025-12" }),
      observation({ kpiId: "lender", value: "2", timeBasis: "LTM", reportingPeriod: "2026-01" }),
    ];
    const chart = buildTrendChart(spec, [lenderEbitda], rows);
    // The axis is every calendar month in range; the observed points stay three.
    expect(chart.periods[0]).toBe("2025-12");
    expect(chart.periods[chart.periods.length - 1]).toBe("2026-10");
    expect(chart.periods).toHaveLength(11);
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

  it("refuses to merge two populations into one line and says which ones it found", () => {
    const rows = [
      observation({ kpiId: "lender", value: "1", timeBasis: "LTM", reportingPeriod: "2026-09" }),
      observation({ kpiId: "lender", value: "9", timeBasis: "LTM", reportingPeriod: "2026-10", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" }),
    ];
    const chart = buildTrendChart(spec, [lenderEbitda], rows);
    expect(chart.series).toHaveLength(0);
    expect(chart.notes[0]).toContain("More than one published identity");
  });

  it("returns no series when nothing matches", () => {
    const chart = buildTrendChart(spec, [revenue], [observation({ kpiId: "rev", value: "1" })]);
    expect(chart.series).toHaveLength(0);
    expect(chart.periods).toHaveLength(0);
    expect(chart.notes).toEqual(["LTM lender series"]);
  });
});

describe("historical chart as the reviewed report draws it", () => {
  const ebitdaChart = TREND_CHART_SPECS.find((candidate) => candidate.id === "ltm-ebitda")!;
  const baseSpec = ebitdaChart.series.find((candidate) => candidate.key === "base-business")!;
  const lenderSpec = ebitdaChart.series.find((candidate) => candidate.key === "lender")!;
  /** A definition that exists only to publish the reviewed chart series. */
  const historyDefinition = metric({ id: "bb-history", name: "Base Business Adjusted EBITDA (reviewed history)", metricKey: "user_review:bb_ebitda_history" });

  it("states LTM for the lender line, and no basis at all for the Base Business line", () => {
    expect(lenderSpec.timeBasis).toBe("LTM");
    expect(lenderSpec.label).toBe("LTM Pro Forma Lender EBITDA");
    // The reviewed report never names the dashed series' accounting basis.
    expect(baseSpec.timeBasis).toBeNull();
    expect(baseSpec.label).toBe("Base Business Adjusted EBITDA");
    expect(baseSpec.style).toBe("dashed");
    expect(baseSpec.excludeHeadline).toBe(true);
  });

  it("does not substitute the October YTD headline for the historical series", () => {
    const headline = new Set([`${adjustedEbitda.id}\u0000YTD`]);
    const chart = buildTrendChart(
      ebitdaChart,
      [adjustedEbitda, lenderEbitda],
      [
        observation({ kpiId: "ebitda", value: "79900000", timeBasis: "YTD", reportingPeriod: "2026-10" }),
        observation({ kpiId: "ebitda", value: "78500000", timeBasis: "YTD", reportingPeriod: "2026-09" }),
      ],
      { headlineIdentities: headline },
    );

    const base = chart.series.find((series) => series.key === "base-business");
    expect(base).toBeUndefined();
    // And the $79.9M YTD observation appears nowhere in the chart.
    expect(chart.series.some((series) => series.points.some((point) => point.value === 79_900_000))).toBe(false);
    expect(chart.notes.join(" ")).toContain("does not state that series' accounting basis");
  });

  it("draws a separately published history on the basis that definition declares", () => {
    const chart = buildTrendChart(
      ebitdaChart,
      [adjustedEbitda, lenderEbitda, historyDefinition],
      [
        observation({ kpiId: "ebitda", value: "79900000", timeBasis: "YTD", reportingPeriod: "2026-10" }),
        observation({ kpiId: "bb-history", value: "77300000", timeBasis: "LTM", reportingPeriod: "2026-10" }),
        observation({ kpiId: "bb-history", value: "78500000", timeBasis: "LTM", reportingPeriod: "2026-09" }),
        observation({ kpiId: "lender", value: "136000000", timeBasis: "LTM", reportingPeriod: "2026-10", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" }),
      ],
      { headlineIdentities: new Set([`${adjustedEbitda.id}\u0000YTD`]) },
    );

    const base = chart.series.find((series) => series.key === "base-business");
    expect(base?.points.map((point) => point.value)).toEqual([78_500_000, 77_300_000]);
    expect(base?.style).toBe("dashed");
    // The basis comes from the published row and is stated, not inferred.
    expect(chart.basisLabels).toContain("Base Business Adjusted EBITDA: LTM");
    expect(chart.notes).toHaveLength(0);
  });

  it("plots nothing when two published identities could both be the series", () => {
    const chart = buildTrendChart(
      ebitdaChart,
      [adjustedEbitda, historyDefinition],
      [
        observation({ kpiId: "bb-history", value: "77300000", timeBasis: "LTM", reportingPeriod: "2026-10" }),
        observation({ kpiId: "bb-history", value: "77000000", timeBasis: "MONTHLY", reportingPeriod: "2026-10" }),
      ],
      { headlineIdentities: new Set() },
    );
    expect(chart.series.find((series) => series.key === "base-business")).toBeUndefined();
    expect(chart.notes.join(" ")).toContain("More than one published identity");
  });

  it("never accumulates monthly rows into the historical line", () => {
    const monthly = (period: string, value: string) => observation({ kpiId: "bb-history", value, timeBasis: "MONTHLY", reportingPeriod: period });
    const chart = buildTrendChart(ebitdaChart, [historyDefinition], [monthly("2026-09", "7"), monthly("2026-10", "9")], {
      headlineIdentities: new Set(),
    });
    const base = chart.series.find((series) => series.key === "base-business");
    // Two monthly rows resolve to a monthly series of 7 and 9 — never a sum of 16,
    // and never relabelled as a rolling or cumulative figure.
    expect(base?.points.map((point) => point.value)).toEqual([7, 9]);
    expect(chart.basisLabels).toContain("Base Business Adjusted EBITDA: MONTHLY");
  });

  it("keeps the September lender restatement marked", () => {
    const chart = buildTrendChart(ebitdaChart, [lenderEbitda], [
      observation({ kpiId: "lender", value: "135400000", timeBasis: "LTM", reportingPeriod: "2026-09", revision: 2 }),
      observation({ kpiId: "lender", value: "136000000", timeBasis: "LTM", reportingPeriod: "2026-10" }),
    ]);
    const lender = chart.series.find((series) => series.key === "lender");
    expect(lender?.points.filter((point) => point.restated).map((point) => point.period)).toEqual(["2026-09"]);
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
  /** Each churn column has its own time basis: point in time, month, trailing. */
  const basisFor = (kpiId: string): string =>
    kpiId === "bookable" ? "POINT_IN_TIME" : kpiId === "ltm-units" || kpiId === "ltm-pct" ? "LTM" : "MONTHLY";
  const brandRow = (kpiId: string, value: string, brand: string, overrides: Partial<KpiObservationRecord> = {}) =>
    observation({
      kpiId,
      value,
      entityId: brand,
      entityScope: "BRAND",
      reportingScope: "BASE_BUSINESS",
      timeBasis: basisFor(kpiId),
      ...overrides,
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
    expect(churn.totals).toMatchObject({ brands: 2, bookableUnits: 150, monthChurned: 3, ltmChurned: 30 });
    // Percentage totals are derived from the counts, not averaged from the rows,
    // and come out in percent points like every other percent-kind value.
    expect(churn.totals.monthAnnualizedPct).toBeCloseTo(((3 * 12) / 150) * 100, 6);
    expect(churn.totals.ltmPct).toBeCloseTo((30 / 150) * 100, 6);
    expect(churn.ignoredTimeBasis).toBe(0);
  });

  it("names the time basis of every column", () => {
    const churn = buildBrandChurn(definitions, [brandRow("bookable", "100", "Brand A")], PERIOD);
    expect(Object.fromEntries(churn.columns.map((column) => [column.key, column.basisLabel]))).toEqual({
      bookableUnits: "point in time",
      monthChurned: "month",
      monthAnnualizedPct: "month",
      ltmChurned: "trailing 12 months",
      ltmPct: "trailing 12 months",
    });
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
      brandRow("bookable", "50", "Brand C", { reportingScope: "USER_REVIEWED_REPORTED" }),
    ], PERIOD);
    expect(churn.scopeLabels).toEqual(["Base Business", "Finance reported"]);
  });

  it("never blends one brand's columns across two populations, and adds up no total across them", () => {
    const churn = buildBrandChurn(definitions, [
      brandRow("bookable", "100", "Brand A"),
      brandRow("month", "2", "Brand A"),
      // Same brand name, different population: its own row, not a merge.
      brandRow("bookable", "40", "Brand A", { reportingScope: "USER_REVIEWED_REPORTED" }),
      brandRow("ltm-units", "99", "Brand A", { reportingScope: "USER_REVIEWED_REPORTED" }),
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
      brandRow("bookable", "500", "Brand A", { comparisonBasis: "BUDGET" }),
    ], PERIOD);
    expect(churn.rows[0].bookableUnits).toBe(100);
    expect(churn.totalsMixed).toBe(false);
  });

  it("keeps a YTD or point-in-time row out of the monthly churn column instead of overwriting it", () => {
    const churn = buildBrandChurn(definitions, [
      brandRow("month", "2", "Brand A"),
      // Same definition, other bases: different facts, never the monthly figure.
      brandRow("month", "17", "Brand A", { timeBasis: "YTD" }),
      brandRow("month", "21", "Brand A", { timeBasis: "POINT_IN_TIME" }),
      brandRow("month", "31", "Brand A", { timeBasis: "LTM" }),
    ], PERIOD);

    expect(churn.rows).toHaveLength(1);
    expect(churn.rows[0].monthChurned).toBe(2);
    expect(churn.ignoredTimeBasis).toBe(3);
  });

  it("keeps monthly and YTD bookable units apart from the point-in-time identity", () => {
    const churn = buildBrandChurn(definitions, [
      brandRow("bookable", "120", "Brand A"),
      brandRow("bookable", "800", "Brand A", { timeBasis: "MONTHLY" }),
      brandRow("bookable", "900", "Brand A", { timeBasis: "YTD" }),
    ], PERIOD);

    expect(churn.rows[0].bookableUnits).toBe(120);
    expect(churn.ignoredTimeBasis).toBe(2);
  });

  it("does not let a monthly row fill the trailing churn column", () => {
    const churn = buildBrandChurn(definitions, [
      brandRow("ltm-units", "30", "Brand A"),
      brandRow("ltm-units", "3", "Brand A", { timeBasis: "MONTHLY" }),
      brandRow("ltm-pct", "12.5", "Brand A"),
      brandRow("ltm-pct", "1.2", "Brand A", { timeBasis: "YTD" }),
    ], PERIOD);

    expect(churn.rows[0].ltmChurned).toBe(30);
    expect(churn.rows[0].ltmPct).toBe(12.5);
    expect(churn.ignoredTimeBasis).toBe(2);
  });

  it("refuses a churn row that names no time basis", () => {
    const churn = buildBrandChurn(definitions, [brandRow("month", "2", "Brand A", { timeBasis: null })], PERIOD);
    expect(churn.rows).toHaveLength(0);
    expect(churn.ignoredTimeBasis).toBe(1);
  });

  it("accepts TTM as the trailing window and never mixes it into a monthly column", () => {
    const churn = buildBrandChurn(definitions, [
      brandRow("ltm-units", "30", "Brand A", { timeBasis: "TTM" }),
    ], PERIOD);
    expect(churn.rows[0].ltmChurned).toBe(30);
    expect(churn.ignoredTimeBasis).toBe(0);
  });

  it("gives each column one definition, so two similar metrics cannot overwrite each other", () => {
    const duplicate = [...definitions, metric({ id: "month-b", name: "Units churned", metricKey: "user_review:units_churned" })];
    const churn = buildBrandChurn(duplicate, [
      brandRow("month", "2", "Brand A"),
      { ...brandRow("month-b", "7", "Brand A"), kpiId: "month-b" },
    ], PERIOD);
    // "Churned units" is the shorter, canonical name; the duplicate does not enter.
    expect(churn.rows[0].monthChurned).toBe(2);
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
