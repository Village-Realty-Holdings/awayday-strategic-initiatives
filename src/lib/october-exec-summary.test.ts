import { describe, expect, it } from "vitest";
import {
  OCTOBER_2026_EXEC_COMPARISONS,
  OCTOBER_2026_EXEC_SOURCE,
  OCTOBER_2026_SUMMARY_SO_WHATS,
  OCTOBER_2026_SUPERSEDED_SUMMARY,
  planExecComparisons,
  planSummarySoWhats,
  type StoredExecComparison,
  type StoredSummary,
} from "@/lib/october-exec-summary";

const stored = (cardKey: string, order: number, text: string, tone: string | null): StoredExecComparison => ({
  id: `oct-exec-2026-10-${cardKey}-${order}`,
  cardKey,
  order,
  text,
  tone,
  sourceDocumentName: OCTOBER_2026_EXEC_SOURCE,
});

const allReviewed = (): StoredExecComparison[] =>
  OCTOBER_2026_EXEC_COMPARISONS.flatMap((card) => card.lines.map((line, order) => stored(card.cardKey, order, line.text, line.tone)));

describe("October 2026 executive comparison lines — the reviewed report's own words", () => {
  it("carries the four cards, in the report's order, with two lines each", () => {
    expect(OCTOBER_2026_EXEC_COMPARISONS.map((card) => card.cardKey)).toEqual([
      "month-adjusted-ebitda",
      "ytd-adjusted-ebitda",
      "ltm-lender-ebitda",
      "month-shop-noi",
    ]);
    for (const card of OCTOBER_2026_EXEC_COMPARISONS) expect(card.lines).toHaveLength(2);
  });

  it("keeps each line exactly as printed, with the reviewer's colour", () => {
    expect(OCTOBER_2026_EXEC_COMPARISONS[0].lines).toEqual([
      { text: "$1.8M under the $0.6M budget", tone: "NEGATIVE" },
      { text: "$1.3M under PY", tone: "NEGATIVE" },
    ]);
    expect(OCTOBER_2026_EXEC_COMPARISONS[1].lines).toEqual([
      { text: "+3.6% vs budget", tone: "POSITIVE" },
      { text: "+9.0% vs PY", tone: "POSITIVE" },
    ]);
    // The LTM card has no colour in the report: a movement and a starting level.
    expect(OCTOBER_2026_EXEC_COMPARISONS[2].lines).toEqual([
      { text: "+$0.7M in October", tone: "NEUTRAL" },
      { text: "$86.4M at Dec-25", tone: "NEUTRAL" },
    ]);
    // Shop NOI missed budget but beat prior year: mixed lines, not one colour.
    expect(OCTOBER_2026_EXEC_COMPARISONS[3].lines).toEqual([
      { text: "−14.4% vs budget", tone: "NEGATIVE" },
      { text: "+22.2% vs PY", tone: "POSITIVE" },
    ]);
  });

  it("plans every line for a month that holds none", () => {
    const plan = planExecComparisons([]);
    expect(plan.toCreate).toHaveLength(8);
    expect(plan.alreadyApplied).toBe(0);
    expect(plan.drift).toEqual([]);
    expect(plan.toCreate[0]).toEqual({
      cardKey: "month-adjusted-ebitda",
      order: 0,
      text: "$1.8M under the $0.6M budget",
      tone: "NEGATIVE",
      sourceDocumentName: OCTOBER_2026_EXEC_SOURCE,
    });
  });

  it("is a no-op once the lines are stored", () => {
    const plan = planExecComparisons(allReviewed());
    expect(plan.toCreate).toEqual([]);
    expect(plan.alreadyApplied).toBe(8);
    expect(plan.drift).toEqual([]);
  });

  it("reports a changed line as drift instead of overwriting it", () => {
    const current = allReviewed();
    current[0] = { ...current[0], text: "$2.0M under the $0.6M budget" };
    const plan = planExecComparisons(current);
    expect(plan.toCreate).toEqual([]);
    expect(plan.drift).toHaveLength(1);
    expect(plan.drift[0].found.text).toBe("$2.0M under the $0.6M budget");
  });

  it("reports a line it does not know about, and never deletes it", () => {
    const plan = planExecComparisons([...allReviewed(), stored("month-shop-noi", 2, "+40% vs plan", "POSITIVE")]);
    expect(plan.drift.map((entry) => entry.order)).toEqual([2]);
    expect(plan.toCreate).toEqual([]);
  });
});

