import { beforeEach, describe, expect, it, vi } from "vitest";

// getReviewPlan with Prisma mocked: FY27-style plans use their StrategicArea
// rows; FY26-style plans (no areas) get areas synthesised from cimDriver. The
// SI status and update text come only from the requested period's update.

const { getActivePlan, planFindUnique, areaFindMany, definitionFindMany, initiativeFindMany, observationFindMany, updateFindMany, periodFindMany, periodFindUnique } = vi.hoisted(() => ({
  definitionFindMany: vi.fn(),
  getActivePlan: vi.fn(),
  planFindUnique: vi.fn(),
  areaFindMany: vi.fn(),
  initiativeFindMany: vi.fn(),
  observationFindMany: vi.fn(),
  updateFindMany: vi.fn(),
  periodFindMany: vi.fn(),
  periodFindUnique: vi.fn(),
}));

vi.mock("@/lib/active-plan", () => ({ getActivePlan }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    planVersion: { findUnique: planFindUnique },
    strategicArea: { findMany: areaFindMany },
    kpiDefinition: { findMany: definitionFindMany },
    initiative: { findMany: initiativeFindMany },
    kpiObservation: { findMany: observationFindMany },
    initiativeUpdate: { findMany: updateFindMany },
    reviewPeriod: { findMany: periodFindMany, findUnique: periodFindUnique },
  },
}));

import { getReviewPeriod, getReviewPlan, resolvePeriod } from "./review-data";

/** A complete KpiMeasureMapping row for a test fixture. */
function mapping(over: Record<string, unknown> = {}) {
  return {
    active: true,
    calculation: "DIRECT",
    inputMetricKey: null,
    denominatorMetricKey: null,
    timeBasis: "YTD",
    displayFormat: "number",
    higherIsBetter: true,
    targetBudget: null,
    targetStretch: null,
    ...over,
  };
}

function initiative(over: Record<string, unknown>) {
  return {
    id: "i1",
    code: "FY27-SI-001",
    name: "Build tuck-in M&A machine",
    cimDriver: null,
    strategicAreaId: "a-ma",
    teamLead: "Curt Stark",
    secondaryLead: "Ryan McKendry",
    ownerUserId: null,
    status: "ON_TRACK",
    quantMetric: "Analysis-to-close days",
    quantTarget: "30 days",
    valueWhenComplete: "Close tuck-ins faster.",
    updates: [],
    milestones: [],
    actionItems: [],
    eltRequests: [],
    measures: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  planFindUnique.mockResolvedValue({ sourceFileName: "260930 Awayday SI Refresh_v1.pdf" });
});

