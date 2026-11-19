import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GaugeSpec } from "@/lib/kpi-gauge";
import { KpiGauge } from "./kpi-gauge";
import { KpiStatusBadge, KpiStatusChips, MixedPerformanceChip } from "./kpi-status-badge";
import { summarizeStatuses } from "@/lib/kpi-status";

// Render tests for the gauge and the status badges. Values here are deliberately
// test values, not the reviewed report's figures, so nothing in this file can be
// mistaken for production data.

const spec = (overrides: Partial<GaugeSpec> = {}): GaugeSpec => ({
  min: 0,
  max: 10_000_000,
  actual: 7_400_000,
  targets: [{ id: "goal", label: "Goal", value: 9_000_000, style: "goal" }],
  direction: "higher",
  format: { kind: "currency" },
  ...overrides,
});

describe("KpiGauge", () => {
  it("plots the actual and every target, and names them all for assistive technology", () => {
    const html = renderToStaticMarkup(
      <KpiGauge
        spec={spec({
          targets: [
            { id: "goal", label: "2026 goal", value: 9_000_000, style: "goal" },
            { id: "budget", label: "FY27 budget", value: 8_000_000, style: "budget" },
            { id: "stretch", label: "FY27 stretch", value: 9_500_000, style: "stretch" },
          ],
        })}
        status="behind"
      />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain("Actual $7.4M");
    expect(html).toContain("2026 goal $9.0M");
    expect(html).toContain("FY27 budget $8.0M");
    expect(html).toContain("FY27 stretch $9.5M");
    expect(html).toContain("Higher is better");
    expect(html.match(/data-gauge-marker=/g)).toHaveLength(3);
    expect(html).toContain('data-gauge-actual="behind"');
    // Status reaches the marker through the tone class, and the badge word still
    // carries the meaning, so colour is never the only signal.
    expect(html).toContain("kpi-gauge--crit");
  });

  it("renders the track and targets when no value is loaded, and says so", () => {
    const html = renderToStaticMarkup(<KpiGauge spec={spec({ actual: null })} />);
    expect(html).toContain("No value loaded for this period");
    expect(html).toContain("No actual loaded");
    expect(html).not.toContain("data-gauge-actual");
    expect(html).toContain('data-gauge-marker="goal"');
    expect(html).not.toContain("kpi-gauge__fill");
  });

  it("gives clustered target labels different lanes instead of overlapping them", () => {
    const html = renderToStaticMarkup(
      <KpiGauge
        spec={spec({
          min: 8,
          max: 16,
          actual: 12.4,
          format: { kind: "percent" },
          targets: [
            { id: "goal", label: "2026 goal", value: 12, style: "goal" },
            { id: "budget", label: "FY27 budget", value: 12.1, style: "budget" },
            { id: "stretch", label: "FY27 stretch", value: 12.2, style: "stretch" },
          ],
        })}
      />,
    );
    const lanes = [...html.matchAll(/data-gauge-label="[^"]+" data-lane="([^"]+)"/g)].map((match) => match[1]);
    expect(lanes).toHaveLength(3);
    expect(new Set(lanes).size).toBe(3);
  });

  it("handles a negative domain, as a margin change against prior year needs", () => {
    const html = renderToStaticMarkup(
      <KpiGauge
        spec={{
          min: -2,
          max: 2,
          actual: -0.6,
          targets: [{ id: "goal", label: "Goal", value: 0.7, style: "goal" }],
          direction: "higher",
          format: { kind: "points" },
        }}
        status="behind"
      />,
    );
    expect(html).toContain("−2 pt");
    expect(html).toContain("+2 pt");
    expect(html).toContain("Actual −0.6 pt");
    expect(html).toContain("Goal +0.7 pt");
  });

  it("marks lower-is-better metrics in the accessible summary", () => {
    const html = renderToStaticMarkup(
      <KpiGauge
        spec={spec({
          min: 8,
          max: 16,
          actual: 13.9,
          targets: [{ id: "goal", label: "Ceiling", value: 12, style: "goal" }],
          direction: "lower",
          format: { kind: "percent" },
        })}
        status="under_budget"
      />,
    );
    expect(html).toContain("Lower is better");
    // Default treatment for under budget is amber, not red.
    expect(html).toContain("kpi-gauge--warn");
  });

  it("lets the approved reporting rule recolour under budget and floor breach", () => {
    const html = renderToStaticMarkup(<KpiGauge spec={spec()} status="floor_breached" toneRule="warn" />);
    expect(html).toContain("kpi-gauge--warn");
    expect(html).not.toContain("kpi-gauge--crit");
  });

  it("prints an off-scale arrow rather than silently pinning the value", () => {
    const html = renderToStaticMarkup(<KpiGauge spec={spec({ actual: 12_000_000 })} status="ahead" />);
    expect(html).toContain("outside the charted range");
    expect(html).toContain("▶");
  });
});

describe("status badges", () => {
  it("always shows the word next to the glyph", () => {
    expect(renderToStaticMarkup(<KpiStatusBadge status="ahead" />)).toContain("Ahead");
    expect(renderToStaticMarkup(<KpiStatusBadge status="no_data" />)).toContain("No data");
    expect(renderToStaticMarkup(<KpiStatusBadge status="floor_breached" />)).toContain("Floor breached");
  });

  it("keeps every part of a mixed pillar visible", () => {
    const html = renderToStaticMarkup(
      <KpiStatusChips statuses={[{ status: "ahead" }, { status: "behind", label: "CAC off track" }]} />,
    );
    expect(html).toContain("Ahead");
    expect(html).toContain("Behind");
  });

  it("summarises a mixed scorecard with counts, not one verdict", () => {
    const html = renderToStaticMarkup(
      <MixedPerformanceChip summary={summarizeStatuses(["ahead", "behind", "on_track", "no_data"])} />,
    );
    expect(html).toContain("1 of 3 measures behind");
    expect(html).toContain("1 not loaded");
    expect(html).toContain('data-mixed="true"');
  });

  it("renders nothing for an empty scorecard", () => {
    expect(renderToStaticMarkup(<MixedPerformanceChip summary={summarizeStatuses([])} />)).toBe("");
  });
});
