import { describe, expect, it } from "vitest";

import { parseTargetMarkers, parseTargetNumber, primaryGoalMarker, targetMarkerLabel } from "@/lib/review-format";

// Target prose is definition data, so these fixtures are illustrative labels and
// numbers of the kind a KPI definition contains, not report figures.
describe("parseTargetMarkers", () => {
  it("reads a single plain figure as the goal", () => {
    expect(parseTargetMarkers("$26M")).toMatchObject([
      { id: "goal-0", label: "Goal", value: 26_000_000, style: "goal", lowerIsBetter: false, reference: null, unit: "currency" },
    ]);
    expect(parseTargetMarkers("23%")[0]).toMatchObject({ value: 23, style: "goal", unit: "percent" });
  });

  it("names the planning context a target's own words state, and leaves it unknown otherwise", () => {
    // The reviewed October report sets the 2026 goal beside the FY27 budget and
    // stretch. The context comes only from the text; nothing is assumed.
    expect(parseTargetMarkers("2026 goal $23M")[0]).toMatchObject({ value: 23_000_000, reference: "2026", style: "goal" });
    expect(parseTargetMarkers("FY27 12%")[0]).toMatchObject({ value: 12, reference: "FY27" });
    expect(parseTargetMarkers("$33M FY27 budget")[0]).toMatchObject({ value: 33_000_000, reference: "FY27", style: "budget" });
    expect(parseTargetMarkers("3.3% goal")[0]).toMatchObject({ reference: null });
    expect(parseTargetMarkers("<11%")[0]).toMatchObject({ reference: null, unit: "percent" });
  });

  it("records the quantity each figure is written in", () => {
    expect(parseTargetMarkers("$23M goal; $33M budget")[0]).toMatchObject({ unit: "currency" });
    expect(parseTargetMarkers("23% goal; 28% stretch")[0]).toMatchObject({ unit: "percent" });
    expect(parseTargetMarkers("+0.7 pt goal")[0]).toMatchObject({ unit: "points", value: 0.7 });
    expect(parseTargetMarkers("2,608 goal")[0]).toMatchObject({ unit: "count", value: 2608 });
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

  it("does not read the first letter of the next word as a scale suffix", () => {
    // "3,152 budget" is a bare 3,152. Reading the "b" as billions turned the
    // marker into 3.152 trillion, which broke the axis and the marker position.
    const markers = parseTargetMarkers("2,608 goal; 3,152 budget");
    expect(markers.map((m) => [m.style, m.value])).toEqual([
      ["goal", 2608],
      ["budget", 3152],
    ]);
    expect(parseTargetMarkers("0.7 goal; 0.25 budget; 1 stretch").map((m) => [m.style, m.value])).toEqual([
      ["goal", 0.7],
      ["budget", 0.25],
      ["stretch", 1],
    ]);
    // A genuine attached suffix still scales: "$33M budget".
    expect(parseTargetMarkers("$23M goal; $33M budget; $47M stretch").map((m) => m.value)).toEqual([
      23_000_000, 33_000_000, 47_000_000,
    ]);
    // ...and a spaced suffix is still honoured when it stands alone.
    expect(parseTargetMarkers("2.5 M goal")[0]).toMatchObject({ value: 2_500_000 });
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

// The reviewed October report judges each pillar against its 2026 goal and shows
// the FY27 budget and stretch beside it. These rules decide which figure a
// status is allowed to use.
describe("primaryGoalMarker", () => {
  const goal = (text: string | null, kind?: Parameters<typeof primaryGoalMarker>[1]) => {
    const marker = primaryGoalMarker(parseTargetMarkers(text), kind);
    return marker ? [marker.value, marker.reference] : null;
  };

  it("uses the goal, never the budget or the stretch", () => {
    expect(goal("$23M goal; $33M budget; $47M stretch", "currency")).toEqual([23_000_000, null]);
    expect(goal("2026 goal $23M; FY27 $33M budget; $47M stretch", "currency")).toEqual([23_000_000, "2026"]);
  });

  it("refuses a figure the text labels FY27", () => {
    expect(goal("FY27 goal $33M", "currency")).toBeNull();
    expect(goal("FY27 12% goal", "percent")).toBeNull();
  });

  it("never rates a count against a growth percentage", () => {
    // Grow's 2026 goal is stated as a growth percentage while the pillar measure
    // is a unit count: 3,340 units against 23% would be a meaningless status.
    expect(goal("2026 goal 23%", "count")).toBeNull();
    expect(goal("2026 goal 23%", "percent")).toEqual([23, "2026"]);
    expect(goal("2,608 goal", "count")).toEqual([2608, null]);
  });

  it("treats a margin goal written as a percent as percentage points", () => {
    expect(goal("+0.7% goal", "points")).toEqual([0.7, null]);
    expect(goal("+0.7 pt goal", "points")).toEqual([0.7, null]);
    expect(goal("+0.7 pt goal", "currency")).toBeNull();
  });

  it("says nothing when the text has no goal at all", () => {
    expect(goal("23% budget; 28% stretch", "percent")).toBeNull();
    expect(goal("TBD")).toBeNull();
    expect(goal(null)).toBeNull();
  });

  it("labels a marker with the planning context its text names", () => {
    const [explicit] = parseTargetMarkers("2026 goal $23M");
    const [fy27] = parseTargetMarkers("$33M FY27 budget");
    const [plain] = parseTargetMarkers("$26M total");
    expect(targetMarkerLabel(explicit)).toBe("2026 goal");
    expect(targetMarkerLabel(fy27)).toBe("FY27 budget");
    expect(targetMarkerLabel(plain)).toBe("Goal");
  });
});
