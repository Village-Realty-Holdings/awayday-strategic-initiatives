import { describe, expect, it } from "vitest";
import { FY27_PLAN } from "./fy27-plan";

describe("FY27 plan manifest", () => {
  it("contains five value drivers and five enablers", () => {
    expect(FY27_PLAN.areas.filter((area) => area.kind === "VALUE_DRIVER")).toHaveLength(5);
    expect(FY27_PLAN.areas.filter((area) => area.kind === "ENABLER")).toHaveLength(5);
  });

  it("uses deterministic unique initiative IDs and area mappings", () => {
    const codes = FY27_PLAN.initiatives.map((initiative) => initiative.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^FY27-SI-\d{3}$/.test(code))).toBe(true);
    const areas = new Set(FY27_PLAN.areas.map((area) => area.code));
    expect(FY27_PLAN.initiatives.every((initiative) => areas.has(initiative.areaCode))).toBe(true);
  });

  it("preserves explicit TBD values instead of fabricating owners or metrics", () => {
    expect(
      FY27_PLAN.initiatives.some(
        (initiative) =>
          initiative.valueMetric?.includes("TBD") ||
          initiative.valueTarget?.includes("TBD") ||
          initiative.milestones?.some((item) => item.dueAt === "TBD"),
      ),
    ).toBe(true);
    expect(FY27_PLAN.areas.some((area) => !area.kpiName && !area.kpiTarget)).toBe(true);
  });
});
