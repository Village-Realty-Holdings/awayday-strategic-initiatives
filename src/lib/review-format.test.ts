import { describe, expect, it } from "vitest";

import { parseTargetMarkers, parseTargetNumber } from "@/lib/review-format";

// Target prose is definition data, so these fixtures are illustrative labels and
// numbers of the kind a KPI definition contains, not report figures.
describe("parseTargetMarkers", () => {
  it("reads a single plain figure as the goal", () => {
    expect(parseTargetMarkers("$26M")).toEqual([
      { id: "goal-0", label: "Goal", value: 26_000_000, style: "goal", lowerIsBetter: false },
    ]);
    expect(parseTargetMarkers("23%")[0]).toMatchObject({ value: 23, style: "goal" });
  });

  it("keeps a lower-is-better target's direction", () => {
    expect(parseTargetMarkers("<11%")[0]).toMatchObject({ value: 11, lowerIsBetter: true, style: "goal" });
  });

  it("reads a budget and a stretch when the definition names them", () => {
    const markers = parseTargetMarkers("23% budget; 28% stretch");
    expect(markers.map((m) => [m.style, m.label, m.value])).toEqual([
      ["budget", "Budget", 23],
      ["stretch", "Stretch", 28],
    ]);
  });

  it("ignores an unlabelled component figure instead of plotting it as a goal", () => {
    const markers = parseTargetMarkers("$26M total; $11M via tuck-ins; $47M stretch");
    expect(markers.map((m) => [m.style, m.value])).toEqual([
      ["goal", 26_000_000],
      ["stretch", 47_000_000],
    ]);
  });

  it("never invents a marker from text with no usable figure", () => {
    expect(parseTargetMarkers("TBD")).toEqual([]);
    expect(parseTargetMarkers("")).toEqual([]);
    expect(parseTargetMarkers(null)).toEqual([]);
    expect(parseTargetMarkers(undefined)).toEqual([]);
    expect(parseTargetMarkers("to be agreed with the board in January")).toEqual([]);
  });

  it("reads signed targets, such as a margin improvement in points", () => {
    const markers = parseTargetMarkers("+0.25% budget; +1% stretch");
    expect(markers.map((m) => [m.style, m.value])).toEqual([
      ["budget", 0.25],
      ["stretch", 1],
    ]);
  });

  it("drops a repeated marker so one target is drawn once", () => {
    expect(parseTargetMarkers("20% goal; 20% goal")).toHaveLength(1);
  });

  it("gives every marker a stable id", () => {
    expect(parseTargetMarkers("23% budget; 28% stretch").map((m) => m.id)).toEqual(["budget-0", "stretch-1"]);
  });

  it("still agrees with parseTargetNumber on a single figure", () => {
    for (const text of ["$26M", "1,200", "4.5", "<11%"]) {
      const single = parseTargetNumber(text);
      const markers = parseTargetMarkers(text);
      expect(markers).toHaveLength(1);
      expect(markers[0].value).toBe(single?.value);
      expect(markers[0].lowerIsBetter).toBe(single?.lowerIsBetter);
    }
  });
});
