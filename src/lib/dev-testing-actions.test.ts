import { beforeEach, describe, expect, it, vi } from "vitest";

// With the tool off, no action may touch the database, even if called directly
// without the dialog.

const m = vi.hoisted(() => ({
  enabled: vi.fn(),
  requireSession: vi.fn(),
  update: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/active-plan", () => ({ activePlanInitiativeWhere: vi.fn() }));
vi.mock("@/lib/review-data", () => ({ getReviewPeriodIndex: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireSession: m.requireSession }));
vi.mock("@/lib/dev-testing", async (original) => ({ ...(await original<object>()), isDevTestingEnabled: m.enabled }));
vi.mock("@/lib/dev-testing-files", () => ({
  readRememberedAccount: vi.fn(async () => null),
  rememberAccount: vi.fn(),
  forgetAccount: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUniqueOrThrow: vi.fn(async () => ({ id: "u1", name: "Local Admin", role: "admin" })), update: m.update } },
}));

import { devClearUpdates, devLoadTestData, devSetAccount, devSetMonthPublished, devSetToday } from "@/app/(app)/dev-testing-actions";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireSession.mockResolvedValue({ user: { id: "u1", name: "Local Admin", role: "admin" } });
});

describe("dev testing actions", () => {
  it("do nothing when the tool is off", async () => {
    m.enabled.mockReturnValue(false);
    const results = await Promise.all([
      devSetAccount("admin", ""),
      devLoadTestData(),
      devClearUpdates(),
      devSetMonthPublished("2026-10", true),
      devSetToday("2026-12-15"),
    ]);
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(m.requireSession).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });

  it("changes the account's role and takes on a lead's name", async () => {
    m.enabled.mockReturnValue(true);
    await expect(devSetAccount("user", "Kyle Sullivan")).resolves.toMatchObject({ ok: true });
    expect(m.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "user", name: "Kyle Sullivan" } });
  });

  it("refuses an unknown role", async () => {
    m.enabled.mockReturnValue(true);
    await expect(devSetAccount("superuser", "")).resolves.toMatchObject({ ok: false });
    expect(m.update).not.toHaveBeenCalled();
  });
});
