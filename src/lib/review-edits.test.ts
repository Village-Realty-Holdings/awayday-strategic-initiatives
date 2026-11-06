import { beforeEach, describe, expect, it, vi } from "vitest";

// Permission checks inside the shared review edits, which the MCP endpoint
// relies on (Edit Mode also checks first with requireEditor). Behaviour of the
// edits themselves is covered through the actions in review-edit-actions.test.ts.

const m = vi.hoisted(() => ({
  periodFindUnique: vi.fn(),
  periodUpsert: vi.fn(),
  initiativeFindUnique: vi.fn(),
  recordSiUpdate: vi.fn(async () => ({ id: "upd1" })),
  audit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: m.audit }));
vi.mock("@/lib/active-plan", () => ({ getActivePlan: vi.fn(async () => ({ id: "fy27" })) }));
vi.mock("@/lib/review-data", () => ({ getReviewPlan: vi.fn() }));
vi.mock("@/lib/si-updates", () => ({ recordSiUpdate: m.recordSiUpdate }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reviewPeriod: { findUnique: m.periodFindUnique, upsert: m.periodUpsert },
    initiative: { findUnique: m.initiativeFindUnique },
  },
}));

import { addSiUpdate, setPillarMeasure, setSoWhats, updateReviewDetails } from "@/lib/review-edits";

const viewer = { id: "u-v", name: "Val Viewer", role: "user" };

beforeEach(() => {
  vi.clearAllMocks();
  m.periodFindUnique.mockResolvedValue(null);
});

describe("review edits", () => {
  it("refuse viewers on the editor-only edits without writing", async () => {
    for (const result of [
      await updateReviewDetails(viewer, { periodId: "2026-10", preparedBy: "x" }),
      await setSoWhats(viewer, { periodId: "2026-10", scope: "SUMMARY", items: [] }),
      await setPillarMeasure(viewer, { periodId: "2026-10", areaId: "a1", status: "AHEAD" }),
    ]) {
      expect(result).toEqual({ ok: false, error: "Only admins and editors can change the review." });
    }
    expect(m.periodUpsert).not.toHaveBeenCalled();
  });

  it("let an SI's lead add its update, and nobody else without edit rights", async () => {
    m.initiativeFindUnique.mockResolvedValue({ id: "i1", ownerUserId: "u-v", teamLead: null });
    expect(await addSiUpdate(viewer, { periodId: "2026-10", initiativeId: "i1", status: "ON_TRACK" })).toEqual({ ok: true });
    expect(m.recordSiUpdate).toHaveBeenCalledWith(expect.objectContaining({ initiativeId: "i1", status: "ON_TRACK", updatedBy: "Val Viewer" }));

    m.recordSiUpdate.mockClear();
    m.initiativeFindUnique.mockResolvedValue({ id: "i2", ownerUserId: "u-other", teamLead: "Val Viewer" });
    expect((await addSiUpdate(viewer, { periodId: "2026-10", initiativeId: "i2" })).ok).toBe(false);
    expect(m.recordSiUpdate).not.toHaveBeenCalled();
  });

  it("only change the details fields that are sent", async () => {
    const editor = { id: "u-e", name: "Erin", role: "editor" };
    m.periodFindUnique.mockResolvedValue({ status: "DRAFT", preparedBy: "Alex", meetingDate: new Date("2026-11-05"), updatesDueDate: null, dataAsOf: null });
    await updateReviewDetails(editor, { periodId: "2026-10", dataAsOf: "2026-10-31" });
    expect(m.periodUpsert.mock.calls[0][0].update).toEqual({ preparedBy: "Alex", meetingDate: new Date("2026-11-05"), updatesDueDate: null, dataAsOf: new Date("2026-10-31T00:00:00Z") });
  });
});
