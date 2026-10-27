import { beforeEach, describe, expect, it, vi } from "vitest";

// The review's server actions with Prisma, the session and Next mocked: an SI
// lead's update stores the review status without touching the lifecycle
// status, only the lead (or an editor) may write, a published month takes no
// updates, and every write is audited. Review authoring (period, so-whats,
// publish) is admin-only.

const m = vi.hoisted(() => ({
  session: { user: { id: "u-kyle", name: "Kyle Sullivan", role: "viewer" } },
  initiativeFindUnique: vi.fn(),
  initiativeUpdate: vi.fn(),
  updateCreate: vi.fn(),
  milestoneFindUnique: vi.fn(),
  milestoneUpdate: vi.fn(),
  periodFindUnique: vi.fn(),
  periodCreate: vi.fn(),
  periodUpsert: vi.fn((args: { update: Record<string, unknown> }) => ({ op: "upsert", args })),
  periodUpdate: vi.fn(),
  soWhatDeleteMany: vi.fn((args: unknown) => ({ op: "deleteMany", args })),
  soWhatCreateMany: vi.fn((args: unknown) => ({ op: "createMany", args })),
  transaction: vi.fn(async (ops: unknown[]) => ops),
  getReviewPlan: vi.fn(),
  flash: vi.fn(),
  audit: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/audit", () => ({ audit: m.audit }));
vi.mock("@/lib/flash", () => ({ flash: m.flash }));
vi.mock("@/lib/review-data", () => ({ getReviewPlan: m.getReviewPlan }));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => m.session),
  requireAdmin: vi.fn(async () => {
    if (m.session.user.role !== "admin") m.redirect("/");
    return m.session;
  }),
  canEdit: (role?: string | null) => role === "admin" || role === "editor",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    initiative: { findUnique: m.initiativeFindUnique, update: m.initiativeUpdate },
    initiativeUpdate: { create: m.updateCreate },
    initiativeMilestone: { findUnique: m.milestoneFindUnique, update: m.milestoneUpdate },
    reviewPeriod: { findUnique: m.periodFindUnique, create: m.periodCreate, upsert: m.periodUpsert, update: m.periodUpdate },
    reviewSoWhat: { deleteMany: m.soWhatDeleteMany, createMany: m.soWhatCreateMany },
    $transaction: m.transaction,
  },
}));

