import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NOT_CONFIGURED_LABEL, STATUS_GAP_TEXT, type ReviewArea, type ReviewMeasure } from "@/lib/review-model";
import { MeasureStatus } from "./review-view";

// The October rule: a calculated status needs a 2026 goal, a declared direction
// and a declared reporting basis. When any is missing the pillar says "Not
// configured" and names the gap — it never borrows a colour from an FY27 figure.
// A status approved by hand still wins.

const measure = (overrides: Partial<ReviewMeasure> = {}): ReviewMeasure => ({
  kpiId: "kpi-1",
  name: "Acquired EBITDA closed",
  value: "$34.8M",
  target: "2026 goal $23M · $33M budget",
  rag: "GREY",
  source: "import",
  ...overrides,
});

const area = (overrides: Partial<ReviewArea> = {}): ReviewArea => ({
  id: "area-1",
  code: "M&A",
  name: "M&A",
  kind: "VALUE_DRIVER",
  number: 1,
  goal: null,
  owner: null,
  ownerLine: null,
  measure: measure(),
  sis: [],
  ...overrides,
});

const html = (a: ReviewArea) => renderToStaticMarkup(<MeasureStatus area={a} />);

describe("MeasureStatus — October status and the 'Not configured' state", () => {
  it("prints the calculated status when a goal exists", () => {
    const out = html(area({ measure: measure({ rag: "GREEN", calculatedRag: "GREEN" }) }));
    expect(out).toContain('data-status="ahead"');
    expect(out).not.toContain(NOT_CONFIGURED_LABEL);
  });

  it("says 'Not configured' and names the gap when no 2026 goal is stated", () => {
    const out = html(area({ measure: measure({ rag: "GREY", statusGap: "no-goal" }) }));
    expect(out).toContain(NOT_CONFIGURED_LABEL);
    expect(out).toContain(STATUS_GAP_TEXT["no-goal"]);
    // No confident verdict word leaks through.
    expect(out).not.toMatch(/Ahead|Behind|On track/);
  });

  it("says 'Not configured' when the goal is in a different quantity", () => {
    const out = html(area({ measure: measure({ rag: "GREY", statusGap: "goal-not-comparable" }) }));
    expect(out).toContain(NOT_CONFIGURED_LABEL);
    expect(out).toContain(STATUS_GAP_TEXT["goal-not-comparable"]);
  });

  it("says 'Not configured' when the reporting basis is undeclared", () => {
    const out = html(area({ measure: measure({ rag: "GREY", statusGap: "no-basis" }) }));
    expect(out).toContain(NOT_CONFIGURED_LABEL);
    expect(out).toContain(STATUS_GAP_TEXT["no-basis"]);
  });

  it("says 'Not configured' when the direction is undeclared", () => {
    const out = html(area({ measure: measure({ rag: "GREY", statusGap: "no-direction" }) }));
    expect(out).toContain(NOT_CONFIGURED_LABEL);
    expect(out).toContain(STATUS_GAP_TEXT["no-direction"]);
  });

  it("keeps an approved hand-set status authoritative even when a gap exists", () => {
    const out = html(area({ measure: measure({ rag: "AMBER", statusOverride: "ON_TRACK", statusGap: "no-goal" }) }));
    expect(out).not.toContain(NOT_CONFIGURED_LABEL);
    expect(out).toContain('data-status="on_track"');
  });

  it("shows no status at all when the area has no measure", () => {
    const out = html(area({ measure: null }));
    expect(out).not.toContain(NOT_CONFIGURED_LABEL);
    expect(out).toContain('data-status="no_data"');
  });
});
