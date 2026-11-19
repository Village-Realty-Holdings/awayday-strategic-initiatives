import { describe, expect, it } from "vitest";
import {
  formatGaugeValue,
  gaugeAriaLabel,
  gaugeDomain,
  gaugeMarks,
  gaugeOverflow,
  gaugePercent,
  inferGaugeFormat,
  layoutGaugeLabels,
  looksLikeDifferentQuantity,
  suggestDomain,
  type GaugeSpec,
} from "./kpi-gauge";

// Values are in the metric's own base unit (dollars, not $M), exactly as an
// observation stores them.
const goals = [
  { id: "goal", label: "2026 goal", value: 23_000_000 },
  { id: "budget", label: "FY27 budget", value: 33_000_000 },
  { id: "stretch", label: "FY27 stretch", value: 47_000_000 },
];

const spec = (overrides: Partial<GaugeSpec> = {}): GaugeSpec => ({
  min: 0,
  max: 50_000_000,
  actual: 34_800_000,
  targets: goals,
  direction: "higher",
  format: { kind: "currency" },
  ...overrides,
});

describe("gauge domain", () => {
  it("keeps a sane domain and repairs an inverted or zero-width one", () => {
    expect(gaugeDomain({ min: 0, max: 50 })).toEqual({ min: 0, max: 50 });
    expect(gaugeDomain({ min: 50, max: 0 })).toEqual({ min: 0, max: 50 });
    const flat = gaugeDomain({ min: 4, max: 4 });
    expect(flat.min).toBeLessThan(4);
    expect(flat.max).toBeGreaterThan(4);
  });

  it("survives a non-finite domain", () => {
    expect(gaugeDomain({ min: Number.NaN, max: 10 })).toEqual({ min: 0, max: 1 });
  });
});

describe("gauge position", () => {
  it("places values proportionally and clamps outside the range", () => {
    expect(gaugePercent(0, 0, 50)).toBe(0);
    expect(gaugePercent(25, 0, 50)).toBe(50);
    expect(gaugePercent(50, 0, 50)).toBe(100);
    expect(gaugePercent(-5, 0, 50)).toBe(0);
    expect(gaugePercent(75, 0, 50)).toBe(100);
  });

  it("handles a negative range, as a margin change or TRevPAR growth needs", () => {
    expect(gaugePercent(0, -2, 8)).toBeCloseTo(20);
    expect(gaugePercent(-2, -2, 8)).toBe(0);
    expect(gaugePercent(8, -2, 8)).toBe(100);
    expect(gaugePercent(-1.5, -2, 8)).toBeCloseTo(5);
  });

  it("reports overflow so the component can say a value is off the scale", () => {
    expect(gaugeOverflow(60, 0, 50)).toBe("above");
    expect(gaugeOverflow(-1, 0, 50)).toBe("below");
    expect(gaugeOverflow(10, 0, 50)).toBeNull();
  });

  it("sorts every mark, actual included, left to right", () => {
    const marks = gaugeMarks(spec());
    expect(marks.map((mark) => mark.id)).toEqual(["goal", "budget", "actual", "stretch"]);
    expect(marks.map((mark) => mark.percent)).toEqual([...marks.map((mark) => mark.percent)].sort((a, b) => a - b));
    expect(gaugeMarks(spec()).find((mark) => mark.id === "actual")?.percent).toBeCloseTo(69.6);
  });

  it("keeps a missing actual out of the marks entirely", () => {
    expect(gaugeMarks(spec({ actual: null })).map((mark) => mark.id)).toEqual(["goal", "budget", "stretch"]);
  });
});

