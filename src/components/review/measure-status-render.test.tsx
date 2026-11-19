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

// The October review's combined statements: the approved wording is shown in
// full, and the colour still comes from the status word, so green / amber / red
// reach the screen for the combined states too.
describe("MeasureStatus — approved wording and its colour", () => {
  const approved = (wording: string, override: "AHEAD" | "ON_TRACK" | "BEHIND", rag: "GREEN" | "AMBER" | "RED") =>
    measure({ rag, statusOverride: override, statusWording: wording, approvedStatus: wording, statusGap: "no-goal" });

  it("shows 'Ahead · CAC off track' in full rather than only 'Ahead'", () => {
    const out = html(area({ measure: approved("Ahead · CAC off track", "AHEAD", "GREEN") }));
    expect(out).toContain("Ahead · CAC off track");
    expect(out).not.toContain(NOT_CONFIGURED_LABEL);
    expect(out).toContain('data-status="ahead"');
    expect(out).toContain("bg-ok-soft");
  });

  it("shows 'Behind · October beat budget' in red", () => {
    const out = html(area({ measure: approved("Behind · October beat budget", "BEHIND", "RED") }));
    expect(out).toContain("Behind · October beat budget");
    expect(out).toContain('data-status="behind"');
    expect(out).toContain("bg-risk-soft");
  });

  it("shows 'On track reported · October under PY' in amber", () => {
    const out = html(area({ measure: approved("On track reported · October under PY", "ON_TRACK", "AMBER") }));
    expect(out).toContain("On track reported · October under PY");
    expect(out).toContain('data-status="on_track"');
    expect(out).toContain("bg-warn-soft");
  });

  it("shows 'On goal ex-OTA · behind reported' in amber", () => {
    const out = html(area({ measure: approved("On goal ex-OTA · behind reported", "ON_TRACK", "AMBER") }));
    expect(out).toContain("On goal ex-OTA · behind reported");
    expect(out).toContain("bg-warn-soft");
  });

  it("renders the plain status word, with no wording bolted on, when none was approved", () => {
    const out = html(area({ measure: measure({ rag: "GREEN", statusOverride: "AHEAD", statusWording: null }) }));
    expect(out).toContain("Ahead");
    expect(out).not.toContain("·");
  });
});