describe("October 2026 summary so-whats — the four bullets under the cards", () => {
  it("holds the report's four bullets in order, with their bold lead and colour", () => {
    expect(OCTOBER_2026_SUMMARY_SO_WHATS.map((bullet) => [bullet.headline, bullet.tone])).toEqual([
      ["Shop NOI missed budget and Adj. EBITDA went negative.", "NEGATIVE"],
      ["M&A stays well ahead of goal.", "POSITIVE"],
      ["Churn beat budget for a second month running, still behind on the year.", "POSITIVE"],
      ["Cash CAC is over budget for a fourth month.", "NEGATIVE"],
    ]);
    expect(OCTOBER_2026_SUMMARY_SO_WHATS.map((bullet) => bullet.order)).toEqual([0, 1, 2, 3]);
  });

  it("keeps the exact supporting text, including the report's minus sign and figures", () => {
    expect(OCTOBER_2026_SUMMARY_SO_WHATS[0].body).toBe(
      "Shop NOI was $0.6M under budget, $0.5M of it the hurricane in NE and NW Florida. Support ran $0.5M over and BD $0.7M over, so Adj. EBITDA was −$1.2M against a +$0.6M budget. YTD is still $2.7M ahead.",
    );
    expect(OCTOBER_2026_SUMMARY_SO_WHATS[1].body).toContain("21 deals and $34.8M of acquired EBITDA closed, against a $23M goal.");
    expect(OCTOBER_2026_SUMMARY_SO_WHATS[2].body).toBe("12.2% annualized in October vs an 18.4% budget (149 units vs 211). YTD is 12.4% vs 11.5% budget; LTM holds at 13.0%.");
    expect(OCTOBER_2026_SUMMARY_SO_WHATS[3].body).toBe(
      "$7,306 in October, 45% over the $5,046 budget, driven by new owner guarantees and accelerator bonuses. Organic adds were 260, 4 under budget.",
    );
  });

  it("keeps the existing summary record's id for the first bullet", () => {
    expect(OCTOBER_2026_SUMMARY_SO_WHATS[0].id).toBe(OCTOBER_2026_SUPERSEDED_SUMMARY.id);
    expect(new Set(OCTOBER_2026_SUMMARY_SO_WHATS.map((bullet) => bullet.id)).size).toBe(4);
  });

  it("replaces the single stored summary with the four bullets, without deleting its record", () => {
    const plan = planSummarySoWhats([{ ...OCTOBER_2026_SUPERSEDED_SUMMARY, body: OCTOBER_2026_SUPERSEDED_SUMMARY.body }]);
    expect(plan.toUpdate.map((update) => update.before.id)).toEqual([OCTOBER_2026_SUPERSEDED_SUMMARY.id]);
    expect(plan.toCreate.map((bullet) => bullet.id)).toEqual([
      "user-review-sowhat-202610-summary-2",
      "user-review-sowhat-202610-summary-3",
      "user-review-sowhat-202610-summary-4",
    ]);
    expect(plan.drift).toEqual([]);
  });

  it("is a no-op once the four bullets are stored", () => {
    const current: StoredSummary[] = OCTOBER_2026_SUMMARY_SO_WHATS.map((bullet) => ({ ...bullet }));
    const plan = planSummarySoWhats(current);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.alreadyApplied).toBe(4);
  });

  it("refuses to replace a summary that was edited after the correction was written", () => {
    const plan = planSummarySoWhats([{ ...OCTOBER_2026_SUPERSEDED_SUMMARY, headline: "October: a mixed month", body: "Justin's own words." }]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.drift).toHaveLength(1);
  });

  it("reports an unexpected fifth summary row rather than hiding it", () => {
    const current: StoredSummary[] = [
      ...OCTOBER_2026_SUMMARY_SO_WHATS.map((bullet) => ({ ...bullet })),
      { id: "someone-elses-summary", order: 4, headline: "Extra", body: null, tone: null },
    ];
    const plan = planSummarySoWhats(current);
    expect(plan.drift.map((row) => row.id)).toEqual(["someone-elses-summary"]);
  });
});
