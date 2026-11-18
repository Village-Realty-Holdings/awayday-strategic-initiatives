import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BASE_BUSINESS_SCOPE,
  buildBrandChurn,
  buildExecCards,
  buildPillarScorecard,
  buildReportRows,
  buildTrendChart,
  orderByCatalogue,
  BASE_BUSINESS_LINES,
  TREND_CHART_SPECS,
  type ReportMetric,
  type ReportObservation,
} from "@/lib/review-report";
import { ExecSummary, ComparisonTable, ReportSectionTable } from "./report-sections";
import { PillarScorecardDetails } from "./pillar-scorecard";
import { TrendChartCard } from "./trend-chart";
import { BrandChurnTable } from "./brand-churn-table";

// Render smoke tests: the report components must never throw on missing data,
// and they must name a population rather than silently merging populations.

const PERIOD = "2026-10";
const base = {
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
};

function metric(overrides: Partial<ReportMetric> & Pick<ReportMetric, "id" | "name">): ReportMetric {
  return {
    metricKey: `user_review:${overrides.id}`,
    unit: "USD",
    displayFormat: "currency",
    target: null,
    strategicAreaId: null,
    ...overrides,
  };
}

const observation = (overrides: Partial<ReportObservation> & Pick<ReportObservation, "kpiId" | "value">): ReportObservation =>
  ({ ...base, ...overrides }) as ReportObservation;

const metrics = [
  metric({ id: "rev", name: "Revenue" }),
  metric({ id: "ebitda", name: "Adjusted EBITDA" }),
  metric({ id: "noi", name: "Shop NOI" }),
];
const rows = [
  observation({ kpiId: "rev", value: "1000000" }),
  observation({ kpiId: "rev", value: "1200000", comparisonBasis: "BUDGET" }),
  observation({ kpiId: "rev", value: "900000", timeBasis: "YTD" }),
  observation({ kpiId: "ebitda", value: "-1200000" }),
  observation({ kpiId: "noi", value: "3800000" }),
];

