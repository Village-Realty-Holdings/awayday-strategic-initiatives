import { beforeEach, describe, expect, it, vi } from "vitest";

// The measure server actions with Prisma, the session and Next mocked: a value
// initiative's percent follows its first KPI, including back to 0 when that KPI
// goes; dollars and non-value initiatives keep their own rules; unreadable or
// future input saves nothing; and only editors and the SI's own lead get through.

const m = vi.hoisted(() => ({
  session: { user: { id: "u-ed", name: "Erin Editor", role: "editor" } },
  initiativeFindUnique: vi.fn(),
  initiativeUpdate: vi.fn(),
  measureFindUnique: vi.fn(),
  measureDelete: vi.fn(),
  readingCreate: vi.fn(),
  readingFindUnique: vi.fn(),
  readingDelete: vi.fn(),
  audit: vi.fn(),
  flash: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/audit", () => ({ audit: m.audit }));
vi.mock("@/lib/flash", () => ({ flash: m.flash }));
vi.mock("@/lib/active-plan", () => ({ getActivePlan: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteAttachment: vi.fn() }));
vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(async () => m.session),
  requireEditor: vi.fn(),
  requireAdmin: vi.fn(),
  canEdit: (role?: string | null) => role === "admin" || role === "editor",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    initiative: { findUnique: m.initiativeFindUnique, update: m.initiativeUpdate },
    initiativeMeasure: { findUnique: m.measureFindUnique, delete: m.measureDelete },
    initiativeMeasureReading: { create: m.readingCreate, findUnique: m.readingFindUnique, delete: m.readingDelete },
  },
}));

import {
  addInitiativeMeasureReading,
  removeInitiativeMeasure,
  removeInitiativeMeasureReading,
} from "@/app/(app)/initiatives/actions";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const reading = (value: number) => ({ value, asOf: new Date("2026-10-01"), createdAt: new Date("2026-10-01") });
const kpi = (readings: ReturnType<typeof reading>[]) => ({
  kind: "KPI",
  baseline: 0,
  target: 100,
  order: 0,
  createdAt: new Date("2026-01-01"),
  readings,
});
const initiative = (over: Record<string, unknown> = {}) => ({
  valueType: "VALUE",
  pctComplete: 0.5,
  progressActual: null,
  progressTarget: null,
  measures: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.session.user = { id: "u-ed", name: "Erin Editor", role: "editor" };
  m.measureFindUnique.mockResolvedValue({ id: "m1", initiativeId: "i1", readings: [] });
  m.readingCreate.mockResolvedValue({ id: "r1" });
});

describe("addInitiativeMeasureReading", () => {
  it("saves the value and who entered it, and moves percent complete", async () => {
    m.initiativeFindUnique.mockResolvedValue(initiative({ measures: [kpi([reading(75)])] }));
    await expect(addInitiativeMeasureReading(form({ measureId: "m1", value: "75%", asOf: "2026-10-01" }))).rejects.toThrow("REDIRECT /initiatives/i1");
    expect(m.readingCreate.mock.calls[0][0].data).toMatchObject({ measureId: "m1", value: 75, enteredBy: "Erin Editor" });
    expect(m.initiativeUpdate).toHaveBeenCalledWith({ where: { id: "i1" }, data: { pctComplete: 0.75 } });
    expect(m.audit).toHaveBeenCalledOnce();
  });

  it("leaves a dollar-driven percent alone", async () => {
    m.initiativeFindUnique.mockResolvedValue(initiative({ progressActual: 50, progressTarget: 100, measures: [kpi([reading(75)])] }));
    await expect(addInitiativeMeasureReading(form({ measureId: "m1", value: "75" }))).rejects.toThrow("REDIRECT");
    expect(m.initiativeUpdate).not.toHaveBeenCalled();
  });

  it("leaves a non-value initiative status-driven", async () => {
    m.initiativeFindUnique.mockResolvedValue(initiative({ valueType: "NON_VALUE", pctComplete: 0, measures: [kpi([reading(75)])] }));
    await expect(addInitiativeMeasureReading(form({ measureId: "m1", value: "75" }))).rejects.toThrow("REDIRECT");
    expect(m.initiativeUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["an unreadable value", { value: "about 70" }],
    ["a future date", { value: "70", asOf: "2099-01-01" }],
  ])("saves nothing for %s", async (_label, fields) => {
    m.initiativeFindUnique.mockResolvedValue(initiative());
    await expect(addInitiativeMeasureReading(form({ measureId: "m1", ...fields }))).rejects.toThrow("REDIRECT /initiatives/i1");
    expect(m.readingCreate).not.toHaveBeenCalled();
    expect(m.flash).toHaveBeenCalledWith(expect.any(String), "error");
  });

  it("lets the SI's own lead update, and returns to their Inbox month", async () => {
    m.session.user = { id: "u-kyle", name: "Kyle Sullivan", role: "user" };
    m.initiativeFindUnique.mockResolvedValue(initiative({ ownerUserId: null, teamLead: "Kyle Sullivan" }));
    await expect(addInitiativeMeasureReading(form({ measureId: "m1", value: "75", returnTo: "inbox", period: "2026-10" }))).rejects.toThrow("REDIRECT /inbox?period=2026-10#si-i1");
    expect(m.readingCreate).toHaveBeenCalledOnce();
  });

  it("stops anyone who isn't an editor or the lead", async () => {
    m.session.user = { id: "u-kyle", name: "Kyle Sullivan", role: "user" };
    m.initiativeFindUnique.mockResolvedValue(initiative({ ownerUserId: null, teamLead: "Curt Stark" }));
    await expect(addInitiativeMeasureReading(form({ measureId: "m1", value: "75" }))).rejects.toThrow("REDIRECT /");
    expect(m.readingCreate).not.toHaveBeenCalled();
  });
});

describe("removing", () => {
  it("resets percent complete when the last KPI goes", async () => {
    m.initiativeFindUnique.mockResolvedValue(initiative());
    await expect(removeInitiativeMeasure(form({ id: "m1" }))).rejects.toThrow("REDIRECT /initiatives/i1");
    expect(m.measureDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(m.initiativeUpdate).toHaveBeenCalledWith({ where: { id: "i1" }, data: { pctComplete: 0 } });
    expect(m.audit).toHaveBeenCalledOnce();
  });

  it("falls back to the previous reading when the latest is removed", async () => {
    m.readingFindUnique.mockResolvedValue({ id: "r2", value: 75, measure: { initiativeId: "i1" } });
    m.initiativeFindUnique.mockResolvedValue(initiative({ pctComplete: 0.75, measures: [kpi([reading(40)])] }));
    await expect(removeInitiativeMeasureReading(form({ id: "r2" }))).rejects.toThrow("REDIRECT /initiatives/i1");
    expect(m.readingDelete).toHaveBeenCalledWith({ where: { id: "r2" } });
    expect(m.initiativeUpdate).toHaveBeenCalledWith({ where: { id: "i1" }, data: { pctComplete: 0.4 } });
  });
});
