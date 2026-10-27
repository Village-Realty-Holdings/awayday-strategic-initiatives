import { beforeEach, describe, expect, it, vi } from "vitest";

// Edit Mode's server actions with Prisma, the session and Next mocked: only
// admins and editors may save, a published month's own content is locked, so-
// whats are replaced for one scope only, areas must belong to the active plan,
// and an SI update keeps the month's next-milestone fields.

const m = vi.hoisted(() => ({
  session: { user: { id: "u-ed", name: "Erin Editor", role: "editor" } },
  activePlan: { id: "fy27", code: "FY27", title: "FY27" } as { id: string; code: string; title: string } | null,
  planFindUnique: vi.fn(),
  planUpdate: vi.fn(),
  periodFindUnique: vi.fn(),
  periodUpsert: vi.fn((args: unknown) => ({ op: "upsert", args })),
  soWhatDeleteMany: vi.fn((args: unknown) => ({ op: "deleteMany", args })),
  soWhatCreateMany: vi.fn((args: unknown) => ({ op: "createMany", args })),
  areaFindUnique: vi.fn(),
  areaUpdate: vi.fn(),
  initiativeFindUnique: vi.fn(),
  updateCreate: vi.fn(),
  transaction: vi.fn(async (ops: unknown[]) => ops),
  getReviewPlan: vi.fn(),
  audit: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: m.audit }));
vi.mock("@/lib/active-plan", () => ({ getActivePlan: vi.fn(async () => m.activePlan) }));
vi.mock("@/lib/review-data", () => ({ getReviewPlan: m.getReviewPlan }));
vi.mock("@/lib/session", () => ({
  requireEditor: vi.fn(async () => {
    if (m.session.user.role !== "admin" && m.session.user.role !== "editor") m.redirect("/");
    return m.session;
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    planVersion: { findUnique: m.planFindUnique, update: m.planUpdate },
    reviewPeriod: { findUnique: m.periodFindUnique, upsert: m.periodUpsert },
    reviewSoWhat: { deleteMany: m.soWhatDeleteMany, createMany: m.soWhatCreateMany },
    strategicArea: { findUnique: m.areaFindUnique, update: m.areaUpdate },
    initiative: { findUnique: m.initiativeFindUnique },
    initiativeUpdate: { create: m.updateCreate },
    $transaction: m.transaction,
  },
}));

import { editPlanHeader, editReviewDetails, editSiUpdate, editSoWhats, editStrategicArea } from "@/app/(app)/review-edit-actions";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.session.user = { id: "u-ed", name: "Erin Editor", role: "editor" };
  m.activePlan = { id: "fy27", code: "FY27", title: "FY27" };
  m.periodFindUnique.mockResolvedValue(null);
  m.getReviewPlan.mockResolvedValue({ areas: [{ code: "GROW" }, { code: "MARGIN" }] });
  m.updateCreate.mockResolvedValue({ id: "upd1" });
});

describe("access", () => {
  it("sends viewers home without writing", async () => {
    m.session.user.role = "user";
    await expect(editReviewDetails(form({ periodId: "2026-10" }))).rejects.toThrow("REDIRECT /");
    expect(m.periodUpsert).not.toHaveBeenCalled();
  });
});

describe("editPlanHeader", () => {
  it("saves the active plan's roof", async () => {
    m.planFindUnique.mockResolvedValue({ mission: null, goal: null, values: [] });
    const result = await editPlanHeader(form({ planVersionId: "fy27", mission: "Be the best", goal: "", values: "Care\nCare\nGrit" }));
    expect(result).toEqual({ ok: true });
    expect(m.planUpdate).toHaveBeenCalledWith({ where: { id: "fy27" }, data: { mission: "Be the best", goal: null, values: ["Care", "Grit"] } });
    expect(m.audit).toHaveBeenCalledOnce();
  });

  it("refuses a plan that is no longer active", async () => {
    const result = await editPlanHeader(form({ planVersionId: "fy26", mission: "x" }));
    expect(result.ok).toBe(false);
    expect(m.planUpdate).not.toHaveBeenCalled();
  });
});

describe("editReviewDetails", () => {
  it("creates the month as a draft with its details", async () => {
    const result = await editReviewDetails(form({ periodId: "2026-10", preparedBy: "Alex", meetingDate: "2026-11-05", dataAsOf: "nope" }));
    expect(result).toEqual({ ok: true });
    const call = m.periodUpsert.mock.calls[0][0] as { create: Record<string, unknown> };
    expect(call.create).toMatchObject({ id: "2026-10", preparedBy: "Alex", meetingDate: new Date("2026-11-05T00:00:00Z"), dataAsOf: null });
  });

  it("is locked once the month is published", async () => {
    m.periodFindUnique.mockResolvedValue({ status: "PUBLISHED" });
    const result = await editReviewDetails(form({ periodId: "2026-10", preparedBy: "Alex" }));
    expect(result.ok).toBe(false);
    expect(m.periodUpsert).not.toHaveBeenCalled();
  });
});