describe("report component rendering", () => {
  it("renders the executive cards, including a missing card's expected identity", () => {
    const html = renderToStaticMarkup(<ExecSummary cards={buildExecCards(metrics, rows, PERIOD)} monthName="October" />);
    expect(html).toContain("Adjusted EBITDA");
    expect(html).toContain("$3.8M");
    expect(html).toContain("\u2212$1.2M");
    // The YTD card has no observation; it names the identity instead of a number.
    expect(html).toContain("Not loaded. Expected identity: YTD actual");
  });

  it("renders the six comparison columns and an empty cell for missing data", () => {
    const table = buildReportRows(metrics, rows);
    const html = renderToStaticMarkup(<ComparisonTable rows={orderByCatalogue(table, BASE_BUSINESS_LINES)} monthName="October" />);
    expect(html).toContain("vs budget");
    expect(html).toContain("vs prior year");
    expect(html).toContain("Year to date");
    expect(html).toContain("Revenue");
    expect(html).toContain("—");
  });

  it("renders a population's operating table with group headings", () => {
    const section = {
      id: "reported",
      scopeLabel: "Finance reported",
      rows: [],
      groups: [{ id: "trevpar", label: "TRevPAR", rows: buildReportRows([metric({ id: "t", name: "TRevPAR ex-OTA", unit: "USD" })], [observation({ kpiId: "t", value: "200", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" })]) }],
      kind: "operating" as const,
    };
    const html = renderToStaticMarkup(<ReportSectionTable section={section} monthName="October" />);
    expect(html).toContain("Finance reported");
    expect(html).toContain("TRevPAR");
    expect(html).toContain("$200");
  });

  it("renders a pillar scorecard with loaded and expected lines", () => {
    const acquired = { ...metric({ id: "acq", name: "Acquired EBITDA closed" }), strategicAreaId: null };
    const scorecard = buildPillarScorecard({ id: null, code: "M&A", name: "M&A" }, [acquired], [observation({ kpiId: "acq", value: "26000000" })], PERIOD);
    const html = renderToStaticMarkup(<PillarScorecardDetails scorecard={scorecard} monthName="October" />);
    expect(html).toContain("Detailed scorecard");
    expect(html).toContain("Acquired EBITDA closed");
    expect(html).toContain("expected, no definition linked");
    expect(html).toContain("$26.0M");
  });

  it("renders a chart with its data table, and an honest empty state", () => {
    const chart = buildTrendChart(TREND_CHART_SPECS[1], [metric({ id: "ad", name: "TRevPAR AwayDNA PMS" })], [
      observation({ kpiId: "ad", value: "100", reportingPeriod: "2026-09", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED", revision: 2 }),
      observation({ kpiId: "ad", value: "110", reportingPeriod: "2026-10", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" }),
    ]);
    const html = renderToStaticMarkup(<TrendChartCard chart={chart} />);
    expect(html).toContain("<svg");
    expect(html).toContain("Sep 26");
    expect(html).toContain("Show the numbers");
    expect(html).toContain("* restated value");

    const empty = renderToStaticMarkup(<TrendChartCard chart={buildTrendChart(TREND_CHART_SPECS[0], [], [])} />);
    // Each series says in the review's own terms what it needs; the Base Business
    // line states that its accounting basis is not confirmed.
    expect(empty).toContain("LTM actual · LTM Pro Forma Lender EBITDA");
    expect(empty).toContain("does not state that series&#x27; accounting basis");
  });

  it("breaks the chart line where a month is missing instead of interpolating", () => {
    const chart = buildTrendChart(TREND_CHART_SPECS[1], [metric({ id: "ad", name: "TRevPAR AwayDNA PMS" })], [
      observation({ kpiId: "ad", value: "100", reportingPeriod: "2026-07", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" }),
      // August is absent, so July and September must not be joined by a line.
      observation({ kpiId: "ad", value: "120", reportingPeriod: "2026-09", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" }),
    ]);
    const html = renderToStaticMarkup(<TrendChartCard chart={chart} />);
    const paths = html.match(/<path d="M/g) ?? [];
    // One segment per isolated point, plus the two gridline-free series segments.
    expect(paths.length).toBe(2);
    expect(html).toContain("A line breaks where a month has no observation");
  });

  it("renders the brand churn table with totals and no invented percentage total", () => {
    const definitions = [
      metric({ id: "bookable", name: "Bookable units", unit: "count" }),
      metric({ id: "month", name: "Churned units", unit: "count" }),
      metric({ id: "ltm-pct", name: "LTM churn %", unit: "percent" }),
    ];
    const brandRows = [
      observation({ kpiId: "bookable", value: "100", entityId: "Brand A", entityScope: "BRAND", timeBasis: "POINT_IN_TIME" }),
      observation({ kpiId: "month", value: "5", entityId: "Brand A", entityScope: "BRAND", timeBasis: "MONTHLY" }),
      observation({ kpiId: "ltm-pct", value: "25", entityId: "Brand A", entityScope: "BRAND", timeBasis: "LTM" }),
    ];
    const churn = buildBrandChurn(definitions, brandRows, PERIOD);
    const html = renderToStaticMarkup(<BrandChurnTable churn={churn} monthName="October" />);
    expect(html).toContain("Brand A");
    expect(html).toContain("High churn");
    expect(html).toContain("Total · 1 brands");
    expect(html).toContain("percentages are not averaged");
    // Each column names the time basis it reads, and nothing was skipped.
    expect(html).toContain("point in time");
    expect(html).toContain("trailing 12 months");
    expect(html).not.toContain("not shown because the time basis");
  });

  it("renders the empty brand state without inventing rows", () => {
    const churn = buildBrandChurn([metric({ id: "bookable", name: "Bookable units" })], [], PERIOD);
    const html = renderToStaticMarkup(<BrandChurnTable churn={churn} monthName="October" />);
    expect(html).toContain("No brand-level churn observations are loaded");
  });

  it("labels Base Business as its own population, never as consolidated", () => {
    expect(BASE_BUSINESS_SCOPE.reportingScope).toBe("BASE_BUSINESS");
    expect(BASE_BUSINESS_SCOPE.entityScope).toBe("BASE_BUSINESS");
  });
});