describe("getReviewPlan", () => {
  it("puts the SI's latest value and its red / yellow / green on the card, frozen once published", async () => {
    getActivePlan.mockResolvedValue({ id: "fy27", code: "FY27", title: "FY27" });
    areaFindMany.mockResolvedValue([{ id: "a-ma", code: "M&A", name: "M&A", kind: "VALUE_DRIVER", goal: null, owner: null, kpiName: null, kpiTarget: null, kpis: [] }]);
    const at = new Date("2026-01-01T00:00:00Z");
    const reading = (value: number, asOf: string) => ({ value, asOf: new Date(`${asOf}T00:00:00Z`), createdAt: at });
    initiativeFindMany.mockResolvedValue([
      initiative({ measures: [{ name: "Score", kind: "KPI", unit: "NUMBER", baseline: 2, target: 3, order: 0, createdAt: at, readings: [reading(2, "2026-10-31"), reading(3, "2026-11-03")] }] }),
      initiative({ id: "i2", code: "FY27-SI-002" }),
    ]);

    let plan = await getReviewPlan("2026-10");
    expect(plan.areas[0].sis[0].value).toEqual({ name: "Score", latest: "3", target: "3", rag: "GREEN" });
    expect(plan.areas[0].sis[1].value).toBeNull();

    periodFindUnique.mockResolvedValueOnce({ status: "PUBLISHED" });
    plan = await getReviewPlan("2026-10");
    expect(plan.areas[0].sis[0].value).toEqual({ name: "Score", latest: "2", target: "3", rag: "RED" });
  });

  it("works a mapped measure out from imported metrics, and a value on the measure wins", async () => {
    const mapping = { active: true, calculation: "YOY_PCT", inputMetricKey: "trevpar_finance", denominatorMetricKey: null, timeBasis: "YTD", displayFormat: "percent", higherIsBetter: true, targetBudget: 1, targetStretch: 5 };
    const obs = (value: string, comparisonBasis: string) => ({ kpiId: "t", value, reportingPeriod: "2026-09", observedAt: new Date("2026-09-30"), refreshedAt: new Date("2026-10-23"), quality: "VALID", publicationState: "APPROVED", revision: 1, reportingScope: "AWAYDAY_CONSOLIDATED", comparisonBasis, timeBasis: "YTD", entityScope: "CONSOLIDATED", entityId: "AWAYDAY_CONSOLIDATED", authorityRank: 15, sourceCategory: "ares_lightbay_financials" });
    const area = (observations: unknown[]) => ({ id: "a-t", code: "TREVPAR", name: "TRevPAR Expansion", kind: "VALUE_DRIVER", goal: null, owner: null, kpiName: "TRevPAR growth (YoY)", kpiTarget: "2026 goal 1%; FY27 1% budget; 5% stretch", kpis: [{ id: "k-t", name: "TRevPAR growth (YoY)", target: "2026 goal 1%; FY27 1% budget; 5% stretch", measureMapping: mapping, observations }] });
    getActivePlan.mockResolvedValue({ id: "fy27", code: "FY27", title: "FY27" });
    initiativeFindMany.mockResolvedValue([]);
    definitionFindMany.mockResolvedValue([{ metricKey: "trevpar_finance", name: "TRevPAR (Finance definition)", observations: [obs("136.30", "ACTUAL"), obs("133.00", "PRIOR_YEAR")] }]);

    areaFindMany.mockResolvedValue([area([])]);
    const derived = (await getReviewPlan("2026-09")).areas[0].measure;
    expect(derived).toMatchObject({ value: "+2.5%", rag: "GREEN", source: "derived", inputs: ["TRevPAR (Finance definition)"] });

    areaFindMany.mockResolvedValue([area([{ ...obs("0.5%", "ACTUAL"), timeBasis: "POINT_IN_TIME", sourceCategory: "MANUAL" }])]);
    const manual = (await getReviewPlan("2026-09")).areas[0].measure;
    expect(manual).toMatchObject({ value: "0.5%", rag: "RED", source: "manual", statusOverride: null });
    expect(manual?.origin?.calculated.value).toBe("+2.5%");

    // A status set by hand shows, and the calculated one stays visible beside it.
    areaFindMany.mockResolvedValue([{ ...area([]), pillarStatuses: [{ status: "BEHIND" }] }]);
    expect((await getReviewPlan("2026-09")).areas[0].measure).toMatchObject({ rag: "RED", calculatedRag: "GREEN", statusOverride: "BEHIND" });

    // Enablers can't have one, even if a row exists.
    areaFindMany.mockResolvedValue([{ ...area([]), kind: "ENABLER", pillarStatuses: [{ status: "BEHIND" }] }]);
    expect((await getReviewPlan("2026-09")).areas[0].measure).toMatchObject({ rag: "GREEN", statusOverride: null });
  });

  it("uses StrategicArea rows and numbers the value drivers", async () => {
    getActivePlan.mockResolvedValue({ id: "fy27", code: "FY27", title: "FY27" });
    areaFindMany.mockResolvedValue([
      { id: "a-ma", code: "M&A", name: "M&A", kind: "VALUE_DRIVER", goal: "Deepen our moat", owner: "Ryan McKendry / Curt Stark", kpiName: "Acquired EBITDA closed", kpiTarget: "$26M", kpis: [{ id: "k1", name: "Acquired EBITDA closed", target: "$26M total", measureMapping: mapping({ calculation: "DIRECT", displayFormat: "currency", targetBudget: 26_000_000 }), observations: [] }] },
      { id: "a-tech", code: "TECH", name: "Tech & AI", kind: "ENABLER", goal: null, owner: "Tom Chess / Mohan Chandolu", kpiName: null, kpiTarget: null, kpis: [] },
    ]);
    initiativeFindMany.mockResolvedValue([
      initiative({
        updates: [
          { reportingPeriod: "2026-10", status: "OFF_TRACK", update: "October text", pathForward: null, updatedBy: "Curt Stark" },
          { reportingPeriod: "2026-09", status: "AT_RISK", update: "Pre-LOI module in test", pathForward: "Run first deals", updatedBy: "Curt Stark" },
        ],
        milestones: [{ id: "m1", title: "Pre-LOI module live", owner: "Curt Stark", dueAt: new Date("2026-10-30T00:00:00Z"), completedAt: null }],
      }),
      initiative({ id: "i2", code: "FY27-SI-029", name: "Tuck-In Machine", strategicAreaId: "a-tech", teamLead: "Mohan Chandolu", status: "ON_TRACK" }),
    ]);

    const plan = await getReviewPlan("2026-09");
    expect(plan.synthesised).toBe(false);
    expect(plan.areas.map((a) => [a.code, a.kind, a.number, a.sis.length])).toEqual([
      ["M&A", "VALUE_DRIVER", 1, 1],
      ["TECH", "ENABLER", null, 1],
    ]);
    const si = plan.areas[0].sis[0];
    expect(si).toMatchObject({
      shortCode: "SI-001",
      status: "AT_RISK",
      latestProgress: "Pre-LOI module in test",
      whatNext: "Run first deals",
      updatedThisPeriod: true,
      objective: "Close tuck-ins faster.",
      kpi: "Analysis-to-close days: 30 days",
      goingFor: "Analysis-to-close days: 30 days",
    });
    expect(si.milestones[0]).toMatchObject({ date: "2026-10-30", done: false, areaCode: "M&A" });
    expect(plan.areas[0].measure).toMatchObject({ name: "Acquired EBITDA closed", value: null, target: "$26M total", rag: "GREY" });
    // No update for the period falls back to the SI's current status.
    expect(plan.areas[1].sis[0]).toMatchObject({ status: "ON_TRACK", latestProgress: null, updatedThisPeriod: false });
  });

  it("synthesises areas from cimDriver when the plan has none", async () => {
    getActivePlan.mockResolvedValue({ id: "fy26", code: "FY26", title: "FY26" });
    areaFindMany.mockResolvedValue([]);
    initiativeFindMany.mockResolvedValue([
      initiative({ id: "a", code: "TLT-01", cimDriver: "Key Enablers — Talent", strategicAreaId: null, teamLead: "Adam Hamdan" }),
      initiative({ id: "b", code: "GRW-01", cimDriver: "Grow new units", strategicAreaId: null, teamLead: "Ryan Olin" }),
      initiative({ id: "c", code: "M&A-01", cimDriver: "M&A", strategicAreaId: null, teamLead: "Curt Stark" }),
    ]);

    const plan = await getReviewPlan("2026-09");
    expect(plan.synthesised).toBe(true);
    expect(plan.areas.map((a) => [a.name, a.kind, a.number, a.sis.map((s) => s.code)])).toEqual([
      ["M&A", "VALUE_DRIVER", 1, ["M&A-01"]],
      ["Grow new units", "VALUE_DRIVER", 2, ["GRW-01"]],
      ["Talent", "ENABLER", null, ["TLT-01"]],
    ]);
    // Owners come from the initiatives' leads when the area has no owner line.
    expect(plan.areas[2].ownerLine).toBe("Adam Hamdan");
  });
});

