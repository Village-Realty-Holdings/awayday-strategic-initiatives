import { beforeEach, describe, expect, it, vi } from "vitest";

// Saving the initiative form with Prisma, the session and Next mocked: fields
// no longer on the form must keep their saved values, and a new SI starts with
// neutral scoring and no status.

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  areaFindFirst: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/flash", () => ({ flash: vi.fn() }));
vi.mock("@/lib/active-plan", () => ({ getActivePlan: vi.fn(async () => ({ id: "plan1" })) }));
vi.mock("@/lib/storage", () => ({ deleteAttachment: vi.fn() }));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
  requireEditor: vi.fn(async () => ({ user: { id: "u-ed", name: "Erin Editor", role: "editor" } })),
  requireAdmin: vi.fn(async () => ({ user: { id: "u-ad", name: "Ada Admin", role: "admin" } })),
  canEdit: () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    initiative: { findUnique: m.findUnique, update: m.update, create: m.create },
    strategicArea: { findFirst: m.areaFindFirst },
    initiativeRisk: { findMany: vi.fn(async () => []) },
    initiativeActionItem: { findMany: vi.fn(async () => []) },
    initiativeMilestone: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(),
  },
}));

import { createInitiative, updateInitiative } from "@/app/(app)/initiatives/actions";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateInitiative", () => {
  it("writes only the charter fields on the form", async () => {
    const updatedAt = new Date("2026-11-01T00:00:00Z");
    m.findUnique.mockResolvedValue({ id: "i1", updatedAt });
    m.update.mockResolvedValue({ id: "i1" });
    await expect(updateInitiative(form({ id: "i1", updatedAt: updatedAt.toISOString(), name: "Renamed", teamLead: "Kyle Sullivan" }))).rejects.toThrow("REDIRECT /initiatives/i1");
    const { data } = m.update.mock.calls[0][0];
    expect(data).toMatchObject({ name: "Renamed", teamLead: "Kyle Sullivan" });
    for (const removed of [
      "status", "cimDriver", "cimItemCode", "strategicAreaId", "startDate", "endDate", "supports", "workRequired",
      "valueType", "value", "lift", "quadrant", "pctComplete", "progressTarget", "progressActual",
    ]) {
      expect(data).not.toHaveProperty(removed);
    }
  });
});

describe("createInitiative", () => {
  it("files a new SI under its driver and area, with neutral scoring and no status", async () => {
    m.findUnique.mockResolvedValue(null);
    m.areaFindFirst.mockResolvedValue({ id: "area1" });
    m.create.mockResolvedValue({ id: "new1" });
    await expect(createInitiative(form({ code: "grw-01", name: "New SI", cimDriver: "Grow new units", strategicAreaId: "area1" }))).rejects.toThrow("REDIRECT /initiatives/new1");
    const { data } = m.create.mock.calls[0][0];
    expect(data).toMatchObject({ code: "GRW-01", name: "New SI", cimDriver: "Grow new units", strategicAreaId: "area1", planVersionId: "plan1", value: 3, lift: 3 });
    expect(data).not.toHaveProperty("status");
  });
});
