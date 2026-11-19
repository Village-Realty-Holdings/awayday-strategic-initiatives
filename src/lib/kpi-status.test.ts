import { describe, expect, it } from "vitest";
import {
  deltaTone,
  favorableDelta,
  isFavorable,
  isMixed,
  KPI_STATUSES,
  KPI_STATUS_META,
  metricDirection,
  ragToStatus,
  statusFromComparison,
  statusToneWithRule,
  summarizeStatuses,
  worstTone,
} from "./kpi-status";

describe("KPI status vocabulary", () => {
  it("covers every status the business reports, each with a word, a glyph and a tone", () => {
    expect(KPI_STATUSES).toEqual([
      "ahead",
      "on_goal",
      "on_track",
      "behind",
      "under_budget",
      "needs_attention",
      "floor_breached",
      "no_data",
    ]);
    for (const status of KPI_STATUSES) {
      const meta = KPI_STATUS_META[status];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.glyph.length).toBeGreaterThan(0);
      expect(meta.meaning.length).toBeGreaterThan(0);
      expect(["good", "warn", "crit", "neutral"]).toContain(meta.tone);
    }
  });

  it("maps the required visual treatments", () => {
    expect(KPI_STATUS_META.ahead.tone).toBe("good");
    expect(KPI_STATUS_META.on_goal.tone).toBe("good");
    expect(KPI_STATUS_META.on_track.tone).toBe("good");
    expect(KPI_STATUS_META.behind.tone).toBe("crit");
    expect(KPI_STATUS_META.needs_attention.tone).toBe("warn");
    expect(KPI_STATUS_META.no_data.tone).toBe("neutral");
    // Defaults for the two rule-driven statuses.
    expect(KPI_STATUS_META.under_budget.tone).toBe("warn");
    expect(KPI_STATUS_META.floor_breached.tone).toBe("crit");
  });

  it("lets the approved business meaning recolour under-budget and floor-breach only", () => {
    expect(statusToneWithRule("under_budget", "crit")).toBe("crit");
    expect(statusToneWithRule("floor_breached", "warn")).toBe("warn");
    // Any other status ignores the rule: an override cannot turn a shortfall green.
    expect(statusToneWithRule("behind", "good")).toBe("crit");
    expect(statusToneWithRule("ahead", "crit")).toBe("good");
  });

  it("carries existing RAG statuses into the same vocabulary", () => {
    expect(ragToStatus("GREEN")).toBe("ahead");
    expect(ragToStatus("AMBER")).toBe("on_track");
    expect(ragToStatus("RED")).toBe("behind");
    expect(ragToStatus("GREY")).toBe("no_data");
  });

  it("reports the worst tone in a set", () => {
    expect(worstTone(["good", "neutral"])).toBe("good");
    expect(worstTone(["good", "crit", "warn"])).toBe("crit");
    expect(worstTone([])).toBe("neutral");
  });
});

describe("metric direction", () => {
  it("treats churn and CAC as lower-is-better, including churned unit counts", () => {
    expect(metricDirection("Annualized churn").direction).toBe("lower");
    expect(metricDirection("Units churned (Finance)").direction).toBe("lower");
    expect(metricDirection("Cash CAC per add").direction).toBe("lower");
    expect(metricDirection("LTM churn %").direction).toBe("lower");
  });

  it("treats costs and cycle time as lower-is-better, margins and revenue as higher", () => {
    expect(metricDirection("Cost of sales").direction).toBe("lower");
    expect(metricDirection("Support cost, % of revenue").direction).toBe("lower");
    expect(metricDirection("Median days to close").direction).toBe("lower");
    expect(metricDirection("Shop NOI margin vs prior year").direction).toBe("higher");
    expect(metricDirection("TRevPAR growth").direction).toBe("higher");
    expect(metricDirection("Adjusted EBITDA").direction).toBe("higher");
    expect(metricDirection("Guest review score").direction).toBe("higher");
  });

  it("marks an unrecognised name as unknown rather than assuming a direction", () => {
    const reading = metricDirection("Widget throughput");
    expect(reading.known).toBe(false);
    expect(isFavorable(10, reading)).toBeNull();
    expect(deltaTone(10, reading)).toBeNull();
    expect(metricDirection(null).known).toBe(false);
  });
});

