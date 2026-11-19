import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PillarScorecardDetails } from "./pillar-scorecard";
import { ExecSummary } from "./report-sections";
import { areaStatusSummary, measureGauge, measureValueText, secondaryValueText } from "./review-view";
import { pairedBasisName, parseTargetMarkers, primaryGoalMarker } from "@/lib/review-format";
import { PILLAR_STATUS_RAG, PILLAR_STATUS_WORD, parseApprovedPillarStatus, reviewBasisLabel, type ReviewArea, type ReviewMeasure } from "@/lib/review-model";
import { buildExecCards, buildPillarScorecard, type ReportMetric, type ReportObservation } from "@/lib/review-report";
import type { KpiObservationRecord } from "@/lib/kpi";

/**
 * October 2026 parity: the presentation rules the reviewed report depends on.
 *
 * Synthetic fixtures only. The figures are the ones the October review states, so
 * a formatting or reporting-basis regression shows up as a wrong string here
 * rather than on the live page.
 */

const PERIOD = "2026-10";

function measure(overrides: Partial<ReviewMeasure> & Pick<ReviewMeasure, "name" | "value">): ReviewMeasure {
  return { kpiId: "k", target: null, rag: "GREY", source: "import", ...overrides };
}

const PILLAR_MEASURES: Record<string, ReviewMeasure> = {
  "M&A": measure({ name: "Acquired EBITDA closed", value: "34800000", displayFormat: "currency", unit: "USD", target: "2026 goal $23M · FY27 ~$33M (1/3 tuck-ins) · $47M stretch", basis: "YTD", basisLabel: "YTD", monthValue: "300000", monthLabel: "October", rag: "GREEN" }),
  GROW: measure({ name: "BD Unit Adds (BD Master)", value: "3340", displayFormat: "number", unit: "count", target: null, basis: "YTD", basisLabel: "YTD", monthValue: "330", monthLabel: "October", rag: "GREEN" }),
  RETENTION: measure({ name: "Annualized Unit Churn (Finance)", value: "12.4", displayFormat: "percent", unit: "percent", target: "2026 goal <12%", basis: "YTD", basisLabel: "YTD", monthValue: "12.2", monthLabel: "October", rag: "RED" }),
  TREVPAR: measure({
    name: "TRevPAR Growth vs PY (Reported)",
    value: "4.1",
    displayFormat: "percent",
    unit: "percent",
    target: "2026 goal +3.3% reported",
    basis: "YTD",
    basisLabel: "YTD",
    monthValue: "-0.9",
    monthLabel: "October",
    rag: "AMBER",
    secondary: [
      {
        kpiId: "k-ex",
        name: "TRevPAR Growth vs PY (Ex-OTA)",
        label: "ex-OTA",
        value: "0.6",
        basis: "YTD",
        basisLabel: "YTD",
        displayFormat: "percent",
        unit: "percent",
      },
    ],
  }),
  MARGIN: measure({
    name: "Shop NOI Margin vs PY (Ex-OTA, Percentage Points)",
    value: "0.8",
    displayFormat: "number",
    unit: "percentage_points",
    target: "2026 goal +0.7 pt ex-OTA",
    basis: "YTD",
    basisLabel: "YTD",
    monthValue: "0.5",
    monthLabel: "October",
    rag: "AMBER",
    secondary: [
      {
        kpiId: "k-rep",
        name: "Shop NOI Margin vs PY (Reported, Percentage Points)",
        label: "reported",
        value: "-1",
        basis: "YTD",
        basisLabel: "YTD",
        displayFormat: "number",
        unit: "percentage_points",
      },
    ],
  }),
};

// ---------------------------------------------------------------------------
// 3. The five pillar headline values, through the one shared formatter
// ---------------------------------------------------------------------------

