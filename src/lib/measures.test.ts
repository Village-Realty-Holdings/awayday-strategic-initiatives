import { describe, expect, it } from "vitest";
import {
  derivedPct,
  formatMeasureValue,
  measureProgress,
  parseMeasureValue,
  primaryKpi,
  sortReadings,
  type MeasureLite,
} from "@/lib/measures";

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);
const reading = (value: number, asOf: string, createdAt = asOf) => ({ value, asOf: day(asOf), createdAt: day(createdAt) });
const measure = (over: Partial<MeasureLite> = {}): MeasureLite => ({
  kind: "KPI",
  baseline: 0,
  target: 100,
  order: 0,
  createdAt: day("2026-01-01"),
  readings: [],
  ...over,
});

describe("parseMeasureValue", () => {
  it.each([
    ["15%", 15],
    ["$1,500,000", 1_500_000],
    ["1.5M", 1_500_000],
    ["850k", 850_000],
    ["-1.9", -1.9],
    ["+3", 3],
    [".5", 0.5],
    ["0", 0],
  ])("reads %s", (raw, expected) => {
    expect(parseMeasureValue(raw)).toBe(expected);
  });

  it.each(["", "  ", "abc", "1-2", "70 to 120", "1.2.3", "-", "%"])("rejects %j", (raw) => {
    expect(parseMeasureValue(raw)).toBeNull();
  });
});

describe("formatMeasureValue", () => {
  it("applies the unit", () => {
    expect(formatMeasureValue(15.5, "PERCENT")).toBe("15.5%");
    expect(formatMeasureValue(1500000, "DOLLARS")).toBe("$1,500,000");
    expect(formatMeasureValue(-2500, "DOLLARS")).toBe("-$2,500");
    expect(formatMeasureValue(30, "DAYS")).toBe("30 days");
    expect(formatMeasureValue(1, "DAYS")).toBe("1 day");
    expect(formatMeasureValue(1234, "NUMBER")).toBe("1,234");
  });

  it("shows a dash when there is no value, but keeps a real zero", () => {
    expect(formatMeasureValue(null, "PERCENT")).toBe("—");
    expect(formatMeasureValue(0, "PERCENT")).toBe("0%");
  });
});

describe("sortReadings", () => {
  it("orders by as-of date, so a back-dated entry isn't the latest", () => {
    const sorted = sortReadings([reading(2, "2026-10-01", "2026-10-01"), reading(1, "2026-09-01", "2026-10-20")]);
    expect(sorted.map((r) => r.value)).toEqual([2, 1]);
  });

  it("breaks a same-day tie with the most recently entered", () => {
    const sorted = sortReadings([reading(1, "2026-10-01", "2026-10-01"), reading(2, "2026-10-01", "2026-10-02")]);
    expect(sorted[0].value).toBe(2);
  });
});

describe("measureProgress", () => {
  it("measures higher-is-better from baseline to target", () => {
    expect(measureProgress(measure({ baseline: 40, target: 90, readings: [reading(70, "2026-10-01")] }))).toBeCloseTo(0.6);
  });

  it("measures lower-is-better from baseline to target", () => {
    expect(measureProgress(measure({ baseline: 18, target: 12, readings: [reading(15, "2026-10-01")] }))).toBeCloseTo(0.5);
  });

  it("can exceed 100% and floors at 0 when moving the wrong way", () => {
    expect(measureProgress(measure({ readings: [reading(125, "2026-10-01")] }))).toBeCloseTo(1.25);
    expect(measureProgress(measure({ baseline: 18, target: 12, readings: [reading(20, "2026-10-01")] }))).toBe(0);
  });

  it("is null without a reading, baseline or target, or when they're equal", () => {
    expect(measureProgress(measure())).toBeNull();
    const readings = [reading(5, "2026-10-01")];
    expect(measureProgress(measure({ baseline: null, readings }))).toBeNull();
    expect(measureProgress(measure({ target: null, readings }))).toBeNull();
    expect(measureProgress(measure({ baseline: 5, target: 5, readings }))).toBeNull();
  });
});

describe("primaryKpi", () => {
  it("takes the lowest order and skips leading measures", () => {
    const leading = measure({ kind: "LEADING", order: -5 });
    const second = measure({ order: 1 });
    const first = measure({ order: 0 });
    expect(primaryKpi([leading, second, first])).toBe(first);
  });

  it("is null with only leading measures", () => {
    expect(primaryKpi([measure({ kind: "LEADING" })])).toBeNull();
  });
});

describe("derivedPct", () => {
  const kpi = measure({ readings: [reading(50, "2026-10-01")] });

  it("uses dollars when both figures are set", () => {
    expect(derivedPct(850_000, 1_000_000, [kpi])).toBeCloseTo(0.85);
  });

  it("falls back to the first KPI when either dollar figure is missing", () => {
    expect(derivedPct(null, 1_000_000, [kpi])).toBeCloseTo(0.5);
    expect(derivedPct(null, null, [kpi])).toBeCloseTo(0.5);
  });

  it("ignores leading measures", () => {
    expect(derivedPct(null, null, [{ ...kpi, kind: "LEADING" }])).toBeNull();
  });

  it("is null when neither gives a percent", () => {
    expect(derivedPct(null, null, [])).toBeNull();
    expect(derivedPct(null, null, [measure()])).toBeNull();
  });
});
