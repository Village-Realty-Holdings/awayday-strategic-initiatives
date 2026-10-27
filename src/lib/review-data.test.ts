import { beforeEach, describe, expect, it, vi } from "vitest";

// getReviewPlan with Prisma mocked: FY27-style plans use their StrategicArea
// rows; FY26-style plans (no areas) get areas synthesised from cimDriver. The
// SI status and update text come only from the requested period's update.

const { getActivePlan, planFindUnique, areaFindMany, initiativeFindMany } = vi.hoisted(() => ({
  getActivePlan: vi.fn(),
  planFindUnique: vi.fn(),
  areaFindMany: vi.fn(),
  initiativeFindMany: vi.fn(),
}));

vi.mock("@/lib/active-plan", () => ({ getActivePlan }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    planVersion: { findUnique: planFindUnique },
    strategicArea: { findMany: areaFindMany },
    initiative: { findMany: initiativeFindMany },
  },
}));

import { getReviewPlan } from "./review-data";

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
    problem: "Cut analysis to close.",
    quantMetric: "Analysis-to-close days",
    quantTarget: "30 days",
    valueWhenComplete: null,
    updates: [],
    milestones: [],
    actionItems: [],
    eltRequests: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  planFindUnique.mockResolvedValue({ sourceFileName: "260930 Awayday SI Refresh_v1.pdf" });
});

describe("getReviewPlan", () => {
  it("uses StrategicArea rows and numbers the value drivers", async () => {
    getActivePlan.mockResolvedValue({ id: "fy27", code: "FY27", title: "FY27" });
    areaFindMany.mockResolvedValue([
      { id: "a-ma", code: "M&A", name: "M&A", kind: "VALUE_DRIVER", goal: "Deepen our moat", owner: "Ryan McKendry / Curt Stark", kpiName: "Acquired EBITDA closed", kpiTarget: "$26M", kpis: [{ id: "k1", name: "Acquired EBITDA closed", target: "$26M total", observations: [] }] },
      { id: "a-tech", code: "TECH", name: "Tech & AI", kind: "ENABLER", goal: null, owner: "Tom Chess / Mohan Chandolu", kpiName: null, kpiTarget: null, kpis: [] },
    ]);
    initiativeFindMany.mockResolvedValue([
      initiative({
        updates: [
          { reportingPeriod: "2026-10", reviewStatus: "BEHIND", update: "October text", pathForward: null, updatedBy: "Curt Stark" },
          { reportingPeriod: "2026-09", reviewStatus: "AT_RISK", update: "Pre-LOI module in test", pathForward: "Run first deals", updatedBy: "Curt Stark" },
        ],
        milestones: [{ id: "m1", title: "Pre-LOI module live", owner: "Curt Stark", dueAt: new Date("2026-10-30T00:00:00Z"), completedAt: null }],
      }),
      initiative({ id: "i2", code: "FY27-SI-029", name: "Tuck-In Machine", strategicAreaId: "a-tech", teamLead: "Mohan Chandolu" }),
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
      goingFor: "Analysis-to-close days: 30 days",
    });
    expect(si.milestones[0]).toMatchObject({ date: "2026-10-30", done: false, areaCode: "M&A" });
    expect(plan.areas[0].measure).toMatchObject({ name: "Acquired EBITDA closed", value: null, target: "$26M total", rag: "GREY" });
    // No update for the period means "Status TBD".
    expect(plan.areas[1].sis[0]).toMatchObject({ status: null, latestProgress: null, updatedThisPeriod: false });
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
