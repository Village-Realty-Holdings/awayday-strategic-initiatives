import { beforeEach, describe, expect, it, vi } from "vitest";

// Admin > Measure mappings' action with Prisma, the session and Next mocked:
// admins only, measures must be in the active plan, and inputs must be imported
// metrics rather than another measure.

const m = vi.hoisted(() => ({
  requireSession: vi.fn(),
  definitionFindUnique: vi.fn(),
  definitionCount: vi.fn(),
  mappingCount: vi.fn(),
  upsert: vi.fn(),
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
vi.mock("@/lib/active-plan", () => ({ getActivePlan: vi.fn(async () => ({ id: "fy27", code: "FY27", title: "FY27" })) }));
vi.mock("@/lib/session", () => ({ requireSession: m.requireSession }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    kpiDefinition: { findUnique: m.definitionFindUnique, count: m.definitionCount },
    kpiMeasureMapping: { upsert: m.upsert, count: m.mappingCount },
  },
}));

import { adminSaveMeasureMapping } from "@/app/(app)/admin/measure-mappings/actions";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries({ measureKpiId: "k-t", calculation: "YOY_PCT", timeBasis: "YTD", direction: "HIGHER", active: "on", ...fields })) fd.set(key, value);
  return fd;
}

const measure = (mapping: unknown = null) => ({ id: "k-t", name: "TRevPAR growth (YoY)", strategicAreaId: "a-trevpar", strategicArea: { planVersionId: "fy27" }, measureMapping: mapping });

beforeEach(() => {
  vi.clearAllMocks();
  m.requireSession.mockResolvedValue({ user: { id: "u-admin", role: "admin" } });
  m.definitionFindUnique.mockResolvedValue(measure());
  m.definitionCount.mockResolvedValue(1);
  m.mappingCount.mockResolvedValue(0);
  m.upsert.mockResolvedValue({ id: "map-1" });
});

describe("adminSaveMeasureMapping", () => {
  it("requires an admin before reading anything", async () => {
    m.requireSession.mockRejectedValue(new Error("REDIRECT /"));
    await expect(adminSaveMeasureMapping(form({}))).rejects.toThrow("REDIRECT /");
    expect(m.requireSession).toHaveBeenCalledWith({ role: "admin" });
    expect(m.definitionFindUnique).not.toHaveBeenCalled();
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("saves the mapping and audits it", async () => {
    await expect(adminSaveMeasureMapping(form({ inputMetricKey: "trevpar_finance", targetBudget: "1", targetStretch: "5", denominatorMetricKey: "ignored", displayFormat: "currency" }))).rejects.toThrow("REDIRECT /admin/measure-mappings#measure-k-t");
    const data = { calculation: "YOY_PCT", inputMetricKey: "trevpar_finance", denominatorMetricKey: null, timeBasis: "YTD", displayFormat: "percent", higherIsBetter: true, targetBudget: 1, targetStretch: 5, active: true };
    expect(m.upsert).toHaveBeenCalledWith({ where: { measureKpiId: "k-t" }, update: data, create: { measureKpiId: "k-t", ...data } });
    expect(m.audit).toHaveBeenCalledWith("u-admin", "CREATE", "KpiMeasureMapping", "map-1", { before: null, after: data });
    expect(m.flash).toHaveBeenCalled();
  });

  it("stores direction and switching a mapping off", async () => {
    await expect(adminSaveMeasureMapping(form({ calculation: "DIRECT", direction: "LOWER", displayFormat: "percent", active: "" }))).rejects.toThrow("REDIRECT");
    expect(m.upsert.mock.calls[0][0].update).toMatchObject({ higherIsBetter: false, active: false, displayFormat: "percent", inputMetricKey: null });
  });

  it("stores an unstated direction as unknown instead of assuming higher is better", async () => {
    await expect(adminSaveMeasureMapping(form({ calculation: "DIRECT", direction: "" }))).rejects.toThrow("REDIRECT");
    expect(m.upsert.mock.calls[0][0].update).toMatchObject({ higherIsBetter: null });
  });

  it("rejects an unrecognised direction instead of falling back to higher", async () => {
    await expect(adminSaveMeasureMapping(form({ direction: "SIDEWAYS" }))).rejects.toThrow("error=direction");
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("lets an authorised admin change a declared direction, and audits it", async () => {
    m.definitionFindUnique.mockResolvedValue(measure({ id: "map-1", higherIsBetter: true }));
    await expect(adminSaveMeasureMapping(form({ direction: "LOWER" }))).rejects.toThrow("REDIRECT /admin/measure-mappings#");
    expect(m.upsert.mock.calls[0][0].update).toMatchObject({ higherIsBetter: false });
    expect(m.audit).toHaveBeenCalledWith("u-admin", "UPDATE", "KpiMeasureMapping", "map-1", expect.objectContaining({ before: expect.objectContaining({ higherIsBetter: true }) }));
  });

  it("refuses to create a second primary measure in the same pillar", async () => {
    m.mappingCount.mockResolvedValue(1);
    await expect(adminSaveMeasureMapping(form({}))).rejects.toThrow("error=primary-exists");
    expect(m.mappingCount).toHaveBeenCalledWith({ where: { active: true, measureKpiId: { not: "k-t" }, measureKpi: { strategicAreaId: "a-trevpar" } } });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("lets a switched-off mapping coexist with the pillar's primary", async () => {
    m.mappingCount.mockResolvedValue(1);
    await expect(adminSaveMeasureMapping(form({ active: "" }))).rejects.toThrow("REDIRECT /admin/measure-mappings#");
    expect(m.mappingCount).not.toHaveBeenCalled();
    expect(m.upsert).toHaveBeenCalled();
  });

  it("refuses a measure outside the active plan", async () => {
    m.definitionFindUnique.mockResolvedValue({ ...measure(), strategicArea: { planVersionId: "fy26" } });
    await expect(adminSaveMeasureMapping(form({}))).rejects.toThrow("error=not-in-plan");
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("refuses a margin change with only one of its two metrics", async () => {
    await expect(adminSaveMeasureMapping(form({ calculation: "RATIO_DELTA_PY", inputMetricKey: "noi" }))).rejects.toThrow("error=ratio-inputs");
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("refuses an input that isn't an imported metric, but keeps one already saved", async () => {
    m.definitionCount.mockResolvedValue(0);
    await expect(adminSaveMeasureMapping(form({ inputMetricKey: "FY27:GROW" }))).rejects.toThrow("error=unknown-metric");
    expect(m.definitionCount).toHaveBeenCalledWith({ where: { metricKey: { in: ["FY27:GROW"] }, strategicAreaId: null } });
    expect(m.upsert).not.toHaveBeenCalled();

    m.definitionFindUnique.mockResolvedValue(measure({ id: "map-1", inputMetricKey: "future_metric", denominatorMetricKey: null }));
    await expect(adminSaveMeasureMapping(form({ inputMetricKey: "future_metric" }))).rejects.toThrow("REDIRECT /admin/measure-mappings#");
    expect(m.upsert).toHaveBeenCalled();
  });
});