describe("label placement", () => {
  it("never puts two labels closer than the gap in the same lane", () => {
    const placements = layoutGaugeLabels(goals, { min: 0, max: 50_000_000 });
    const byLane = new Map<string, number[]>();
    for (const placement of placements) byLane.set(placement.lane, [...(byLane.get(placement.lane) ?? []), placement.percent]);
    for (const percents of byLane.values()) {
      const sorted = [...percents].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(16);
    }
  });

  it("separates the cluster the first reference screenshot overlapped", () => {
    // Three targets within a few points of each other near the right-hand end.
    const placements = layoutGaugeLabels(
      [
        { id: "goal", label: "2026 goal", value: 12 },
        { id: "budget", label: "FY27 budget", value: 12.1 },
        { id: "stretch", label: "FY27 stretch", value: 12.2 },
        { id: "reference", label: "Reported basis", value: 11.9 },
      ],
      { min: 8, max: 16 },
    );
    expect(new Set(placements.map((placement) => placement.lane)).size).toBe(4);
    // All four sit within a few points of each other, mid-track.
    const percents = placements.map((placement) => placement.percent);
    expect(Math.max(...percents) - Math.min(...percents)).toBeLessThan(6);
    expect(placements.every((placement) => placement.align === "center")).toBe(true);
  });

  it("aligns labels inward at both ends so they are never clipped", () => {
    const placements = layoutGaugeLabels(
      [
        { id: "low", label: "Floor", value: 0 },
        { id: "mid", label: "Goal", value: 25 },
        { id: "high", label: "Stretch", value: 50 },
      ],
      { min: 0, max: 50 },
    );
    expect(placements.map((placement) => [placement.id, placement.align])).toEqual([
      ["low", "left"],
      ["mid", "center"],
      ["high", "right"],
    ]);
  });

  it("keeps one placement per target, in input order, and reuses lanes when crowded", () => {
    // Six near-identical targets: four lanes fill, then the least recently used
    // lane is reused rather than dropping a label.
    const many = Array.from({ length: 6 }, (_, index) => ({ id: `t${index}`, label: `T${index}`, value: 11.9 + index * 0.05 }));
    const placements = layoutGaugeLabels(many, { min: 8, max: 16 });
    expect(placements.map((placement) => placement.id)).toEqual(many.map((target) => target.id));
    expect(placements).toHaveLength(6);
    expect(new Set(placements.map((placement) => placement.lane)).size).toBe(4);
  });

  it("returns nothing for no targets", () => {
    expect(layoutGaugeLabels([], { min: 0, max: 1 })).toEqual([]);
  });
});

describe("formatting", () => {
  it("prints each unit the way the rest of the report does", () => {
    expect(formatGaugeValue(34_800_000, { kind: "currency" })).toBe("$34.8M");
    expect(formatGaugeValue(-1_200_000, { kind: "currency" })).toBe("−$1.2M");
    expect(formatGaugeValue(12.4, { kind: "percent" })).toBe("12.4%");
    expect(formatGaugeValue(0.8, { kind: "points" })).toBe("+0.8 pt");
    expect(formatGaugeValue(-1, { kind: "points" })).toBe("−1 pt");
    expect(formatGaugeValue(3340, { kind: "count" })).toBe("3,340");
    expect(formatGaugeValue(4.64, { kind: "number", })).toBe("4.64");
  });

  it("scales a fraction-based percentage only for display", () => {
    expect(formatGaugeValue(0.124, { kind: "percent", percentIsFraction: true })).toBe("12.4%");
    expect(formatGaugeValue(0.124, { kind: "percent" })).toBe("0.1%");
  });

  it("honours explicit decimals for counts", () => {
    expect(formatGaugeValue(4.6, { kind: "count" }, 2)).toBe("4.60");
  });

  it("infers the unit from how the value and target are already written", () => {
    expect(inferGaugeFormat("$34.8M", "$23M").kind).toBe("currency");
    expect(inferGaugeFormat("12.4%", "<12%").kind).toBe("percent");
    expect(inferGaugeFormat("+0.8 pt", "+0.7 pt").kind).toBe("points");
    expect(inferGaugeFormat("3,340", "2,608").kind).toBe("number");
    expect(inferGaugeFormat(null, null).kind).toBe("number");
  });
});

