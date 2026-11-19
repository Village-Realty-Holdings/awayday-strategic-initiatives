import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PillarScorecardDetails } from "./pillar-scorecard";
import { SoWhatList, soWhatToneFromStored } from "./so-whats";
import { buildPillarScorecard, judgeAgainstTarget, type ReportMetric, type ReportObservation } from "@/lib/review-report";
import { parseApprovedPillarStatus } from "@/lib/review-model";
import type { KpiObservationRecord } from "@/lib/kpi";

/**
 * Reporting-period and reporting-population isolation, the supporting-metric
 * display, the stored So-What tones and the presentation properties the layout
 * depends on. Synthetic fixtures only.
 *
 * These are the properties that make the October page safe to read: a month is
 * never borrowed from another month, two populations are never blended into one
 * figure, a metric with no goal is still shown, and a colour never carries the
 * meaning on its own — which is what keeps the page legible in dark mode, light
 * mode and on a narrow screen.
 */

const OCT = "2026-10";
const SEP = "2026-09";

const TREVPAR_AREA = { id: "area-trevpar", code: "TREVPAR", name: "TRevPAR Expansion" };

const REPORTED: ReportMetric = {
  id: "def-reported",
  metricKey: "user_review:trevpar_growth_reported",
  name: "TRevPAR Growth vs PY (Reported)",
  unit: "percent",
  displayFormat: "percent",
  target: "2026 goal +3.3% reported",
  strategicAreaId: "area-trevpar",
  areaCode: "TREVPAR",
};

function observation(overrides: Partial<KpiObservationRecord> & { value: string; kpiId: string }): ReportObservation {
  return {
    reportingPeriod: OCT,
    observedAt: new Date("2026-11-05T12:00:00Z"),
    quality: "VALID",
    publicationState: "APPROVED",
    revision: 1,
    reportingScope: "USER_REVIEWED_REPORTED",
    entityScope: "REPORTED",
    comparisonBasis: "ACTUAL",
    timeBasis: "YTD",
    entityId: null,
    ...overrides,
  } as ReportObservation;
}

// ---------------------------------------------------------------------------
// September history stays September
// ---------------------------------------------------------------------------

describe("reporting-period isolation", () => {
  const rows = [
    observation({ kpiId: "def-reported", value: "5.0", reportingPeriod: SEP }),
    observation({ kpiId: "def-reported", value: "4.1", reportingPeriod: OCT }),
  ];

  it("reads September's own observation for September", () => {
    const scorecard = buildPillarScorecard(TREVPAR_AREA, [REPORTED], rows, SEP);
    const row = scorecard.rows.find((candidate) => candidate.label === REPORTED.name)!;
    expect(row.value).toBe("+5.0%");
    // The October figure must never appear in September's scorecard.
    expect(scorecard.rows.map((candidate) => candidate.value)).not.toContain("+4.1%");
  });

  it("does not borrow another month's value when the month has none", () => {
    const scorecard = buildPillarScorecard(TREVPAR_AREA, [REPORTED], [rows[1]], SEP);
    const row = scorecard.rows.find((candidate) => candidate.label === REPORTED.name)!;
    expect(row.value).toBeNull();
    expect(row.status).toBe("no_data");
    expect(row.statusReason).toBe("no-observation");
  });

  it("keeps each period's approved wording to that period", () => {
    const september = buildPillarScorecard(TREVPAR_AREA, [REPORTED], [rows[0]], SEP, {
      primaryName: REPORTED.name,
      approvedStatus: "Behind",
    });
    const october = buildPillarScorecard(TREVPAR_AREA, [REPORTED], [rows[1]], OCT, {
      primaryName: REPORTED.name,
      approvedStatus: "On track reported · October under PY",
    });
    expect(september.rows[0].approvedLabel).toBe(parseApprovedPillarStatus("Behind")!.wording);
    expect(october.rows[0].approvedLabel).toBe(parseApprovedPillarStatus("On track reported · October under PY")!.wording);
    expect(october.rows[0].status).toBe("on_track");
  });
});

// ---------------------------------------------------------------------------
// Two populations are never blended
// ---------------------------------------------------------------------------