describe("primary measure selection", () => {
  const observation = (value: string, over: Record<string, unknown> = {}) => ({
    kpiId: "k",
    value,
    reportingPeriod: "2026-10",
    observedAt: new Date("2026-10-31"),
    refreshedAt: new Date("2026-11-01"),
    quality: "VALID",
    publicationState: "APPROVED",
    revision: 1,
    reportingScope: "AWAYDAY_CONSOLIDATED",
    comparisonBasis: "ACTUAL",
    timeBasis: "POINT_IN_TIME",
    entityScope: "CONSOLIDATED",
    entityId: "AWAYDAY_CONSOLIDATED",
    authorityRank: 15,
    sourceCategory: "MANUAL",
    ...over,
  });
  const area = (kpis: unknown[], over: Record<string, unknown> = {}) => ({
    id: "a-ret",
    code: "RETENTION",
    name: "Owner Retention",
    kind: "VALUE_DRIVER",
    goal: null,
    owner: null,
    kpiName: "Owner unit churn (TTM)",
    kpiTarget: "<12% goal; 12% budget",
    kpis,
    ...over,
  });
  const churnMapping = mapping({ calculation: "DIRECT", higherIsBetter: false, targetBudget: 11 });

  beforeEach(() => {
    getActivePlan.mockResolvedValue({ id: "fy27", code: "FY27", title: "FY27" });
    initiativeFindMany.mockResolvedValue([]);
    definitionFindMany.mockResolvedValue([]);
  });

  it("reads the measure from the KPI with the active mapping, not from list position", async () => {
    const unmappedWithValue = { id: "k-support", name: "AAA supporting metric", target: "5%", measureMapping: null, observations: [observation("4%")] };
    const mapped = { id: "k-primary", name: "Zzz owner unit churn", target: "2026 goal 12%", measureMapping: churnMapping, observations: [observation("9%")] };
    // The supporting KPI sorts first and carries an observation; it must not win.
    areaFindMany.mockResolvedValue([area([unmappedWithValue, mapped])]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ kpiId: "k-primary", name: "Zzz owner unit churn", value: "9%", rag: "GREEN", primary: "selected" });
  });

  it("shows the measure's value in the basis its mapping declares, not the month's figure", async () => {
    // BD unit adds publishes 330 for October and 3,340 year to date. A YTD
    // mapping must show — and judge — the year-to-date fact; showing the month
    // while colouring on the year would describe two different things.
    const grows = (timeBasis: string) => ({
      id: "k-grow",
      name: "BD Unit Adds (BD Master)",
      target: "2026 goal 2,608",
      measureMapping: mapping({ calculation: "DIRECT", timeBasis: "YTD", displayFormat: "number" }),
      observations: [
        observation("330", { timeBasis: "MONTHLY", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED", entityId: null }),
        observation("3340", { timeBasis, reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED", entityId: null }),
      ],
    });
    areaFindMany.mockResolvedValue([area([grows("YTD")], { code: "GROW", name: "Grow New Units" })]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ value: "3340", rag: "GREEN", statusGap: null });
  });

  it("shows the year-to-date figure while refusing a goal stated in another quantity", async () => {
    // The reviewed page's Grow goal is a growth percentage. A unit count cannot
    // be rated against it, so the measure shows its own 3,340 and claims no
    // colour — never 330 against 23%, and never a colour from the month.
    const grow = {
      id: "k-grow",
      name: "BD Unit Adds (BD Master)",
      target: "2026 goal 23% growth",
      measureMapping: mapping({ calculation: "DIRECT", timeBasis: "YTD", displayFormat: "number" }),
      observations: [
        observation("330", { timeBasis: "MONTHLY", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED", entityId: null }),
        observation("3340", { timeBasis: "YTD", reportingScope: "USER_REVIEWED_REPORTED", entityScope: "REPORTED", entityId: null }),
      ],
    };
    areaFindMany.mockResolvedValue([area([grow], { code: "GROW", name: "Grow New Units" })]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure?.value).toBe("3340");
    expect(measure?.rag).toBe("GREY");
    expect(measure?.statusGap).toBe("goal-not-comparable");
  });

  it("is unaffected by a rename or by adding a KPI", async () => {
    const mapped = (name: string) => ({ id: "k-primary", name, target: "2026 goal 12%", measureMapping: churnMapping, observations: [] });
    areaFindMany.mockResolvedValue([area([mapped("Owner unit churn (TTM)")])]);
    const before = (await getReviewPlan("2026-10")).areas[0].measure;
    areaFindMany.mockResolvedValue([area([{ id: "k-new", name: "AAA new metric", measureMapping: null, observations: [] }, mapped("Renamed churn measure")])]);
    const after = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(before?.kpiId).toBe("k-primary");
    expect(after?.kpiId).toBe("k-primary");
  });

  it("shows a neutral state, and no value, when no mapping selects a primary", async () => {
    areaFindMany.mockResolvedValue([
      area([{ id: "k1", name: "Owner unit churn (TTM)", target: "12% budget", measureMapping: null, observations: [observation("9%")] }]),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ kpiId: null, name: "Owner unit churn (TTM)", value: null, rag: "GREY", primary: "missing" });
  });

  it("shows a neutral, named state when two mappings claim to be primary", async () => {
    areaFindMany.mockResolvedValue([
      area([
        { id: "k-b", name: "Owner unit churn (TTM)", measureMapping: churnMapping, observations: [observation("9%")] },
        { id: "k-a", name: "Annualised churn", measureMapping: churnMapping, observations: [] },
      ]),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ kpiId: null, value: null, rag: "GREY", primary: "ambiguous", ambiguousKpis: ["Annualised churn", "Owner unit churn (TTM)"] });
  });

  it("still selects the primary for a period with no observations, without inventing a value", async () => {
    areaFindMany.mockResolvedValue([
      area([{ id: "k-primary", name: "Owner unit churn (TTM)", target: "12% budget", measureMapping: churnMapping, observations: [] }]),
    ]);
    const measure = (await getReviewPlan("2026-08")).areas[0].measure;
    expect(measure).toMatchObject({ kpiId: "k-primary", value: null, rag: "GREY", primary: "selected" });
  });

  it("leaves an unstated direction neutral even when the value looks good", async () => {
    const unknownDirection = mapping({ calculation: "DIRECT", higherIsBetter: null, targetBudget: 11 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k1", name: "Owner unit churn (TTM)", target: "12% budget", measureMapping: unknownDirection, observations: [observation("9%")] }]),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREY", higherIsBetter: null, primary: "selected" });
  });

  it("rates a declared lower-is-better measure against its 2026 goal", async () => {
    areaFindMany.mockResolvedValue([
      area([{ id: "k1", name: "Owner unit churn (TTM)", target: "2026 goal 12%", measureMapping: churnMapping, observations: [observation("9%")] }]),
    ]);
    expect((await getReviewPlan("2026-10")).areas[0].measure).toMatchObject({ rag: "GREEN", higherIsBetter: false });
  });

  it("selects a reviewed October measure once it is linked to the pillar and mapped", async () => {
    // The October report's Grow primary is BD unit adds (BD Master), a reviewed
    // metric, while the FY27 plan's own definition is Gross unit adds. Linking
    // the reviewed definition to the pillar and activating its mapping is the
    // whole configuration: the resolver then picks it, and the FY27 definition
    // stays on the pillar as a supporting row with its mapping switched off.
    const reviewed = {
      id: "k-bd-adds",
      name: "BD unit adds",
      target: "2026 goal 23%",
      measureMapping: mapping({ calculation: "DIRECT", displayFormat: "percent", higherIsBetter: true, targetBudget: 22, active: true }),
      observations: [observation("3340")],
    };
    const planDefinition = {
      id: "k-gross-adds",
      name: "Gross unit adds",
      target: "23% budget; 28% stretch",
      measureMapping: mapping({ calculation: "DIRECT", displayFormat: "percent", higherIsBetter: true, targetBudget: 23, active: false }),
      observations: [],
    };
    areaFindMany.mockResolvedValue([area([planDefinition, reviewed], { code: "GROW", kpiName: "Gross unit adds" })]);
    const grow = (await getReviewPlan("2026-10")).areas[0];
    expect(grow.measure).toMatchObject({ kpiId: "k-bd-adds", name: "BD unit adds", value: "3340", primary: "selected" });
    // Supporting definitions are untouched and keep their own mapping state.
    expect(planDefinition.measureMapping.active).toBe(false);
  });

  it("goes neutral, not alphabetical, when both the reviewed and the plan measure stay active", async () => {
    const active = mapping({ calculation: "DIRECT", higherIsBetter: true, targetBudget: 23, active: true });
    areaFindMany.mockResolvedValue([
      area(
        [
          { id: "k-gross-adds", name: "Gross unit adds", measureMapping: active, observations: [] },
          { id: "k-bd-adds", name: "BD unit adds", measureMapping: active, observations: [observation("3340")] },
        ],
        { code: "GROW", kpiName: "Gross unit adds" },
      ),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ kpiId: null, primary: "ambiguous", value: null, rag: "GREY" });
  });

  it("judges the October status against the 2026 goal, not the FY27 budget beside it", async () => {
    // The reviewed report rates each pillar against its 2026 goal and shows the
    // FY27 budget and stretch next to it. A $24M result against a $20M goal is
    // ahead; the same result against the $26M FY27 budget would only be amber.
    const ma = mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k-ma", name: "Acquired EBITDA closed", target: "2026 goal $20M; FY27 $26M budget; $47M stretch", measureMapping: ma, observations: [observation("$24M")] }], {
        code: "M&A",
        kpiName: "Acquired EBITDA closed",
        kpiTarget: "2026 goal $20M; FY27 $26M budget; $47M stretch",
      }),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREEN", calculatedRag: "GREEN" });
    expect(measure?.origin?.status).toMatchObject({ budget: "$20.0M", reference: "2026 goal" });
  });

  it("never falls back to the mapping's FY27 budget when the definition states no 2026 goal", async () => {
    // The FY27 figures are planning data from the board pre-read. They are shown
    // for context and never determine an October status, so a definition whose
    // target text states only an FY27 budget gets no status at all.
    const ma = mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000, targetStretch: 47_000_000 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k-ma", name: "Acquired EBITDA closed", target: "FY27 $33M budget", measureMapping: ma, observations: [observation("$24M")] }], {
        code: "M&A",
        kpiName: "Acquired EBITDA closed",
      }),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREY", calculatedRag: "GREY", statusGap: "no-goal" });
    expect(measure?.origin?.status).toMatchObject({ budget: null, reference: null, gap: "no-goal", difference: null });
    // The FY27 budget is still reported, in its own context field.
    expect(measure?.origin?.status.context).toBe("FY27 budget $26.0M · stretch $47.0M");
  });

  it("refuses an unlabelled figure that is the mapping's own FY27 budget", async () => {
    // Production's M&A target text reads "$26M total" — the stored FY27 budget
    // written without a label. It is indistinguishable from plain target text, so
    // it must not be read as a 2026 goal: FY27 never determines October status.
    const ma = mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000, targetStretch: 47_000_000 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k-ma", name: "Acquired EBITDA closed", target: "$26M total", measureMapping: ma, observations: [observation("$34.8M")] }], {
        code: "M&A",
        kpiName: "Acquired EBITDA closed",
      }),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREY", calculatedRag: "GREY", statusGap: "no-goal" });
    expect(measure?.origin?.status).toMatchObject({ reference: null, difference: null });
  });

  it("also refuses an unlabelled figure equal to the FY27 stretch", async () => {
    const ma = mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000, targetStretch: 47_000_000 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k-ma", name: "Acquired EBITDA closed", target: "$47M stretch", measureMapping: ma, observations: [observation("$34.8M")] }], {
        code: "M&A",
        kpiName: "Acquired EBITDA closed",
      }),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREY", statusGap: "no-goal" });
  });

  it("still judges an unlabelled goal that is genuinely not the FY27 figures", async () => {
    // A definition that states its own goal without the word "2026" keeps working;
    // only a figure indistinguishable from the FY27 budget/stretch is refused.
    const ma = mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000, targetStretch: 47_000_000 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k-ma", name: "Acquired EBITDA closed", target: "$20M goal", measureMapping: ma, observations: [observation("$24M")] }], {
        code: "M&A",
        kpiName: "Acquired EBITDA closed",
      }),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREEN", calculatedRag: "GREEN", statusGap: null });
    expect(measure?.origin?.status.reference).toBe("goal");
  });

  it("prefers the labelled 2026 goal over the FY27 figure beside it", async () => {
    // After the reviewed configuration the text reads "2026 goal $23M · $26M total":
    // the explicit 2026 goal wins and the FY27 figure stays as context. $28M is
    // 21.7% above $23M (ahead) but only 7.7% above $26M (on track), so the colour
    // proves which figure was used.
    const ma = mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000, targetStretch: 47_000_000 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k-ma", name: "Acquired EBITDA closed", target: "2026 goal $23M · $26M total", measureMapping: ma, observations: [observation("$28M")] }], {
        code: "M&A",
        kpiName: "Acquired EBITDA closed",
      }),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREEN" });
    expect(measure?.origin?.status.reference).toBe("2026 goal");
    expect(measure?.origin?.status.context).toBe("FY27 budget $26.0M · stretch $47.0M");
  });

  it("keeps a status approved by hand even when the calculated one cannot be established", async () => {
    // ReviewPillarStatus is an explicit human approval, so it remains authoritative.
    const ma = mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000 });
    areaFindMany.mockResolvedValue([
      { ...area([{ id: "k-ma", name: "Acquired EBITDA closed", target: "FY27 $26M budget", measureMapping: ma, observations: [observation("$24M")] }], { code: "M&A", kpiName: "Acquired EBITDA closed" }), pillarStatuses: [{ status: "AHEAD" }] },
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREEN", calculatedRag: "GREY", statusOverride: "AHEAD", statusGap: "no-goal" });
  });

  it("treats an unparseable 2026 goal as not configured", async () => {
    const ma = mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k-ma", name: "Acquired EBITDA closed", target: "2026 goal TBD", measureMapping: ma, observations: [observation("$24M")] }], {
        code: "M&A",
        kpiName: "Acquired EBITDA closed",
      }),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREY", calculatedRag: "GREY", statusGap: "no-goal" });
  });

  it("treats a measure mapping with no declared reporting basis as not configured", async () => {
    const ma = mapping({ calculation: "DIRECT", displayFormat: "currency", higherIsBetter: true, targetBudget: 26_000_000, timeBasis: "" });
    areaFindMany.mockResolvedValue([
      area([{ id: "k-ma", name: "Acquired EBITDA closed", target: "2026 goal $23M", measureMapping: ma, observations: [observation("$24M")] }], {
        code: "M&A",
        kpiName: "Acquired EBITDA closed",
      }),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREY", calculatedRag: "GREY", statusGap: "no-basis" });
  });

  it("never rates a unit count against a growth percentage", async () => {
    // Grow's 2026 goal is stated as a growth percentage; the pillar measure is a
    // unit count. No status is claimed from a comparison across quantities.
    const grow = mapping({ calculation: "DIRECT", displayFormat: "percent", higherIsBetter: true, targetBudget: 22 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k-grow", name: "BD unit adds", target: "2026 goal 23%", measureMapping: grow, observations: [observation("3340")] }], {
        code: "GROW",
        kpiName: "BD unit adds",
      }),
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    // The goal is refused for its quantity, and nothing else is substituted, so
    // no status is claimed rather than a confident green from a meaningless ratio.
    expect(measure?.origin?.status.reference).toBeNull();
    expect(measure).toMatchObject({ rag: "GREY", calculatedRag: "GREY", statusGap: "goal-not-comparable" });
  });

  it("keeps reporting populations separate when deriving the primary measure", async () => {
    const yoy = mapping({ calculation: "YOY_PCT", inputMetricKey: "trevpar_finance", higherIsBetter: true, targetBudget: 1 });
    areaFindMany.mockResolvedValue([
      area([{ id: "k1", name: "TRevPAR growth (YoY)", target: "1% budget", measureMapping: yoy, observations: [] }], { code: "TREVPAR", kpiName: "TRevPAR growth (YoY)" }),
    ]);
    // Only shop-scoped rows are published, so the consolidated primary measure
    // cannot be calculated from them.
    definitionFindMany.mockResolvedValue([
      {
        metricKey: "trevpar_finance",
        name: "TRevPAR (Finance definition)",
        observations: [observation("136", { entityScope: "SHOP", entityId: "s1", comparisonBasis: "ACTUAL" }), observation("133", { entityScope: "SHOP", entityId: "s1", comparisonBasis: "PRIOR_YEAR" })],
      },
    ]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ value: null, source: null, rag: "GREY" });
  });
});

