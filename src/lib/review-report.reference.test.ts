import { describe, expect, it } from "vitest";
import type { KpiObservationRecord } from "@/lib/kpi";
import {
  BASE_BUSINESS_SCOPE,
  BRAND_CHURN_COLUMNS,
  buildBrandChurn,
  buildExecCards,
  buildPillarScorecard,
  buildReportRows,
  buildTrendChart,
  currentPeriodRows,
  TREND_CHART_SPECS,
  type ReportMetric,
  type ReportObservation,
} from "./review-report";
import { formatMetricValue } from "./review-format";

/**
 * Validation against the reviewed October 2026 Strategy Review.
 *
 * These are *fixtures*, not production data: the amounts live only in this test
 * so the selection and formatting rules can be checked without a database. No
 * business figure is imported by application code. Where production Neon holds
 * the real rows, the same rules select them; the numbers here only prove what
 * the dashboard would show for them.
 *
 * Reference values are the user-supplied reviewed figures for October 2026 and
 * YTD 2026. They are the user's reviewed report, not necessarily consolidated
 * Finance values, and the two populations are kept apart below.
 */

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

type Overrides = Partial<KpiObservationRecord> & { value: string } & { kpiId: string };

function observation(overrides: Overrides): ReportObservation {
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

/** A reviewed Base Business definition: one monthly and one YTD actual. */
function baseBusinessRows(kpiId: string, month: string, ytd: string): ReportObservation[] {
  return [
    observation({ kpiId, value: month, timeBasis: "MONTHLY" }),
    observation({ kpiId, value: ytd, timeBasis: "YTD" }),
  ];
}

// ---------------------------------------------------------------------------
// October 2026 reference headlines (month and YTD)
// ---------------------------------------------------------------------------

const revenue = metric({ id: "revenue", name: "Base Business revenue", metricKey: "user_review:base_business_revenue" });
const adjustedEbitda = metric({ id: "ebitda", name: "Adjusted EBITDA", metricKey: "user_review:adjusted_ebitda" });
const trevpar = metric({ id: "trevpar", name: "TRevPAR reported", unit: "USD", displayFormat: "currency" });
const adr = metric({ id: "adr", name: "ADR", unit: "USD", displayFormat: "currency" });
const occupancy = metric({ id: "occupancy", name: "Paid occupancy", unit: "percent", displayFormat: "percent" });
const gbv = metric({ id: "gbv", name: "GBV", unit: "USD", displayFormat: "currency" });
const ltmLender = metric({ id: "lender", name: "LTM Pro Forma Lender EBITDA", metricKey: "user_review:ltm_pro_forma_lender_ebitda" });

const referenceMetrics = [revenue, adjustedEbitda, trevpar, adr, occupancy, gbv, ltmLender];

const referenceRows: ReportObservation[] = [
  ...baseBusinessRows("revenue", "25200000", "353800000"),
  ...baseBusinessRows("ebitda", "-1200000", "79900000"),
  ...baseBusinessRows("trevpar", "99.2", "177.9"),
  ...baseBusinessRows("adr", "205.9", "300.8"),
  ...baseBusinessRows("occupancy", "30.3", "41.4"),
  ...baseBusinessRows("gbv", "45100000", "740900000"),
  // The lender view is published year to date on its own population.
  observation({
    kpiId: "lender",
    value: "136000000",
    timeBasis: "LTM",
    reportingScope: "USER_REVIEWED_REPORTED",
    entityScope: "REPORTED",
  }),
];

describe("October 2026 reference headlines", () => {
  it("shows Base Business revenue and Adjusted EBITDA in their own population", () => {
    const rows = buildReportRows(referenceMetrics, referenceRows);
    const revenueRow = rows.find((row) => row.metricKey === "user_review:base_business_revenue");
    const ebitdaRow = rows.find((row) => row.metricKey === "user_review:adjusted_ebitda");

    expect(revenueRow?.monthActual.display).toBe("$25.2M");
    expect(revenueRow?.ytdActual.display).toBe("$353.8M");
    // A loss keeps its sign and is never shown as a positive.
    expect(ebitdaRow?.monthActual.display).toBe("\u2212$1.2M");
    expect(ebitdaRow?.ytdActual.display).toBe("$79.9M");
  });

  it("shows the operating reference values in their own units", () => {
    const rows = buildReportRows(referenceMetrics, referenceRows);
    const byKey = new Map(rows.map((row) => [row.metricKey, row]));

    expect(byKey.get("user_review:trevpar")?.monthActual.display).toBe("$99.2");
    expect(byKey.get("user_review:trevpar")?.ytdActual.display).toBe("$177.9");
    expect(byKey.get("user_review:adr")?.monthActual.display).toBe("$205.9");
    expect(byKey.get("user_review:adr")?.ytdActual.display).toBe("$300.8");
    expect(byKey.get("user_review:occupancy")?.monthActual.display).toBe("30.3%");
    expect(byKey.get("user_review:occupancy")?.ytdActual.display).toBe("41.4%");
    expect(byKey.get("user_review:gbv")?.monthActual.display).toBe("$45.1M");
    expect(byKey.get("user_review:gbv")?.ytdActual.display).toBe("$740.9M");
  });

  it("fills the Adjusted EBITDA cards from Base Business and never from another population", () => {
    const withConsolidated = [
      ...referenceRows,
      // A consolidated fact for the same definition: different population, different
      // number, and it must not reach a Base Business card.
      observation({
        kpiId: "ebitda",
        value: "77000000",
        timeBasis: "YTD",
        reportingScope: "USER_REVIEWED_REPORTED",
        entityScope: "REPORTED",
      }),
    ];
    const cards = buildExecCards(referenceMetrics, withConsolidated, PERIOD);
    const month = cards.find((card) => card.id === "month-adjusted-ebitda");
    const ytd = cards.find((card) => card.id === "ytd-adjusted-ebitda");
    const lender = cards.find((card) => card.id === "ltm-lender-ebitda");

    expect(month?.value).toBe("\u2212$1.2M");
    expect(month?.scopeLabel).toBe("Base Business");
    expect(ytd?.value).toBe("$79.9M");
    expect(ytd?.scopeLabel).toBe("Base Business");
    expect(lender?.value).toBe("$136.0M");
  });

  it("prints the expected identity for a card with no observation", () => {
    const cards = buildExecCards(referenceMetrics, referenceRows, PERIOD);
    const shopNoi = cards.find((card) => card.id === "month-shop-noi");
    expect(shopNoi?.value).toBeNull();
    expect(shopNoi?.expected).toContain("Shop NOI");
  });

  it("formats a percentage-point margin comparison as points, not as a percent", () => {
    const marginVsPy = metric({ id: "noi-margin-py", name: "Shop NOI margin vs PY (ex-OTA)", unit: "percentage_points", displayFormat: "percent" });
    expect(formatMetricValue(marginVsPy, "0.5")).toBe("+0.5 pt");
    expect(formatMetricValue(marginVsPy, "-0.4")).toBe("\u22120.4 pt");
    // A growth rate is a percent, and carries its sign like the report.
    const trevparGrowth = metric({ id: "trevpar-growth", name: "TRevPAR growth vs PY", unit: "percent", displayFormat: "percent" });
    expect(formatMetricValue(trevparGrowth, "4.1")).toBe("+4.1%");
    expect(formatMetricValue(trevparGrowth, "-0.9")).toBe("\u22120.9%");
  });
});

// ---------------------------------------------------------------------------
// Pillar reference lines
// ---------------------------------------------------------------------------

describe("October 2026 reference pillar lines", () => {
  const acquired = metric({ id: "acquired", name: "Acquired EBITDA closed" });
  const bdAdds = metric({ id: "bd-adds", name: "BD unit adds", unit: "count", displayFormat: "count" });
  const churn = metric({ id: "churn", name: "Annualized unit churn", unit: "percent", displayFormat: "percent" });
  const trevparGrowth = metric({ id: "trevpar-growth", name: "TRevPAR growth vs PY", unit: "percent", displayFormat: "percent" });
  const noiMarginPy = metric({ id: "noi-margin-py", name: "Shop NOI margin vs PY (ex-OTA)", unit: "percentage_points", displayFormat: "percent" });
  const reviewScore = metric({ id: "review", name: "Average review score", unit: "score", displayFormat: "number" });

  const metrics = [acquired, bdAdds, churn, trevparGrowth, noiMarginPy, reviewScore];
  const rows = [
    ...baseBusinessRows("acquired", "300000", "34800000"),
    ...baseBusinessRows("bd-adds", "330", "3340"),
    ...baseBusinessRows("churn", "12.2", "12.4"),
    ...baseBusinessRows("trevpar-growth", "-0.9", "4.1"),
    ...baseBusinessRows("noi-margin-py", "0.5", "0.8"),
    ...baseBusinessRows("review", "4.64", "4.65"),
  ];

  it("reads the scorecard on the basis the 2026 goal is stated, never the month", () => {
    const scorecard = buildPillarScorecard({ id: null, code: "M&A", name: "M&A" }, metrics, rows, PERIOD);
    const row = scorecard.rows.find((candidate) => candidate.label === "Acquired EBITDA closed");
    // The YTD figure is the one the annual goal answers; the month is context.
    expect(row?.value).toBe("$34.8M");
    expect(row?.basisLabel).toBe("YTD");
    expect(row?.expectedOnly).toBe(false);
  });

  it("keeps unit adds, churn, growth, points and scores in their own units", () => {
    // Each reviewed line belongs to the pillar whose documented identity it matches;
    // unlinked metrics are attributed that way rather than all to one card.
    const byLabel = new Map(
      ["M&A", "GROW", "RETENTION", "TREVPAR", "MARGIN", "GUEST"]
        .flatMap((code) => buildPillarScorecard({ id: null, code, name: code }, metrics, rows, PERIOD).rows)
        .map((row) => [row.label, row] as const),
    );
    expect(byLabel.get("BD unit adds")?.value).toBe("3,340");
    expect(byLabel.get("Annualized unit churn")?.value).toBe("12.4%");
    expect(byLabel.get("TRevPAR growth vs PY")?.value).toBe("+4.1%");
    expect(byLabel.get("Shop NOI margin vs PY (ex-OTA)")?.value).toBe("+0.8 pt");
    expect(byLabel.get("Average review score")?.value).toBe("4.65");
    for (const label of ["BD unit adds", "Annualized unit churn", "TRevPAR growth vs PY", "Shop NOI margin vs PY (ex-OTA)", "Average review score"]) {
      expect(byLabel.get(label)?.basisLabel).toBe("YTD");
    }
  });

  it("never rates the month's figure against the annual goal", () => {
    // October's month is −0.9% TRevPAR and the annual goal is +3.3%: judging the
    // month would print "Behind" beside the approved "On track reported".
    const scorecard = buildPillarScorecard({ id: null, code: "TREVPAR", name: "TRevPAR" }, [{ ...trevparGrowth, target: "2026 goal +3.3% reported" }], rows, PERIOD);
    const row = scorecard.rows.find((candidate) => candidate.label === "TRevPAR growth vs PY");
    expect(row?.value).toBe("+4.1%");
    expect(row?.status).toBe("ahead");
    // And a definition that publishes only the month is shown, never judged.
    const monthlyOnly = buildPillarScorecard({ id: null, code: "TREVPAR", name: "TRevPAR" }, [{ ...trevparGrowth, target: "2026 goal +3.3% reported" }], [observation({ kpiId: "trevpar-growth", value: "-0.9", timeBasis: "MONTHLY" })], PERIOD);
    const monthRow = monthlyOnly.rows.find((candidate) => candidate.label === "TRevPAR growth vs PY");
    expect(monthRow?.value).toBe("\u22120.9%");
    expect(monthRow?.basisLabel).toBe("Month");
    expect(monthRow?.status).toBe("no_data");
    expect(monthRow?.statusReason).toBe("no-period-figure");
  });

  it("does not read a monthly value as YTD", () => {
    const current = currentPeriodRows(rows, PERIOD);
    const churnRows = current.filter((row) => row.kpiId === "churn");
    expect(churnRows.map((row) => `${row.timeBasis ?? ""}=${row.value}`).sort()).toEqual(["MONTHLY=12.2", "YTD=12.4"]);
  });
});

// ---------------------------------------------------------------------------
// Reference historical series (item 1) — chart selection
// ---------------------------------------------------------------------------

/**
 * The reviewed chart's two series, from the HTML: the dashed "Base business Adj.
 * EBITDA" line and the solid "LTM pro forma lender EBITDA" line, Dec-25 to Oct-26.
 *
 * The HTML states LTM only for the lender line. Its dashed line is a level that
 * falls each month ("fell $1.3M in the month to $77.3M") and its October point is
 * $77.3M, which is NOT the $79.9M October YTD headline. So the two are different
 * published identities, and the dashboard must not reuse the YTD headline for the
 * chart. Here the history is modelled as its own definition, as Neon would need to
 * hold it; the basis it declares is what the chart shows.
 */
const HISTORY: { period: string; baseBusinessYtd: string; lenderLtm: string; restated?: boolean }[] = [
  { period: "2025-12", baseBusinessYtd: "69400000", lenderLtm: "86400000" },
  { period: "2026-01", baseBusinessYtd: "69500000", lenderLtm: "86900000" },
  { period: "2026-02", baseBusinessYtd: "68900000", lenderLtm: "104000000" },
  { period: "2026-03", baseBusinessYtd: "68000000", lenderLtm: "104100000" },
  { period: "2026-04", baseBusinessYtd: "67700000", lenderLtm: "109100000" },
  { period: "2026-05", baseBusinessYtd: "69000000", lenderLtm: "111400000" },
  { period: "2026-06", baseBusinessYtd: "71600000", lenderLtm: "118800000" },
  { period: "2026-07", baseBusinessYtd: "75800000", lenderLtm: "120800000" },
  { period: "2026-08", baseBusinessYtd: "77300000", lenderLtm: "123300000" },
  { period: "2026-09", baseBusinessYtd: "78500000", lenderLtm: "135400000", restated: true },
  { period: "2026-10", baseBusinessYtd: "77300000", lenderLtm: "136000000" },
];

/** The reviewed history's own definition, separate from the October YTD headline. */
const historyEbitda = metric({
  id: "bb-history",
  name: "Base Business Adjusted EBITDA (reviewed history)",
  metricKey: "user_review:bb_ebitda_reviewed_history",
});

function historyRows(): ReportObservation[] {
  return HISTORY.flatMap((point) => [
    observation({
      kpiId: "bb-history",
      value: point.baseBusinessYtd,
      timeBasis: "LTM",
      reportingPeriod: point.period,
    }),
    observation({
      kpiId: "lender",
      value: point.lenderLtm,
      timeBasis: "LTM",
      reportingPeriod: point.period,
      reportingScope: "USER_REVIEWED_REPORTED",
      entityScope: "REPORTED",
      // September is the restated lender figure in the reviewed report.
      revision: point.restated ? 2 : 1,
    }),
  ]);
}

describe("October 2026 reference history", () => {
  const spec = TREND_CHART_SPECS.find((candidate) => candidate.id === "ltm-ebitda")!;
  const headline = new Set([`${adjustedEbitda.id}\u0000YTD`]);
  const chart = buildTrendChart(spec, [adjustedEbitda, historyEbitda, ltmLender], historyRows(), { headlineIdentities: headline });

  it("plots one point per month for the YTD Base Business series and the LTM lender series", () => {
    const base = chart.series.find((series) => series.key === "base-business");
    const lender = chart.series.find((series) => series.key === "lender");
    expect(base?.points).toHaveLength(HISTORY.length);
    expect(lender?.points).toHaveLength(HISTORY.length);
    expect(chart.periods[0]).toBe("2025-12");
    expect(chart.periods[chart.periods.length - 1]).toBe("2026-10");
    expect(base?.points[0].value).toBe(69_400_000);
    expect(base?.points[base.points.length - 1].value).toBe(77_300_000);
    expect(lender?.points[lender.points.length - 1].value).toBe(136_000_000);
    // The dashed line the review draws is drawn dashed here too.
    expect(base?.style).toBe("dashed");
    expect(chart.basisLabels).toContain("Base Business Adjusted EBITDA: LTM");
  });

  it("keeps the $77.3M chart point and the $79.9M YTD headline as separate facts", () => {
    const withHeadline = buildTrendChart(
      spec,
      [adjustedEbitda, historyEbitda, ltmLender],
      [
        ...historyRows(),
        observation({ kpiId: "ebitda", value: "79900000", timeBasis: "YTD" }),
        observation({ kpiId: "ebitda", value: "78500000", timeBasis: "YTD", reportingPeriod: "2026-09" }),
        observation({ kpiId: "ebitda", value: "-1200000", timeBasis: "MONTHLY" }),
      ],
      { headlineIdentities: new Set([`${adjustedEbitda.id}\u0000YTD`, `${adjustedEbitda.id}\u0000MONTHLY`]) },
    );
    const base = withHeadline.series.find((series) => series.key === "base-business");
    expect(base?.points[base.points.length - 1].value).toBe(77_300_000);
    // Neither the YTD headline nor the monthly loss leaks into the chart.
    expect(withHeadline.series.some((series) => series.points.some((point) => point.value === 79_900_000))).toBe(false);
    expect(withHeadline.series.some((series) => series.points.some((point) => point.value === -1_200_000))).toBe(false);
  });

  it("keeps each series on its own population and time basis", () => {
    const base = chart.series.find((series) => series.key === "base-business");
    const lender = chart.series.find((series) => series.key === "lender");
    expect(base?.scopeLabel).toBe("Base Business");
    expect(lender?.scopeLabel).toBe("Finance reported");
  });

  it("marks the restated September lender point and only that point", () => {
    const lender = chart.series.find((series) => series.key === "lender");
    expect(lender?.points.filter((point) => point.restated).map((point) => point.period)).toEqual(["2026-09"]);
  });
});

// ---------------------------------------------------------------------------
// Reference brand churn identities
// ---------------------------------------------------------------------------

describe("brand churn identity assumptions", () => {
  it("reads the five reference columns from their documented time bases", () => {
    const bases = Object.fromEntries(BRAND_CHURN_COLUMNS.map((column) => [column.key, column.bases]));
    expect(bases.bookableUnits).toEqual(["POINT_IN_TIME"]);
    expect(bases.monthChurned).toEqual(["MONTHLY"]);
    expect(bases.monthAnnualizedPct).toEqual(["MONTHLY"]);
    expect(bases.ltmChurned).toEqual(["LTM", "TTM"]);
    expect(bases.ltmPct).toEqual(["LTM", "TTM"]);
  });

  it("sums counts only, and derives a percentage from them, never from a rate", () => {
    const metrics = [
      metric({ id: "bookable", name: "Bookable units", unit: "count" }),
      metric({ id: "month", name: "Churned units", unit: "count" }),
      metric({ id: "ltm-pct", name: "LTM churn %", unit: "percent" }),
    ];
    const churn = buildBrandChurn(metrics, [
      observation({ kpiId: "bookable", value: "100", entityId: "Brand A", entityScope: "BRAND", timeBasis: "POINT_IN_TIME" }),
      observation({ kpiId: "bookable", value: "50", entityId: "Brand B", entityScope: "BRAND", timeBasis: "POINT_IN_TIME" }),
      observation({ kpiId: "month", value: "4", entityId: "Brand A", entityScope: "BRAND", timeBasis: "MONTHLY" }),
      observation({ kpiId: "ltm-pct", value: "12.5", entityId: "Brand A", entityScope: "BRAND", timeBasis: "LTM" }),
    ], PERIOD);

    expect(churn.totals.bookableUnits).toBe(150);
    expect(churn.totals.monthChurned).toBe(4);
    // No trailing count was published, so no trailing percentage is derived.
    expect(churn.totals.ltmPct).toBeNull();
    expect(churn.totals.monthAnnualizedPct).toBeCloseTo(((4 * 12) / 150) * 100, 6);
    expect(churn.scopeLabels).toEqual(["Base Business"]);
  });
});

// ---------------------------------------------------------------------------
// The reviewed brand churn table (49 brands + its own totals row)
// ---------------------------------------------------------------------------

/**
 * The reviewed table's full contents: brand, bookable units, October churned
 * units, LTM (Nov-25 – Oct-26) churned units. Its totals row is
 * `15,324 | 169 | 13% | 1,868 | 12%`, and the review states how both percentages
 * are derived — "Rates divide by bookable units on 16 Nov". The percentage
 * columns are therefore reproducible from the counts, which is what this checks.
 */
const BRAND_CHURN: readonly (readonly [brand: string, bookable: number, monthChurned: number, ltmChurned: number])[] = [
  ["Avada Properties", 306, 4, 174],
  ["Scottsdale Rentals", 85, 0, 36],
  ["Luxury Beach Rentals", 237, 22, 91],
  ["Carolina Beach Realty", 172, 4, 55],
  ["Stay Local Austin", 93, 0, 27],
  ["Emerald Coast Retreats", 109, 3, 29],
  ["Big Sky Vacation Rentals", 111, 1, 28],
  ["Stay Montana", 422, 13, 81],
  ["Sedona.org", 158, 0, 26],
  ["SummitCove", 429, 9, 63],
  ["Emerald Coast Vacation Rentals", 271, 2, 39],
  ["Oregon Beach Vacations", 201, 3, 28],
  ["Stay Winter Park", 304, 2, 42],
  ["Village Realty", 974, 14, 133],
  ["RealJoy", 1893, 27, 254],
  ["Sunset Rentals", 281, 5, 36],
  ["Sun Palace Vacation Homes", 239, 2, 30],
  ["Park City Rental Properties", 437, 4, 52],
  ["Kiawah / Seabrook Exclusives", 208, 1, 24],
  ["Great Ocean Condos", 454, 7, 50],
  ["Resort Rentals", 474, 3, 51],
  ["Great Western Lodging", 344, 2, 36],
  ["Stony Brook Cabins", 197, 1, 19],
  ["Echelon Luxury Properties", 136, 0, 13],
  ["Retreatia", 290, 2, 27],
  ["Lodging in Telluride", 54, 0, 5],
  ["Stay Better Vacations", 165, 0, 15],
  ["Pristine Properties Vacation Rentals", 365, 1, 33],
  ["Vacation Homes Collection", 282, 1, 25],
  ["Meredith Lodging", 785, 13, 69],
  ["Bluewater Vacation Rentals", 571, 4, 47],
  ["Pensacola Beach Properties", 258, 0, 21],
  ["Gulf Coast Getaways", 70, 0, 5],
  ["Blue Moon Vacation Rentals", 102, 0, 7],
  ["Holiday Isle Properties", 442, 2, 30],
  ["Luxury Coastal Vacations", 587, 1, 39],
  ["Summit County Mountain Retreats", 639, 1, 41],
  ["Sand 'N Sea Properties", 201, 2, 12],
  ["Travel Life Vacations", 156, 2, 9],
  ["Spinnaker's Reach Realty", 140, 3, 7],
  ["Ski Country Resorts", 161, 1, 8],
  ["Arrived", 270, 0, 13],
  ["Warren Beach Rentals", 261, 0, 11],
  ["All Seasons", 485, 5, 19],
  ["Ocracoke Island Realty", 299, 2, 8],
  ["Element Vacation Homes", 46, 0, 0],
  ["Steamboat Lodging Company", 55, 0, 0],
  ["Winter Park Lodging Company", 105, 0, 0],
  // The review's own note: "Rent Branson shows no bookable units in AwayDNA".
  ["Rent Branson", 0, 0, 0],
];

describe("October 2026 reference brand churn table", () => {
  const metrics = [
    metric({ id: "bookable", name: "Bookable units", unit: "count", displayFormat: "count" }),
    metric({ id: "month-churned", name: "Churned units", unit: "count", displayFormat: "count" }),
    metric({ id: "ltm-churned", name: "LTM churned units", unit: "count", displayFormat: "count" }),
  ];

  const rows = BRAND_CHURN.flatMap(([brand, bookable, monthChurned, ltmChurned]) => [
    observation({ kpiId: "bookable", value: String(bookable), entityId: brand, entityScope: "BRAND", timeBasis: "POINT_IN_TIME" }),
    observation({ kpiId: "month-churned", value: String(monthChurned), entityId: brand, entityScope: "BRAND", timeBasis: "MONTHLY" }),
    observation({ kpiId: "ltm-churned", value: String(ltmChurned), entityId: brand, entityScope: "BRAND", timeBasis: "LTM" }),
  ]);

  const churn = buildBrandChurn(metrics, rows, PERIOD);

  it("renders one row per brand in the reviewed table", () => {
    expect(churn.rows).toHaveLength(49);
    expect(churn.totals.brands).toBe(49);
  });

  it("totals the reviewed counts exactly", () => {
    expect(churn.totals.bookableUnits).toBe(15_324);
    expect(churn.totals.monthChurned).toBe(169);
    expect(churn.totals.ltmChurned).toBe(1_868);
  });

  it("derives the reviewed totals row percentages the way the review derives them", () => {
    // 169 × 12 ÷ 15,324 = 13.2% and 1,868 ÷ 15,324 = 12.2%: the review prints 13% and 12%.
    expect(Math.round(churn.totals.monthAnnualizedPct!)).toBe(13);
    expect(Math.round(churn.totals.ltmPct!)).toBe(12);
    expect(churn.totals.monthAnnualizedPct).toBeCloseTo(((169 * 12) / 15_324) * 100, 10);
    expect(churn.totals.ltmPct).toBeCloseTo((1_868 / 15_324) * 100, 10);
  });

  it("keeps every brand's row readable on its own time basis", () => {
    const luxury = churn.rows.find((row) => row.brand === "Luxury Beach Rentals");
    expect(luxury).toMatchObject({ bookableUnits: 237, monthChurned: 22, ltmChurned: 91 });
    const branson = churn.rows.find((row) => row.brand === "Rent Branson");
    // No bookable units: the counts stay, and no rate is invented for the row.
    expect(branson).toMatchObject({ bookableUnits: 0, monthChurned: 0, ltmChurned: 0, monthAnnualizedPct: null, ltmPct: null });
    expect(churn.ignoredTimeBasis).toBe(0);
    expect(churn.totalsMixed).toBe(false);
  });
});

// A guard: this file's fixtures must never be imported by application code.
describe("reference fixtures stay test-only", () => {
  it("is not imported by any source module", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return walk(path);
        return /\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) ? [path] : [];
      });
    const offenders = walk(join(__dirname, "..")).filter((file) => readFileSync(file, "utf8").includes("review-report.reference.test"));
    expect(offenders).toEqual([]);
  });
});

void BASE_BUSINESS_SCOPE;