describe("reporting-population isolation", () => {
  const rows = [
    // Reported basis: the actual, the budget on the same basis, and the ex-OTA
    // level in the same period. Only the first two may be compared.
    observation({ kpiId: "def-reported", value: "4.1", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED" }),
    observation({ kpiId: "def-reported", value: "3.3", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED", comparisonBasis: "BUDGET" }),
    observation({ kpiId: "def-reported", value: "0.6", reportingScope: "USER_REVIEWED_EX_OTA", entityScope: "EX_OTA" }),
    observation({ kpiId: "def-reported", value: "2.5", reportingScope: "USER_REVIEWED_EX_OTA", entityScope: "EX_OTA", comparisonBasis: "BUDGET" }),
  ];

  it("compares a value only with a budget on its own population", () => {
    const scorecard = buildPillarScorecard(TREVPAR_AREA, [REPORTED], rows, OCT);
    const row = scorecard.rows.find((candidate) => candidate.label === REPORTED.name)!;
    expect(row.value).toBe("+4.1%");
    // 4.1 − 3.3, never 4.1 − 2.5.
    expect(row.delta.display).toBe("+0.8 pt");
    expect(scorecard.scopeLabels).toContain("Finance reported");
    expect(scorecard.scopeLabels).toContain("Ex-OTA");
  });

  it("names the population beside a figure when more than one is present", () => {
    const scorecard = buildPillarScorecard(TREVPAR_AREA, [REPORTED], rows, OCT);
    const html = renderToStaticMarkup(<PillarScorecardDetails scorecard={scorecard} monthName="October" />);
    expect(html).toMatch(/finance reported/i);
  });
});

// ---------------------------------------------------------------------------
// An observation without a goal is a figure, not missing data
// ---------------------------------------------------------------------------

describe("supporting metrics", () => {
  const unlinked: ReportMetric = {
    id: "def-cac",
    metricKey: "user_review:cash_cac",
    name: "Cash CAC Excluding SMQ and Tuck-ins",
    unit: "usd",
    displayFormat: "currency",
    target: null,
    strategicAreaId: "area-grow",
    areaCode: "GROW",
  };

  it("shows the value and says only that no target is configured", () => {
    const scorecard = buildPillarScorecard(
      { id: "area-grow", code: "GROW", name: "Grow New Units" },
      [unlinked],
      [observation({ kpiId: "def-cac", value: "7306", reportingScope: "BASE_BUSINESS", entityScope: "BASE_BUSINESS" })],
      OCT,
    );
    const row = scorecard.rows.find((candidate) => candidate.label === unlinked.name)!;
    expect(row.value).toBe("$7,306");
    expect(row.status).toBe("no_data");
    expect(row.statusReason).toBe("no-target");
    const html = renderToStaticMarkup(<PillarScorecardDetails scorecard={scorecard} monthName="October" />);
    expect(html).toContain("$7,306");
    expect(html).toContain("No target configured");
    expect(html).not.toMatch(/not loaded/i);
    expect(html).not.toMatch(/no data/i);
  });

  it("does not count a linked definition with no observation as loaded", () => {
    const scorecard = buildPillarScorecard({ id: "area-grow", code: "GROW", name: "Grow New Units" }, [unlinked], [], OCT);
    expect(scorecard.loaded).toBe(0);
    expect(scorecard.missingValue).toBe(1);
    const html = renderToStaticMarkup(<PillarScorecardDetails scorecard={scorecard} monthName="October" />);
    expect(html).toContain("No observation this month");
  });
});

// ---------------------------------------------------------------------------
// Stored So-What tones
// ---------------------------------------------------------------------------

describe("stored So-What tones", () => {
  const stored = [
    { id: "summary", tone: "WARNING" },
    { id: "m-a", tone: "POSITIVE" },
    { id: "grow", tone: "WARNING" },
    { id: "retention", tone: "NEGATIVE" },
    { id: "trevpar", tone: "WARNING" },
    { id: "margin", tone: "WARNING" },
    { id: "guest", tone: "WARNING" },
  ] as const;

  it("renders each item's own colour, and never relies on it alone", () => {
    const items = stored.map((entry) => ({
      id: entry.id,
      headline: `Headline ${entry.id}`,
      body: null,
      tone: soWhatToneFromStored(entry.tone),
    }));
    const html = renderToStaticMarkup(<SoWhatList items={items} tone="positive" />);
    // Each of the seven carries its own tone, in order — the section fallback
    // (positive) is never applied to an item that states its own.
    expect(html.match(/data-so-what-tone="(\w+)"/g)).toEqual([
      'data-so-what-tone="warning"',
      'data-so-what-tone="positive"',
      'data-so-what-tone="warning"',
      'data-so-what-tone="negative"',
      'data-so-what-tone="warning"',
      'data-so-what-tone="warning"',
      'data-so-what-tone="warning"',
    ]);
    // The meaning is spoken as well as coloured, so dark mode and a screen reader
    // both carry it.
    expect(html).toContain("Watch:");
    expect(html).toContain("Positive:");
    expect(html).toContain("Negative:");
  });

  it("maps the stored vocabulary to the rendered one", () => {
    expect(soWhatToneFromStored("POSITIVE")).toBe("positive");
    expect(soWhatToneFromStored("WARNING")).toBe("warning");
    expect(soWhatToneFromStored("NEGATIVE")).toBe("negative");
    expect(soWhatToneFromStored("NEUTRAL")).toBe("neutral");
    expect(soWhatToneFromStored(null)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Presentation properties: same markup in both themes, scrollable when narrow
// ---------------------------------------------------------------------------

describe("layout properties", () => {
  const scorecard = buildPillarScorecard(
    TREVPAR_AREA,
    [REPORTED],
    [observation({ kpiId: "def-reported", value: "4.1" }), observation({ kpiId: "def-reported", value: "3.3", comparisonBasis: "BUDGET" })],
    OCT,
  );

  it("scrolls a wide scorecard instead of overflowing a narrow screen", () => {
    const html = renderToStaticMarkup(<PillarScorecardDetails scorecard={scorecard} monthName="October" />);
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("min-w-[34rem]");
  });

  it("states the status in words, so light and dark mode both read it", () => {
    const html = renderToStaticMarkup(<PillarScorecardDetails scorecard={scorecard} monthName="October" />);
    // Theme tokens only — no literal colour, so the same markup renders in both.
    expect(html).not.toMatch(/(?:color|background):\s*#/i);
    expect(html).toMatch(/data-status="(ahead|on_track|behind)"/);
  });

  it("refuses to judge a month against a period goal", () => {
    expect(judgeAgainstTarget("-0.9", "2026 goal +3.3% reported", "percent", "MONTHLY")).toEqual({
      status: "no_data",
      reason: "no-period-figure",
    });
  });
});