describe("review periods", () => {
  it("includes stored months, opens the review on the newest published one and Inbox on the newest open one", async () => {
    observationFindMany.mockResolvedValue([{ reportingPeriod: "2026-09" }]);
    updateFindMany.mockResolvedValue([{ reportingPeriod: "2026-08" }]);
    periodFindMany.mockResolvedValue([
      { id: "2026-10", status: "DRAFT" },
      { id: "2026-09", status: "PUBLISHED" },
    ]);
    expect(await resolvePeriod()).toEqual({ id: "2026-09", periods: ["2026-10", "2026-09", "2026-08"], home: "2026-09", published: ["2026-09"] });
    expect((await resolvePeriod(null, "updates")).id).toBe("2026-10");
    expect((await resolvePeriod("2026-08")).id).toBe("2026-08");
  });

  it("reads the stored header and groups so-whats by scope", async () => {
    observationFindMany.mockResolvedValue([
      { observedAt: new Date("2026-10-13T09:00:00Z"), sourceDocumentName: "September Flash Results" },
      { observedAt: new Date("2026-10-10T09:00:00Z"), sourceDocumentName: null },
    ]);
    periodFindUnique.mockResolvedValue({
      id: "2026-09",
      status: "PUBLISHED",
      preparedBy: "Alex Bevington",
      meetingDate: new Date("2026-10-15T00:00:00Z"),
      updatesDueDate: null,
      dataAsOf: null,
      soWhats: [
        { id: "s2", scope: "M&A", headline: "Four closes", body: "942 units", tone: "POSITIVE" },
        { id: "s1", scope: "SUMMARY", headline: "Shops beat", body: null, tone: null },
        { id: "s3", scope: "FINANCIALS", headline: "Bridge: shops beat, centre spent it", body: null, tone: "WARNING" },
      ],
    });
    const period = await getReviewPeriod("2026-09");
    expect(period).toMatchObject({
      label: "September 2026",
      stored: true,
      status: "PUBLISHED",
      preparedBy: "Alex Bevington",
      meetingDate: "2026-10-15",
      dataAsOf: "2026-10-13",
      dataAsOfOverride: null,
      sources: ["September Flash Results"],
      summary: [{ id: "s1", headline: "Shops beat", body: null, tone: null }],
      // The financial bridge is its own list, never an area of the plan.
      financials: [{ id: "s3", headline: "Bridge: shops beat, centre spent it", body: null, tone: "WARNING" }],
      areaSoWhats: { "M&A": [{ id: "s2", headline: "Four closes", body: "942 units", tone: "POSITIVE" }] },
    });
  });

  it("treats a month with no stored row as an empty draft, and prefers a stored data-as-of", async () => {
    observationFindMany.mockResolvedValue([{ observedAt: new Date("2026-11-10T09:00:00Z"), sourceDocumentName: null }]);
    periodFindUnique.mockResolvedValueOnce(null);
    expect(await getReviewPeriod("2026-10")).toMatchObject({ stored: false, status: "DRAFT", preparedBy: null, summary: [], areaSoWhats: {}, dataAsOf: "2026-11-10" });
    periodFindUnique.mockResolvedValueOnce({ id: "2026-11", status: "DRAFT", preparedBy: null, meetingDate: null, updatesDueDate: null, dataAsOf: new Date("2026-12-01T00:00:00Z"), soWhats: [] });
    expect(await getReviewPeriod("2026-11")).toMatchObject({ dataAsOf: "2026-12-01", observedAsOf: "2026-11-10", dataAsOfOverride: "2026-12-01" });
  });
});

