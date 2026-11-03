import { beforeEach, describe, expect, it, vi } from "vitest";

// The one write path for an SI's status, with Prisma mocked: an update's status
// becomes the SI's current one unless a newer month already has an update.

const m = vi.hoisted(() => ({
  initiativeFindUnique: vi.fn(),
  updateFindMany: vi.fn(),
  updateCreate: vi.fn(),
  initiativeUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    initiative: { findUnique: m.initiativeFindUnique },
    initiativeUpdate: { findMany: m.updateFindMany },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({ initiativeUpdate: { create: m.updateCreate }, initiative: { update: m.initiativeUpdate } }),
  },
}));

import { recordSiUpdate } from "@/lib/si-updates";

const input = (over: Record<string, unknown> = {}) => ({
  initiativeId: "i1",
  status: "AT_RISK" as const,
  update: "Slipped",
  pathForward: "Recover",
  reportingPeriod: "2026-10",
  updatedBy: "Kyle Sullivan",
  ...over,
}) as Parameters<typeof recordSiUpdate>[0];

beforeEach(() => {
  vi.clearAllMocks();
  m.initiativeFindUnique.mockResolvedValue({ valueType: "VALUE" });
  m.updateFindMany.mockResolvedValue([]);
  m.updateCreate.mockResolvedValue({ id: "upd1" });
});

describe("recordSiUpdate", () => {
  it("stores the update and makes its status the SI's current one", async () => {
    await expect(recordSiUpdate(input())).resolves.toEqual({ id: "upd1" });
    expect(m.updateCreate).toHaveBeenCalledWith({ data: input() });
    expect(m.initiativeUpdate).toHaveBeenCalledWith({ where: { id: "i1" }, data: { status: "AT_RISK" } });
  });

  it("doesn't let an older month overwrite a newer month's status", async () => {
    m.updateFindMany.mockResolvedValue([{ reportingPeriod: "2026-11" }]);
    await recordSiUpdate(input());
    expect(m.updateCreate).toHaveBeenCalledOnce();
    expect(m.initiativeUpdate).not.toHaveBeenCalled();
  });

  it("keeps the current status when the update has none", async () => {
    await recordSiUpdate(input({ status: null }));
    expect(m.updateCreate).toHaveBeenCalledOnce();
    expect(m.initiativeUpdate).not.toHaveBeenCalled();
  });

  it("moves a non-value SI's percent with its status", async () => {
    m.initiativeFindUnique.mockResolvedValue({ valueType: "NON_VALUE" });
    await recordSiUpdate(input({ status: "COMPLETE" }));
    expect(m.initiativeUpdate).toHaveBeenCalledWith({ where: { id: "i1" }, data: { status: "COMPLETE", pctComplete: 1 } });
    await recordSiUpdate(input({ status: "ON_TRACK" }));
    expect(m.initiativeUpdate).toHaveBeenLastCalledWith({ where: { id: "i1" }, data: { status: "ON_TRACK", pctComplete: 0 } });
  });
});