describe("editSoWhats", () => {
  it("replaces only the given scope and drops rows for other scopes", async () => {
    const soWhats = JSON.stringify([
      { scope: "GROW", headline: "Units up", body: "" },
      { scope: "MARGIN", headline: "Smuggled", body: "" },
    ]);
    const result = await editSoWhats(form({ periodId: "2026-10", scope: "GROW", soWhats }));
    expect(result).toEqual({ ok: true });
    expect(m.soWhatDeleteMany).toHaveBeenCalledWith({ where: { periodId: "2026-10", scope: "GROW" } });
    expect(m.soWhatCreateMany).toHaveBeenCalledWith({ data: [{ periodId: "2026-10", scope: "GROW", order: 0, headline: "Units up", body: null }] });
  });

  it("refuses a scope outside the active plan", async () => {
    const result = await editSoWhats(form({ periodId: "2026-10", scope: "OTHER", soWhats: "[]" }));
    expect(result.ok).toBe(false);
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("is locked once the month is published", async () => {
    m.periodFindUnique.mockResolvedValue({ status: "PUBLISHED", soWhats: [] });
    const result = await editSoWhats(form({ periodId: "2026-10", scope: "SUMMARY", soWhats: "[]" }));
    expect(result.ok).toBe(false);
    expect(m.transaction).not.toHaveBeenCalled();
  });
});

describe("editStrategicArea", () => {
  it("saves an area of the active plan", async () => {
    m.areaFindUnique.mockResolvedValue({ planVersionId: "fy27", name: "Grow", goal: null, owner: null });
    const result = await editStrategicArea(form({ areaId: "a1", name: "Grow units", owner: "Kyle", goal: "" }));
    expect(result).toEqual({ ok: true });
    expect(m.areaUpdate).toHaveBeenCalledWith({ where: { id: "a1" }, data: { name: "Grow units", owner: "Kyle", goal: null } });
  });

  it("refuses an area of another plan, and a blank name", async () => {
    m.areaFindUnique.mockResolvedValue({ planVersionId: "fy26", name: "Grow", goal: null, owner: null });
    expect((await editStrategicArea(form({ areaId: "a1", name: "x" }))).ok).toBe(false);
    m.areaFindUnique.mockResolvedValue({ planVersionId: "fy27", name: "Grow", goal: null, owner: null });
    expect((await editStrategicArea(form({ areaId: "a1", name: " " }))).ok).toBe(false);
    expect(m.areaUpdate).not.toHaveBeenCalled();
  });
});

describe("editSiUpdate", () => {
  it("stores a new update for the month, keeping its next milestone", async () => {
    const due = new Date("2026-11-30T00:00:00Z");
    m.initiativeFindUnique.mockResolvedValue({ id: "i1", status: "IN_PROGRESS", updates: [{ nextMilestone: "Board pack", milestoneDueAt: due }] });
    const result = await editSiUpdate(form({ periodId: "2026-10", initiativeId: "i1", reviewStatus: "AT_RISK", update: "Slipped", pathForward: "Recover" }));
    expect(result).toEqual({ ok: true });
    expect(m.updateCreate.mock.calls[0][0].data).toMatchObject({
      status: "IN_PROGRESS",
      reviewStatus: "AT_RISK",
      update: "Slipped",
      pathForward: "Recover",
      nextMilestone: "Board pack",
      milestoneDueAt: due,
      reportingPeriod: "2026-10",
      updatedBy: "Erin Editor",
    });
  });

  it("ignores an unknown status and is locked once published", async () => {
    m.initiativeFindUnique.mockResolvedValue({ id: "i1", status: "IN_PROGRESS", updates: [] });
    await editSiUpdate(form({ periodId: "2026-10", initiativeId: "i1", reviewStatus: "GREAT" }));
    expect(m.updateCreate.mock.calls[0][0].data.reviewStatus).toBeNull();
    m.updateCreate.mockClear();
    m.periodFindUnique.mockResolvedValue({ status: "PUBLISHED" });
    expect((await editSiUpdate(form({ periodId: "2026-10", initiativeId: "i1" }))).ok).toBe(false);
    expect(m.updateCreate).not.toHaveBeenCalled();
  });
});