import { createReviewPeriod, saveInitiativeUpdate, saveReview, toggleMilestone, unpublishReview } from "@/app/(app)/review-actions";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.session.user = { id: "u-kyle", name: "Kyle Sullivan", role: "viewer" };
  m.periodFindUnique.mockResolvedValue(null);
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

  it("refuses an update for a month whose review is published, even from an editor", async () => {
    m.session.user.role = "editor";
    m.initiativeFindUnique.mockResolvedValue({ id: "i1", status: "IN_PROGRESS", ownerUserId: null, teamLead: "Kyle Sullivan" });
    m.periodFindUnique.mockResolvedValue({ status: "PUBLISHED" });
    await expect(saveInitiativeUpdate(form({ initiativeId: "i1", reviewStatus: "AHEAD", reportingPeriod: "2026-09" }))).rejects.toThrow("REDIRECT /my?period=2026-09");
    expect(m.periodFindUnique).toHaveBeenCalledWith({ where: { id: "2026-09" }, select: { status: true } });
    expect(m.updateCreate).not.toHaveBeenCalled();
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

// ---------------------------------------------------------------------------
// Review authoring
// ---------------------------------------------------------------------------

const PLAN = {
  areas: [
    { code: "M&A", name: "M&A", kind: "VALUE_DRIVER" },
    { code: "TECH", name: "Tech & AI", kind: "ENABLER" },
  ],
};

function asAlex() {
  m.session.user = { id: "u-alex", name: "Alex Bevington", role: "admin" };
}

describe("createReviewPeriod", () => {
  it("starts a draft month prepared by the admin and opens the editor", async () => {
    asAlex();
    await expect(createReviewPeriod(form({ period: "2026-09" }))).rejects.toThrow("REDIRECT /review/2026-09/edit");
    expect(m.periodCreate).toHaveBeenCalledWith({ data: { id: "2026-09", preparedBy: "Alex Bevington" } });
    expect(m.audit).toHaveBeenCalledWith("u-alex", "CREATE", "ReviewPeriod", "2026-09", expect.anything());
  });

  it("opens an existing month without writing", async () => {
    asAlex();
    m.periodFindUnique.mockResolvedValue({ id: "2026-09" });
    await expect(createReviewPeriod(form({ period: "2026-09" }))).rejects.toThrow("REDIRECT /review/2026-09/edit");
    expect(m.periodCreate).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("refuses a non-admin, even an editor, and a malformed month", async () => {
    m.session.user.role = "editor";
    await expect(createReviewPeriod(form({ period: "2026-09" }))).rejects.toThrow("REDIRECT /");
    asAlex();
    await expect(createReviewPeriod(form({ period: "September" }))).rejects.toThrow("REDIRECT /");
    expect(m.periodCreate).not.toHaveBeenCalled();
  });
});

describe("saveReview", () => {
  beforeEach(() => {
    asAlex();
    m.getReviewPlan.mockResolvedValue(PLAN);
  });

  const soWhats = JSON.stringify([
    { scope: "SUMMARY", headline: " Shops beat, centre spent it. ", body: "Shop NOI $1.0M over budget." },
    { scope: "SUMMARY", headline: "M&A is the year's engine.", body: "" },
    { scope: "M&A", headline: "Four closes in September", body: "942 units, $6.8M." },
    { scope: "NOT-AN-AREA", headline: "Dropped", body: "" },
    { scope: "TECH", headline: "", body: "" },
  ]);

  it("creates the month, replaces the so-whats for the plan's scopes, and audits", async () => {
    await expect(
      saveReview(form({ periodId: "2026-09", preparedBy: "Alex Bevington", meetingDate: "2026-10-15", updatesDueDate: "2026-10-13", dataAsOf: "", soWhats, intent: "save" })),
    ).rejects.toThrow("REDIRECT /review/2026-09/edit");

    const fields = { preparedBy: "Alex Bevington", meetingDate: new Date("2026-10-15T00:00:00Z"), updatesDueDate: new Date("2026-10-13T00:00:00Z"), dataAsOf: null };
    expect(m.periodUpsert).toHaveBeenCalledWith({ where: { id: "2026-09" }, create: { id: "2026-09", ...fields }, update: fields });
    expect(m.soWhatDeleteMany).toHaveBeenCalledWith({ where: { periodId: "2026-09", scope: { in: ["SUMMARY", "M&A", "TECH"] } } });
    expect(m.soWhatCreateMany).toHaveBeenCalledWith({
      data: [
        { periodId: "2026-09", scope: "SUMMARY", order: 0, headline: "Shops beat, centre spent it.", body: "Shop NOI $1.0M over budget." },
        { periodId: "2026-09", scope: "SUMMARY", order: 1, headline: "M&A is the year's engine.", body: null },
        { periodId: "2026-09", scope: "M&A", order: 0, headline: "Four closes in September", body: "942 units, $6.8M." },
      ],
    });
    // One transaction: the period row and its so-whats change together.
    expect(m.transaction).toHaveBeenCalledTimes(1);
    expect(m.transaction.mock.calls[0][0]).toHaveLength(3);
    expect(m.audit).toHaveBeenCalledWith("u-alex", "CREATE", "ReviewPeriod", "2026-09", {
      before: undefined,
      after: expect.objectContaining({ status: "DRAFT", meetingDate: "2026-10-15", soWhats: expect.arrayContaining([{ scope: "M&A", headline: "Four closes in September" }]) }),
    });
    expect(m.flash).toHaveBeenCalledWith("Review saved");
  });

  it("publishes with intent=publish and goes to the review", async () => {
    m.periodFindUnique.mockResolvedValue({ id: "2026-09", status: "DRAFT", preparedBy: "Alex Bevington", meetingDate: null, updatesDueDate: null, dataAsOf: null, soWhats: [] });
    await expect(saveReview(form({ periodId: "2026-09", preparedBy: "Alex Bevington", soWhats, intent: "publish" }))).rejects.toThrow("REDIRECT /review/2026-09");
    expect(m.periodUpsert.mock.calls[0][0].update).toMatchObject({ status: "PUBLISHED", publishedAt: expect.any(Date), publishedBy: "Alex Bevington" });
    expect(m.audit).toHaveBeenCalledWith("u-alex", "UPDATE", "ReviewPeriod", "2026-09", expect.objectContaining({ after: expect.objectContaining({ status: "PUBLISHED" }) }));
  });

  it("leaves a published month alone", async () => {
    m.periodFindUnique.mockResolvedValue({ id: "2026-09", status: "PUBLISHED", soWhats: [] });
    await expect(saveReview(form({ periodId: "2026-09", soWhats }))).rejects.toThrow("REDIRECT /review/2026-09/edit");
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("refuses an editor", async () => {
    m.session.user.role = "editor";
    await expect(saveReview(form({ periodId: "2026-09", soWhats }))).rejects.toThrow("REDIRECT /");
    expect(m.transaction).not.toHaveBeenCalled();
  });
});

describe("unpublishReview", () => {
  beforeEach(asAlex);

  it("returns a published month to draft and audits", async () => {
    m.periodFindUnique.mockResolvedValue({ status: "PUBLISHED", publishedAt: new Date(), publishedBy: "Alex Bevington" });
    await expect(unpublishReview(form({ periodId: "2026-09" }))).rejects.toThrow("REDIRECT /review/2026-09/edit");
    expect(m.periodUpdate).toHaveBeenCalledWith({ where: { id: "2026-09" }, data: { status: "DRAFT", publishedAt: null, publishedBy: null } });
    expect(m.audit).toHaveBeenCalledWith("u-alex", "UPDATE", "ReviewPeriod", "2026-09", expect.objectContaining({ after: { status: "DRAFT" } }));
  });

  it("does nothing to a draft", async () => {
    m.periodFindUnique.mockResolvedValue({ status: "DRAFT", publishedAt: null, publishedBy: null });
    await expect(unpublishReview(form({ periodId: "2026-09" }))).rejects.toThrow("REDIRECT /review/2026-09/edit");
    expect(m.periodUpdate).not.toHaveBeenCalled();
  });
});