describe("October pillar headline values", () => {
  it("formats each pillar's primary figure and unit", () => {
    expect(measureValueText(PILLAR_MEASURES["M&A"])).toBe("$34.8M");
    expect(measureValueText(PILLAR_MEASURES.GROW)).toBe("3,340");
    expect(measureValueText(PILLAR_MEASURES.RETENTION)).toBe("12.4%");
    expect(measureValueText(PILLAR_MEASURES.TREVPAR)).toBe("+4.1%");
    expect(measureValueText(PILLAR_MEASURES.MARGIN)).toBe("+0.8 pt");
  });

  it("never prints the stored observation string", () => {
    for (const code of ["M&A", "GROW", "RETENTION", "TREVPAR", "MARGIN"]) {
      const text = measureValueText(PILLAR_MEASURES[code]);
      expect(text).not.toBe(PILLAR_MEASURES[code].value);
      expect(text).not.toBe("3340");
    }
  });

  it("formats negative and signed figures without losing the sign or the separator", () => {
    expect(measureValueText(measure({ name: "Adjusted EBITDA", value: "-1200000", displayFormat: "currency", unit: "USD" }))).toBe("\u2212$1.2M");
    expect(measureValueText(measure({ name: "Ending units", value: "14760", displayFormat: "number", unit: "count" }))).toBe("14,760");
    expect(measureValueText(measure({ name: "TRevPAR growth", value: "-0.9", displayFormat: "percent", unit: "percent" }))).toBe("\u22120.9%");
    expect(measureValueText(measure({ name: "Shop NOI margin vs PY", value: "-1", displayFormat: "number", unit: "percentage_points" }))).toBe("\u22121.0 pt");
    expect(measureValueText(measure({ name: "Cash CAC", value: "7306", displayFormat: "currency", unit: "USD" }))).toBe("$7,306");
  });

  it("formats a money measure that declares no format at all", () => {
    // Production's FY27:M&A definition carries neither a display format nor a
    // unit, so the measure's own name has to settle the quantity: the card must
    // still read "$34.8M" and never "34,800,000".
    expect(measureValueText(measure({ name: "Acquired EBITDA closed", value: "34800000", displayFormat: "", unit: "" }))).toBe("$34.8M");
    expect(measureValueText(measure({ name: "Cash CAC", value: "7306" }))).toBe("$7,306");
  });

  it("renders an honest dash rather than a zero when nothing is stored", () => {
    expect(measureValueText(measure({ name: "BD unit adds", value: null }))).toBeNull();
    expect(measureValueText(null)).toBeNull();
  });

  it("formats the secondary figures the same way", () => {
    const trevparSecondary = PILLAR_MEASURES.TREVPAR.secondary![0];
    const marginSecondary = PILLAR_MEASURES.MARGIN.secondary![0];
    expect(secondaryValueText(trevparSecondary)).toBe("+0.6%");
    expect(secondaryValueText(marginSecondary)).toBe("\u22121.0 pt");
    expect(trevparSecondary.label).toBe("ex-OTA");
    expect(marginSecondary.label).toBe("reported");
  });

  it("finds the other-basis definition by the basis its own name states", () => {
    expect(pairedBasisName("TRevPAR Growth vs PY (Reported)")).toEqual({
      label: "reported",
      counterpart: "TRevPAR Growth vs PY (Ex-OTA)",
      counterpartLabel: "ex-OTA",
    });
    expect(pairedBasisName("TRevPAR Growth vs PY (Ex-OTA)")).toEqual({
      label: "ex-OTA",
      counterpart: "TRevPAR Growth vs PY (Reported)",
      counterpartLabel: "reported",
    });
    expect(pairedBasisName("Shop NOI Margin vs PY (Ex-OTA, Percentage Points)")).toEqual({
      label: "ex-OTA",
      counterpart: "Shop NOI Margin vs PY (Reported, Percentage Points)",
      counterpartLabel: "reported",
    });
    // The counter-figure is labelled with *its own* basis, never the headline's,
    // so a reported headline never labels its ex-OTA figure "reported".
    expect(pairedBasisName("TRevPAR Growth vs PY (Reported)")?.counterpartLabel).toBe("ex-OTA");
    expect(pairedBasisName("Shop NOI Margin vs PY (Ex-OTA, Percentage Points)")?.counterpartLabel).toBe("reported");
    // A definition that states no basis has no pair: nothing is guessed.
    expect(pairedBasisName("Shop NOI margin")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Reporting-basis labels
// ---------------------------------------------------------------------------

describe("reporting-basis labels", () => {
  it("labels a year-to-date observation YTD, never with the month's name", () => {
    expect(reviewBasisLabel("YTD", "October")).toBe("YTD");
  });

  it("labels a monthly observation with the month", () => {
    expect(reviewBasisLabel("MONTHLY", "October")).toBe("October");
  });

  it("labels LTM, TTM and point-in-time observations in their own words", () => {
    expect(reviewBasisLabel("LTM", "October")).toBe("LTM");
    expect(reviewBasisLabel("TTM", "October")).toBe("LTM");
    expect(reviewBasisLabel("POINT_IN_TIME", "October")).toBe("Point in time");
    // The application's default basis, as everywhere else.
    expect(reviewBasisLabel(null, "October")).toBe("YTD");
  });

  it("carries the month as context beside a year-to-date headline", () => {
    for (const code of ["M&A", "GROW", "RETENTION", "TREVPAR", "MARGIN"]) {
      expect(PILLAR_MEASURES[code].basisLabel).toBe("YTD");
      expect(PILLAR_MEASURES[code].monthValue).not.toBeNull();
      expect(PILLAR_MEASURES[code].monthLabel).toBe("October");
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Scorecard status methodology
// ---------------------------------------------------------------------------

function observation(overrides: Partial<KpiObservationRecord> & { value: string; kpiId: string }): ReportObservation {
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

function metric(overrides: Partial<ReportMetric> & Pick<ReportMetric, "id" | "name">): ReportMetric {
  return { metricKey: `user_review:${overrides.id}`, unit: "USD", displayFormat: "currency", target: null, strategicAreaId: null, areaCode: null, ...overrides };
}

const OCTOBER_PILLARS: { code: string; approved: string; status: "ahead" | "on_track" | "behind"; metric: ReportMetric; month: string; ytd: string }[] = [
  {
    code: "M&A",
    approved: "Ahead",
    status: "ahead",
    metric: metric({ id: "acq", name: "Acquired EBITDA closed", target: "2026 goal $23M · FY27 ~$33M (1/3 tuck-ins) · $47M stretch" }),
    month: "300000",
    ytd: "34800000",
  },
  {
    code: "GROW",
    approved: "Ahead · CAC off track",
    status: "ahead",
    // The 2026 goal is not yet stored for this definition; the approved status stands.
    metric: metric({ id: "bd", name: "BD Unit Adds (BD Master)", unit: "count", displayFormat: "number", target: null }),
    month: "330",
    ytd: "3340",
  },
  {
    code: "RETENTION",
    approved: "Behind · October beat budget",
    status: "behind",
    metric: metric({ id: "churn", name: "Annualized Unit Churn (Finance)", unit: "percent", displayFormat: "percent", target: "2026 goal <12%" }),
    month: "12.2",
    ytd: "12.4",
  },
  {
    code: "TREVPAR",
    approved: "On track reported · October under PY",
    status: "on_track",
    metric: metric({ id: "trevpar", name: "TRevPAR Growth vs PY (Reported)", unit: "percent", displayFormat: "percent", target: "2026 goal +3.3% reported" }),
    month: "-0.9",
    ytd: "4.1",
  },
  {
    code: "MARGIN",
    approved: "On goal ex-OTA · behind reported",
    status: "on_track",
    metric: metric({
      id: "margin",
      name: "Shop NOI Margin vs PY (Ex-OTA, Percentage Points)",
      unit: "percentage_points",
      displayFormat: "number",
      target: "2026 goal +0.7 pt ex-OTA",
    }),
    month: "0.5",
    ytd: "0.8",
  },
];

describe("scorecard status methodology", () => {
  it("judges the year-to-date figure against the 2026 goal, never the month", () => {
    for (const pillar of OCTOBER_PILLARS) {
      const rows = [observation({ kpiId: pillar.metric.id, value: pillar.month, timeBasis: "MONTHLY" }), observation({ kpiId: pillar.metric.id, value: pillar.ytd, timeBasis: "YTD" })];
      const scorecard = buildPillarScorecard({ id: null, code: pillar.code, name: pillar.code }, [pillar.metric], rows, PERIOD);
      const row = scorecard.rows.find((candidate) => candidate.label === pillar.metric.name)!;
      expect(row.basisLabel).toBe("YTD");
      expect(row.value).not.toBe(pillar.month);
    }
  });

  it("lets the approved October status win, so headline, scorecard and gauge agree", () => {
    for (const pillar of OCTOBER_PILLARS) {
      const rows = [observation({ kpiId: pillar.metric.id, value: pillar.month, timeBasis: "MONTHLY" }), observation({ kpiId: pillar.metric.id, value: pillar.ytd, timeBasis: "YTD" })];
      const scorecard = buildPillarScorecard({ id: null, code: pillar.code, name: pillar.code }, [pillar.metric], rows, PERIOD, {
        primaryName: pillar.metric.name,
        approvedStatus: pillar.approved,
      });
      const row = scorecard.rows.find((candidate) => candidate.label === pillar.metric.name)!;
      expect(row.status).toBe(pillar.status);
      expect(row.statusReason).toBe("approved");
      // The scorecard shows the approved statement itself, so a combined reading
      // cannot collapse to its first word and disagree with the headline card.
      const approvedForRow = parseApprovedPillarStatus(pillar.approved)!;
      expect(row.approvedLabel).toBe(approvedForRow.wording);
      expect(renderToStaticMarkup(<PillarScorecardDetails scorecard={scorecard} monthName="October" />)).toContain(
        approvedForRow.custom ? pillar.approved : PILLAR_STATUS_WORD[approvedForRow.status],
      );
      // The pillar's own badge uses the same mapping.
      const approved = parseApprovedPillarStatus(pillar.approved)!;
      expect(PILLAR_STATUS_RAG[approved.status]).toBe(pillar.status === "ahead" ? "GREEN" : pillar.status === "on_track" ? "AMBER" : "RED");
      // A combined statement is shown exactly as approved (both halves), and is
      // flagged as the reviewer's own wording; a bare status word reads as the
      // status itself. The colour still comes from the status word alone.
      const trailing = pillar.approved.replace(/^(Ahead|On track|On goal|Behind)\s*·?\s*/i, "").trim();
      expect(approved.wording).toBe(trailing ? pillar.approved : PILLAR_STATUS_WORD[approved.status]);
      expect(approved.custom).toBe(Boolean(trailing));
    }
  });

  it("does not contradict the approved status when the monthly figure is judged instead", () => {
    // The old defect: October's month against the annual goal gave TRevPAR "Behind"
    // and Retention "On track" — both the opposite of the reviewed status.
    const trevpar = OCTOBER_PILLARS.find((pillar) => pillar.code === "TREVPAR")!;
    const monthlyOnly = buildPillarScorecard({ id: null, code: "TREVPAR", name: "TREVPAR" }, [trevpar.metric], [observation({ kpiId: trevpar.metric.id, value: "-0.9", timeBasis: "MONTHLY" })], PERIOD);
    expect(monthlyOnly.rows[0].status).toBe("no_data");
    expect(monthlyOnly.rows[0].statusReason).toBe("no-period-figure");

    const retention = OCTOBER_PILLARS.find((pillar) => pillar.code === "RETENTION")!;
    const scorecard = buildPillarScorecard({ id: null, code: "RETENTION", name: "RETENTION" }, [retention.metric], [
      observation({ kpiId: retention.metric.id, value: "12.2", timeBasis: "MONTHLY" }),
      observation({ kpiId: retention.metric.id, value: "12.4", timeBasis: "YTD" }),
    ], PERIOD);
    // Judged on the year, churn is over the <12% goal, which agrees with "Behind".
    expect(scorecard.rows[0].status).toBe("behind");
  });
});

// ---------------------------------------------------------------------------
// 7. Gauge targets: one goal, FY27 kept and labelled
// ---------------------------------------------------------------------------

function area(code: string, measure: ReviewMeasure): ReviewArea {
  return { id: null, code, name: code, kind: "VALUE_DRIVER", number: 1, goal: null, owner: null, ownerLine: null, measure, sis: [] };
}

describe("pillar gauges", () => {
  // The gauge renders each marker's label and its figure separately, so these
  // assertions read the figure from `value` and what it is from `label`.
  const figures = (gauge: { targets: readonly { value: number }[] }) => gauge.targets.map((target) => target.value);
  const labels = (gauge: { targets: readonly { label: string }[] }) => gauge.targets.map((target) => target.label);

  it("plots the 2026 goal, the FY27 budget and the FY27 stretch as three markers", () => {
    const gauge = measureGauge(area("M&A", PILLAR_MEASURES["M&A"]))!;
    // $23M is the 2026 goal; ~$33M the FY27 budget; $47M the FY27 stretch.
    expect(figures(gauge)).toEqual([23_000_000, 33_000_000, 47_000_000]);
    expect(labels(gauge)).toEqual(["2026 goal", "FY27 budget", "Stretch"]);
    // The superseded "$26M total" planning total is no longer a marker at all,
    // under any label, so it can never read as a second 2026 goal.
    expect(figures(gauge)).not.toContain(26_000_000);
  });

  it("labels the FY27 figure FY27, and only the 2026 figure a goal", () => {
    const markers = parseTargetMarkers(PILLAR_MEASURES["M&A"].target!);
    const goals = markers.filter((marker) => marker.style === "goal");
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ value: 23_000_000, reference: "2026" });
    expect(markers.filter((marker) => marker.reference === "FY27").map((marker) => marker.value)).toEqual([33_000_000]);
  });

  it("keeps the FY27 budget and the stretch, labelled with their own context", () => {
    const gauge = measureGauge(area("MARGIN", measure({ name: "Shop NOI margin vs PY", value: "0.8", target: "2026 goal +0.7 pt (ex-OTA) · FY27 +0.25 pt (1 pt stretch), ex-OTA" })))!;
    expect(figures(gauge)).toEqual([0.7, 0.25, 1]);
    expect(labels(gauge)).toEqual(["2026 goal", "FY27 budget", "Stretch"]);
    // Percentage points, not percentages: the gauge prints "+0.8 pt".
    expect(gauge.format.kind).toBe("points");
    // Nothing is invented for a target text that states no figure.
    expect(measureGauge(area("GROW", measure({ name: "BD unit adds", value: "3340", target: null })))).toBeNull();
  });

  it("plots Grow's count budgets on a count axis, never a percentage one", () => {
    // The approved goal line states the YTD budget, the full-year budget and
    // FY27 growth percentages. Only the count figures can be plotted against a
    // unit count, and the axis is the measure's own unit — not the "%" in the
    // prose, which would have printed 3,340 as a percentage.
    const gauge = measureGauge(
      area("GROW", measure({ name: "BD Unit Adds (BD Master)", value: "3340", displayFormat: "number", unit: "count", target: "YTD budget 2,608 (+28%) · full-year budget 3,152 already passed · FY27 22% gross adds (30% stretch)" })),
    )!;
    expect(gauge.format.kind).toBe("count");
    expect(figures(gauge)).toEqual([2608, 3152]);
  });

  it("keeps the approved Grow status when the goal line states only budgets", () => {
    // Every figure on the approved Grow line is a budget or a growth plan, so no
    // 2026 goal can be derived from it — and none is invented to replace one.
    const markers = parseTargetMarkers(PILLAR_MEASURES.GROW.target ?? "YTD budget 2,608 (+28%) · full-year budget 3,152 already passed · FY27 22% gross adds (30% stretch)");
    expect(primaryGoalMarker(markers)).toBeNull();
    expect(primaryGoalMarker(markers, "count")).toBeNull();
    expect(markers.filter((marker) => marker.style === "budget" && marker.unit === "count").map((marker) => marker.value)).toEqual([2608, 3152]);
  });

  it("refuses a gauge whose axis would mix a level with growth percentages", () => {
    expect(measureGauge(area("GROW", measure({ name: "BD unit adds", value: "3340", target: "23% budget; 28% stretch" })))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 9. Executive card comparisons
// ---------------------------------------------------------------------------

const execMetrics = [
  metric({ id: "ebitda", name: "Adjusted EBITDA", metricKey: "user_review:base_adjusted_ebitda" }),
  metric({ id: "lender", name: "LTM Pro Forma Lender EBITDA", metricKey: "user_review:ltm_pf_lender_ebitda" }),
  metric({ id: "noi", name: "Shop NOI", metricKey: "user_review:base_shop_noi" }),
];

describe("executive summary card comparisons", () => {
  it("shows the comparison when the budget observation exists", () => {
    const cards = buildExecCards(execMetrics, [
      observation({ kpiId: "ebitda", value: "-1200000", timeBasis: "MONTHLY" }),
      observation({ kpiId: "ebitda", value: "-1000000", timeBasis: "MONTHLY", comparisonBasis: "BUDGET" }),
    ], PERIOD);
    const card = cards[0];
    expect(card.value).toBe("\u2212$1.2M");
    expect(card.delta.display).toBe("\u2212$200K");
    expect(card.comparisonState).toBe("loaded");
    expect(card.missingIdentities).toEqual([]);
  });

  it("names the exact missing identity instead of claiming nothing loaded", () => {
    const cards = buildExecCards(execMetrics, [
      observation({ kpiId: "ebitda", value: "-1200000", timeBasis: "MONTHLY" }),
      observation({ kpiId: "noi", value: "3800000", timeBasis: "MONTHLY" }),
      observation({ kpiId: "lender", value: "136000000", timeBasis: "LTM" }),
    ], PERIOD);
    const monthEbitda = cards.find((card) => card.id === "month-adjusted-ebitda")!;
    // The value is present; only the comparison is absent.
    expect(monthEbitda.value).toBe("\u2212$1.2M");
    expect(monthEbitda.comparisonState).toBe("no-budget-or-prior-year");
    expect(monthEbitda.deltaLabel).not.toMatch(/not loaded/i);
    expect(monthEbitda.missingIdentities).toEqual([
      "Month budget · Adjusted EBITDA · Base Business",
      "Month prior year · Adjusted EBITDA · Base Business",
    ]);
    const html = renderToStaticMarkup(<ExecSummary cards={cards} monthName="October" />);
    expect(html).toContain("Required to compare: Month budget · Adjusted EBITDA · Base Business");
  });

  it("keeps the sign out of the colour decision", () => {
    // A positive amount can still be under budget: the tone comes from the delta
    // and the declared direction, not from the level.
    const cards = buildExecCards(execMetrics, [
      observation({ kpiId: "noi", value: "3800000", timeBasis: "MONTHLY" }),
      observation({ kpiId: "noi", value: "4400000", timeBasis: "MONTHLY", comparisonBasis: "BUDGET" }),
    ], PERIOD);
    const card = cards.find((candidate) => candidate.id === "month-shop-noi")!;
    expect(card.value).toBe("$3.8M");
    expect(card.delta.value).toBeLessThan(0);
    expect(card.delta.against).toBe(4400000);
  });
});

// ---------------------------------------------------------------------------
// 10. Missing observation vs missing target
// ---------------------------------------------------------------------------

describe("what is missing, said precisely", () => {
  const definition = (overrides: Partial<ReportMetric>) => metric({ id: "x", name: "Support cost %", unit: "percent", displayFormat: "percent", ...overrides });

  it("A. lists a definition with no observation as such", () => {
    const scorecard = buildPillarScorecard({ id: null, code: "MARGIN", name: "MARGIN" }, [definition({ target: "2026 goal 8%" })], [], PERIOD);
    const row = scorecard.rows.find((candidate) => candidate.label === "Support cost %")!;
    expect(row.value).toBeNull();
    expect(row.statusReason).toBe("no-observation");
    expect(scorecard.missingValue).toBe(1);
    expect(scorecard.loaded).toBe(0);
  });

  it("B. shows an observation with no target normally, and says the target is absent", () => {
    const scorecard = buildPillarScorecard({ id: null, code: "MARGIN", name: "MARGIN" }, [definition({ target: null })], [
      observation({ kpiId: "x", value: "12", timeBasis: "YTD" }),
    ], PERIOD);
    const row = scorecard.rows.find((candidate) => candidate.label === "Support cost %")!;
    expect(row.value).toBe("12.0%");
    expect(row.statusReason).toBe("no-target");
    expect(row.deltaLabel).toBe("No budget or prior-year figure");
  });

  it("D/F. names a goal written in another quantity instead of rating it", () => {
    const scorecard = buildPillarScorecard({ id: null, code: "GROW", name: "GROW" }, [metric({ id: "bd", name: "BD unit adds", unit: "count", displayFormat: "number", target: "2026 goal 23% growth" })], [
      observation({ kpiId: "bd", value: "3340", timeBasis: "YTD" }),
    ], PERIOD);
    const row = scorecard.rows[0];
    expect(row.value).toBe("3,340");
    expect(row.status).toBe("no_data");
    expect(row.statusReason).toBe("goal-not-comparable");
  });

  it("E. names an expected line with no definition linked", () => {
    const scorecard = buildPillarScorecard({ id: null, code: "M&A", name: "M&A" }, [], [], PERIOD);
    expect(scorecard.expectedMissing).toBeGreaterThan(0);
    expect(scorecard.rows.every((row) => row.expectedOnly && row.statusReason === "no-definition")).toBe(true);
  });

  it("renders those states without the misleading count labels", () => {
    const scorecard = buildPillarScorecard({ id: null, code: "MARGIN", name: "MARGIN" }, [definition({ target: null })], [observation({ kpiId: "x", value: "12", timeBasis: "YTD" })], PERIOD);
    const html = renderToStaticMarkup(<PillarScorecardDetails scorecard={scorecard} monthName="October" />);
    expect(html).toContain("No target configured");
    expect(html).not.toContain("All 1 measure behind");
    expect(html).not.toContain("Not loaded");
    // The value column is not captioned with the month: a YTD figure is labelled YTD.
    expect(html).not.toContain(">October</th>");
    expect(html).toContain("with a value");
  });

  it("does not turn an unjudged scorecard into a grey count chip", () => {
    const scorecard = buildPillarScorecard({ id: null, code: "GROW", name: "GROW" }, [metric({ id: "bd", name: "BD unit adds", unit: "count", displayFormat: "number", target: null })], [
      observation({ kpiId: "bd", value: "3340", timeBasis: "YTD" }),
    ], PERIOD);
    // One measure, no verdict: the chip would have said "All 0 measure(s) behind".
    expect(areaStatusSummary(scorecard)).toBeNull();
  });
});
