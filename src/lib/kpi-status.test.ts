import { describe, expect, it } from "vitest";
import {
  deltaTone,
  favorableDelta,
  isFavorable,
  isMixed,
  KPI_STATUSES,
  KPI_STATUS_META,
  measureDirection,
  metricDirection,
  ragToStatus,
  resolveDirection,
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

  it("classifies the reviewed business measures as the business reads them", () => {
    const expected: [string, "higher" | "lower"][] = [
      ["Revenue", "higher"],
      ["Adjusted EBITDA", "higher"],
      ["Shop NOI", "higher"],
      ["Gross profit", "higher"],
      ["Occupancy", "higher"],
      ["Occupancy vs market", "higher"],
      ["BD unit adds", "higher"],
      ["Net unit adds", "higher"],
      ["Annualized unit churn", "lower"],
      ["Owner unit churn (TTM)", "lower"],
      ["Cash CAC", "lower"],
      ["Operating expenses", "lower"],
      ["Support cost", "lower"],
      ["Guest review score", "higher"],
      ["Maintenance margin", "higher"],
      ["Shop NOI margin vs prior year", "higher"],
      ["Shop NOI margin vs PY, ex-OTA", "higher"],
      ["TRevPAR growth vs PY, reported", "higher"],
      ["TRevPAR growth vs PY, ex-OTA", "higher"],
    ];
    for (const [name, direction] of expected) {
      const reading = metricDirection(name);
      expect({ name, direction: reading.direction, known: reading.known }).toEqual({ name, direction, known: true });
    }
  });

  it("does not let a broad word decide a compound name", () => {
    // "units" alone is higher-is-better; "units lost" is the opposite.
    expect(metricDirection("Units lost").direction).toBe("lower");
    expect(metricDirection("Deals lost").direction).toBe("lower");
    expect(metricDirection("Revenue lost").direction).toBe("lower");
    // "cost" alone is lower-is-better; an efficiency measure rises to improve.
    expect(metricDirection("Cost efficiency").direction).toBe("higher");
    expect(metricDirection("Cost savings vs plan").direction).toBe("higher");
    // A score is normally higher-is-better, but a risk score is a warning sign.
    expect(metricDirection("Risk score").direction).toBe("lower");
    // A bare "days" or "rate" is not a direction.
    expect(metricDirection("Days").known).toBe(false);
    expect(metricDirection("Rate").known).toBe(false);
    expect(metricDirection("Growth").known).toBe(false);
  });

  it("keeps a name that mixes churn and retention uncoloured", () => {
    // Two sides of the same coin in one label: no single verdict is honest.
    expect(metricDirection("Churn and retention").known).toBe(false);
    // Only one of them named: the word that is there decides.
    expect(metricDirection("Net revenue churn").direction).toBe("lower");
    expect(metricDirection("Owner retention").direction).toBe("higher");
  });

  it("prefers an approved mapping's own direction over the name", () => {
    expect(measureDirection(false)).toEqual({ direction: "lower", known: true });
    expect(measureDirection(true)).toEqual({ direction: "higher", known: true });
    expect(measureDirection(null)).toBeNull();
    expect(measureDirection(undefined)).toBeNull();
  });

  it("resolves declared metadata first and only then the name", () => {
    // A mapping can contradict the name and it wins: the business approved it.
    // "Widget throughput" reads as neither direction on its own.
    expect(resolveDirection(true, "Widget throughput")).toEqual({ direction: "higher", known: true });
    expect(resolveDirection(false, "Widget throughput")).toEqual({ direction: "lower", known: true });
    // A mapping that says lower wins even when the name says margin.
    expect(resolveDirection(false, "Maintenance margin")).toEqual({ direction: "lower", known: true });
    // No declaration: the name decides, and an unknown name stays unknown.
    expect(resolveDirection(null, "Owner churn")).toEqual({ direction: "lower", known: true });
    expect(resolveDirection(undefined, "Widget throughput").known).toBe(false);
    // Declared metadata does not make an unreadable name look decidable for a
    // *different* metric: the ambiguity rule still applies when it is the fallback.
    expect(resolveDirection(null, "Churn and retention").known).toBe(false);
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

  it("reads operating expenses stored as negatives in both directions", () => {
    const opex = metricDirection("Operating expenses");
    // Less spend than budget is better, even though the delta is positive.
    expect(favorableDelta(2, -15, opex)).toBe(true);
    expect(favorableDelta(-2, -15, opex)).toBe(false);
    // The same metric stored as a positive magnitude behaves the same way.
    expect(favorableDelta(-2, 15, opex)).toBe(true);
    expect(favorableDelta(2, 15, opex)).toBe(false);
    expect(deltaTone(2, opex, -15)).toBe("good");
  });

  it("compares percentage points as points, not as a percentage change", () => {
    const exOta = metricDirection("Shop NOI margin vs PY, ex-OTA");
    const reported = metricDirection("Shop NOI margin vs PY, reported");
    // Both are higher-is-better, so their delta signs mean what they say. The
    // ex-OTA and reported bases disagree, and each keeps its own verdict.
    expect(exOta).toEqual(reported);
    expect(statusFromComparison({ actual: 0.8, target: 0.7, direction: exOta.direction })).toBe("ahead");
    expect(statusFromComparison({ actual: -1.0, target: 0.7, direction: reported.direction })).toBe("behind");
    // A 1.0 pt improvement is +1 point here, never a 100% move.
    expect(favorableDelta(0.5, 0.3, exOta)).toBe(true);
    expect(favorableDelta(-0.5, 0.3, reported)).toBe(false);
  });

  it("gives no status when a KPI has no target to compare with", () => {
    expect(statusFromComparison({ actual: 12.4, target: null, direction: "lower" })).toBe("no_data");
    expect(statusFromComparison({ actual: null, target: 11, direction: "lower" })).toBe("no_data");
    expect(statusFromComparison({ actual: Number.NaN, target: 11, direction: "higher" })).toBe("no_data");
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
