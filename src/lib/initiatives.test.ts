import { describe, expect, it } from "vitest";
import { quadrantTooltipClasses } from "./initiatives";

// The Lift × Value chart is overflow-hidden: a tooltip that opens toward a
// nearby edge is clipped invisible (found live in the Alex demo, 2026-08-19,
// where bottom-row dots showed no tooltip). The placement helper must always
// open the tooltip away from any edge the dot is close to.
describe("quadrantTooltipClasses", () => {
  it("opens downward and centered for a dot in the middle of the chart", () => {
    expect(quadrantTooltipClasses(50, 50)).toBe("top-4 left-1/2 -translate-x-1/2");
  });

  it("flips above the dot near the bottom edge so overflow-hidden cannot clip it", () => {
    expect(quadrantTooltipClasses(50, 10)).toContain("bottom-4");
    expect(quadrantTooltipClasses(50, 29.9)).toContain("bottom-4");
    expect(quadrantTooltipClasses(50, 30)).toContain("top-4");
  });

  it("pins to the dot's left edge near the left side instead of centering", () => {
    expect(quadrantTooltipClasses(4, 50)).toBe("top-4 left-0");
  });

  it("pins to the dot's right edge near the right side instead of centering", () => {
    expect(quadrantTooltipClasses(96, 50)).toBe("top-4 right-0");
  });

  it("handles the clipped-invisible corner case from the demo (bottom-right dot)", () => {
    expect(quadrantTooltipClasses(96, 10)).toBe("bottom-4 right-0");
  });
});