// The October review keeps an approved status whole. The status word decides the
// colour; the reviewer's wording after it is shown as it was approved, so
// "Ahead · CAC off track" never collapses into "Ahead".
describe("approved pillar statuses for a month", () => {
  const areaWith = (status: string | null) => ({
    id: "a-ma",
    code: "M&A",
    name: "M&A",
    kind: "VALUE_DRIVER",
    goal: null,
    owner: null,
    kpiName: "Acquired EBITDA closed",
    kpiTarget: "FY27 $26M budget",
    kpis: [] as unknown[],
    pillarStatuses: status === null ? [] : [{ status }],
  });

  beforeEach(() => {
    getActivePlan.mockResolvedValue({ id: "fy27", code: "FY27", title: "FY27" });
    initiativeFindMany.mockResolvedValue([]);
  });

  it("asks the database only for the month being reviewed", async () => {
    areaFindMany.mockResolvedValue([areaWith(null)]);
    await getReviewPlan("2026-10");
    expect(areaFindMany.mock.calls.at(-1)?.[0]?.include?.pillarStatuses?.where).toEqual({ periodId: "2026-10" });
    await getReviewPlan("2026-09");
    expect(areaFindMany.mock.calls.at(-1)?.[0]?.include?.pillarStatuses?.where).toEqual({ periodId: "2026-09" });
  });

  it("keeps September's plain statuses working and shows no extra wording for them", async () => {
    areaFindMany.mockResolvedValue([areaWith("AHEAD")]);
    const measure = (await getReviewPlan("2026-09")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREEN", statusOverride: "AHEAD", statusWording: null, approvedStatus: "AHEAD" });
  });

  it("keeps a combined October status whole and colours it by its status word", async () => {
    areaFindMany.mockResolvedValue([areaWith("Ahead · CAC off track")]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREEN", statusOverride: "AHEAD", statusWording: "Ahead · CAC off track" });
  });

  it("colours a combined status by its status word, not by the wording after it", async () => {
    areaFindMany.mockResolvedValue([areaWith("Behind · October beat budget")]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "RED", statusOverride: "BEHIND", statusWording: "Behind · October beat budget" });
  });

  it("claims no status when the stored value is not an approved status word", async () => {
    areaFindMany.mockResolvedValue([areaWith("GREEN · looks fine")]);
    const measure = (await getReviewPlan("2026-10")).areas[0].measure;
    expect(measure).toMatchObject({ rag: "GREY", statusOverride: null, statusWording: null });
  });
});