describe("suggested domain", () => {
  it("includes zero for a non-negative measure so a shortfall cannot look full", () => {
    const domain = suggestDomain([34_800_000, 23_000_000]);
    expect(domain.min).toBe(0);
    expect(domain.max).toBeGreaterThanOrEqual(34_800_000);
  });

  it("keeps a negative measure readable around its own range", () => {
    const domain = suggestDomain([-1, 0.8]);
    expect(domain.min).toBeLessThanOrEqual(-1);
    expect(domain.max).toBeGreaterThanOrEqual(0.8);
  });

  it("never collapses to a single point, and always contains every value", () => {
    // 4.64 against a 4.5 goal used to snap both ends to 4.5, so the gauge showed
    // "Actual 4.64 (outside the charted range)" on an axis of 4.5 to 4.5.
    for (const values of [[4.64, 4.5], [4.64, 4.65, 4.7], [94, 3.3, 1, 3], [12.4, 12, 11]]) {
      const domain = suggestDomain(values);
      expect(domain.max, `${values.join(",")} must have range`).toBeGreaterThan(domain.min);
      for (const value of values) {
        expect(value, `${value} must sit inside ${domain.min}..${domain.max}`).toBeGreaterThanOrEqual(domain.min);
        expect(value, `${value} must sit inside ${domain.min}..${domain.max}`).toBeLessThanOrEqual(domain.max);
      }
    }
  });

  it("copes with nothing to plot", () => {
    expect(suggestDomain([])).toEqual({ min: 0, max: 1 });
  });
});

describe("accessible summary", () => {
  it("names the actual, every target and the direction in one sentence", () => {
    const label = gaugeAriaLabel(spec());
    expect(label).toContain("Actual $34.8M");
    expect(label).toContain("2026 goal $23.0M");
    expect(label).toContain("FY27 budget $33.0M");
    expect(label).toContain("FY27 stretch $47.0M");
    expect(label).toContain("Higher is better");
    expect(label).toContain("Range $0 to $50.0M");
  });

  it("says so when nothing is loaded, and still lists the targets", () => {
    const label = gaugeAriaLabel(spec({ actual: null, direction: "lower" }));
    expect(label).toContain("No actual loaded");
    expect(label).toContain("2026 goal");
    expect(label).toContain("Lower is better");
  });

  it("says the direction is not stated rather than assuming higher is better", () => {
    const label = gaugeAriaLabel(spec({ direction: "unknown" }));
    expect(label).toContain("Direction not stated");
    expect(label).not.toContain("Higher is better");
  });

  it("flags a value outside the charted range", () => {
    expect(gaugeAriaLabel(spec({ actual: 75_000_000 }))).toContain("outside the charted range");
  });
});

describe("looksLikeDifferentQuantity", () => {
  it("rejects a level plotted against growth percentages", () => {
    expect(
      looksLikeDifferentQuantity({ actual: 138000, targets: [1, 5], actualText: "138000", targetText: "1% budget; 5% stretch" }),
    ).toBe(true);
  });

  it("accepts the same measure written with and without a percent sign", () => {
    expect(looksLikeDifferentQuantity({ actual: 11, targets: [11], actualText: "11", targetText: "<11%" })).toBe(false);
  });

  it("accepts a percentage actual against percentage targets", () => {
    expect(
      looksLikeDifferentQuantity({ actual: 34.8, targets: [23, 47], actualText: "34.8%", targetText: "23% budget; 47% stretch" }),
    ).toBe(false);
  });

  it("accepts currency and count gauges, where the spread is ordinary", () => {
    expect(
      looksLikeDifferentQuantity({
        actual: -1_200_000,
        targets: [1_000_000, 47_000_000],
        actualText: "-$1.2M",
        targetText: "$1M budget; $47M stretch",
      }),
    ).toBe(false);
  });
});