describe("favour, not sign", () => {
  const revenue = metricDirection("Revenue");
  const churn = metricDirection("Annualized churn");
  const cost = metricDirection("Cost of sales");

  it("calls a rise in revenue good and a rise in churn bad", () => {
    expect(isFavorable(2, revenue)).toBe(true);
    expect(isFavorable(-2, revenue)).toBe(false);
    expect(isFavorable(0.9, churn)).toBe(false);
    expect(isFavorable(-0.9, churn)).toBe(true);
  });

  it("reads expenses reported as negative numbers correctly: more spend is worse", () => {
    // Cost of sales −17.0 against a −15.0 comparison is 2 more of spend.
    expect(favorableDelta(-2, -15, cost)).toBe(false);
    expect(favorableDelta(2, -15, cost)).toBe(true);
  });

  it("does not flip the sign of a higher-is-better metric whose values are negative", () => {
    // Adjusted EBITDA is higher-is-better and can be a loss. −1.2 against a
    // budget of −1.0 is a wider loss (delta −0.2) and must not read as good.
    const ebitda = metricDirection("Adjusted EBITDA");
    expect(ebitda).toEqual({ direction: "higher", known: true });
    expect(favorableDelta(-0.2, -1.0, ebitda)).toBe(false);
    expect(deltaTone(-0.2, ebitda, -1.0)).toBe("crit");
    // Narrowing a loss is an improvement, even though the delta is positive.
    expect(favorableDelta(0.3, -1.0, ebitda)).toBe(true);
    expect(deltaTone(0.3, ebitda, -1.0)).toBe("good");
    // A negative comparator on a lower-is-better metric keeps the expense rule.
    expect(favorableDelta(-0.2, -1.0, metricDirection("Cost of sales"))).toBe(false);
  });

  it("leaves a zero delta and an unknown direction neutral", () => {
    expect(deltaTone(0, revenue)).toBeNull();
    expect(deltaTone(5, metricDirection("Widget throughput"))).toBeNull();
    expect(favorableDelta(-0.2, -1.0, metricDirection("Widget throughput"))).toBeNull();
  });
});

describe("status from a comparison", () => {
  it("is on goal inside the tolerance and ahead or behind outside it", () => {
    expect(statusFromComparison({ actual: 103, target: 100, direction: "higher", tolerance: 0.1 })).toBe("on_goal");
    expect(statusFromComparison({ actual: 90, target: 100, direction: "higher", tolerance: 0.1 })).toBe("on_goal");
    expect(statusFromComparison({ actual: 120, target: 100, direction: "higher", tolerance: 0.1 })).toBe("ahead");
    expect(statusFromComparison({ actual: 80, target: 100, direction: "higher", tolerance: 0.1 })).toBe("behind");
  });

  it("handles lower-is-better metrics without flipping the meaning of the numbers", () => {
    expect(statusFromComparison({ actual: 11, target: 12, direction: "lower" })).toBe("ahead");
    expect(statusFromComparison({ actual: 13, target: 12, direction: "lower" })).toBe("behind");
  });

  it("claims nothing without both numbers", () => {
    expect(statusFromComparison({ actual: null, target: 12, direction: "lower" })).toBe("no_data");
    expect(statusFromComparison({ actual: 4, target: null, direction: "higher" })).toBe("no_data");
    expect(statusFromComparison({ actual: Number.NaN, target: 1, direction: "higher" })).toBe("no_data");
  });

  it("without a tolerance, a value on the target is ahead rather than on goal", () => {
    expect(statusFromComparison({ actual: 100, target: 100, direction: "higher" })).toBe("on_goal");
    expect(statusFromComparison({ actual: 101, target: 100, direction: "higher" })).toBe("ahead");
  });
});

describe("mixed performance", () => {
  it("counts both sides instead of collapsing to one verdict", () => {
    const summary = summarizeStatuses(["ahead", "ahead", "behind", "on_track", "no_data"]);
    expect(summary).toMatchObject({ total: 5, loaded: 4, missing: 1, ahead: 2, onTrack: 1, behind: 1 });
    expect(summary.label).toBe("1 of 4 measures behind · 1 not loaded");
    expect(summary.tone).toBe("crit");
    expect(isMixed(summary)).toBe(true);
  });

  it("names an all-behind and an all-ahead section differently", () => {
    expect(summarizeStatuses(["behind", "behind"]).label).toBe("All 2 measures behind");
    expect(summarizeStatuses(["ahead"]).label).toBe("All 1 measure ahead");
    expect(summarizeStatuses(["on_track", "on_goal"]).label).toBe("All 2 measures on or ahead of plan");
    expect(isMixed(summarizeStatuses(["behind", "behind"]))).toBe(false);
    expect(isMixed(summarizeStatuses(["behind", "ahead"]))).toBe(true);
  });

  it("does not treat missing measures as good news", () => {
    const summary = summarizeStatuses(["no_data", "no_data"]);
    expect(summary.loaded).toBe(0);
    expect(summary.tone).toBe("neutral");
    expect(summary.label).toBe("No measures loaded of 2");
    expect(summarizeStatuses([]).label).toBe("No measures");
  });
});
