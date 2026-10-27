import { beforeEach, describe, expect, it, vi } from "vitest";

// The review's server actions with Prisma, the session and Next mocked: an SI
// lead's update stores the review status without touching the lifecycle
// status, only the lead (or an editor) may write, and every write is audited.

const m = vi.hoisted(() => ({
  session: { user: { id: "u-kyle", name: "Kyle Sullivan", role: "viewer" } },
  initiativeFindUnique: vi.fn(),
  initiativeUpdate: vi.fn(),
  updateCreate: vi.fn(),
  milestoneFindUnique: vi.fn(),
  milestoneUpdate: vi.fn(),
  audit: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/audit", () => ({ audit: m.audit }));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => m.session),
  canEdit: (role?: string | null) => role === "admin" || role === "editor",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    initiative: { findUnique: m.initiativeFindUnique, update: m.initiativeUpdate },
    initiativeUpdate: { create: m.updateCreate },
    initiativeMilestone: { findUnique: m.milestoneFindUnique, update: m.milestoneUpdate },
  },
}));

import { saveInitiativeUpdate, toggleMilestone } from "@/app/(app)/review-actions";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.session.user.role = "viewer";
});

describe("saveInitiativeUpdate", () => {
  it("stores the review status and text, keeps the lifecycle status, and audits", async () => {
    m.initiativeFindUnique.mockResolvedValue({ id: "i1", status: "IN_PROGRESS", ownerUserId: null, teamLead: "Kyle Sullivan" });
    m.updateCreate.mockResolvedValue({ id: "upd1", reportingPeriod: "2026-09" });

    await expect(
      saveInitiativeUpdate(form({ initiativeId: "i1", reviewStatus: "AT_RISK", update: " Waves 2 and 3 live ", pathForward: "All shops by April", reportingPeriod: "2026-09" })),
    ).rejects.toThrow("REDIRECT /my?period=2026-09#si-i1");

    expect(m.updateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ initiativeId: "i1", status: "IN_PROGRESS", reviewStatus: "AT_RISK", update: "Waves 2 and 3 live", pathForward: "All shops by April", reportingPeriod: "2026-09", updatedBy: "Kyle Sullivan" }),
    });
    expect(m.initiativeUpdate).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledWith("u-kyle", "CREATE", "InitiativeUpdate", "upd1", expect.anything());
  });

  it("drops an unknown review status and a free-text period", async () => {
    m.initiativeFindUnique.mockResolvedValue({ id: "i1", status: "PLANNING", ownerUserId: null, teamLead: "Kyle Sullivan" });
    m.updateCreate.mockResolvedValue({ id: "upd2", reportingPeriod: null });
    await expect(saveInitiativeUpdate(form({ initiativeId: "i1", reviewStatus: "GREAT", reportingPeriod: "October 2026" }))).rejects.toThrow(/REDIRECT/);
    expect(m.updateCreate.mock.calls[0][0].data).toMatchObject({ reviewStatus: null, reportingPeriod: null });
  });

  it("refuses someone who isn't the lead and can't edit", async () => {
    m.initiativeFindUnique.mockResolvedValue({ id: "i2", status: "IN_PROGRESS", ownerUserId: null, teamLead: "Curt Stark" });
    await expect(saveInitiativeUpdate(form({ initiativeId: "i2", reviewStatus: "AHEAD" }))).rejects.toThrow("REDIRECT /my");
    expect(m.updateCreate).not.toHaveBeenCalled();
  });
});

describe("toggleMilestone", () => {
  it("completes a milestone on the lead's SI and audits it", async () => {
    m.milestoneFindUnique.mockResolvedValue({ id: "ms1", completedAt: null, owner: "Someone", initiative: { ownerUserId: null, teamLead: "Kyle Sullivan" } });
    await toggleMilestone(form({ id: "ms1" }));
    expect(m.milestoneUpdate).toHaveBeenCalledWith({ where: { id: "ms1" }, data: { completedAt: expect.any(Date) } });
    expect(m.audit).toHaveBeenCalledWith("u-kyle", "UPDATE", "InitiativeMilestone", "ms1", expect.anything());
  });

  it("ignores a milestone the user doesn't own", async () => {
    m.milestoneFindUnique.mockResolvedValue({ id: "ms2", completedAt: null, owner: "Curt Stark", initiative: { ownerUserId: null, teamLead: "Curt Stark" } });
    await toggleMilestone(form({ id: "ms2" }));
    expect(m.milestoneUpdate).not.toHaveBeenCalled();
  });
});
