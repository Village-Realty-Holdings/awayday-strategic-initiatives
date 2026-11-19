/**
 * The October 2026 review's own goal wording, for the two pillars whose stored
 * goal text cannot be read as the reviewed report reads it.
 *
 * Both changes are content corrections on a KpiDefinition's `target` text only.
 * Neither invents a figure: every number written here is already stated either
 * by the reviewed October report or by the FY27 plan record in the database.
 *
 *  * Grow holds no goal text at all, so the card shows no YTD budget and no FY27
 *    target. The reviewed report states both, and Justin approved this exact
 *    line. Its figures (2,608 / 3,152) are the BD 2026 Master's budgets; they are
 *    counts, so they can never be read as the FY27 22% / 30% growth plan.
 *  * M&A's text carries the FY27 planning total "$26M" with no year label, so a
 *    reader can take it for a second 2026 goal beside the real $23M goal. The
 *    correction states the reviewed FY27 budget (~$33M, about a third tuck-ins),
 *    labels it FY27, and separates the three figures so each parses as its own
 *    marker. The $26M itself is a superseded planning figure, not a 2026 goal.
 *
 * Deliberately NOT done here: the reviewed report also gives FY27 12% retention,
 * +1% TRevPAR and +0.25 pt margin, while the canonical FY27 PlanVersion /
 * StrategicArea records and the measure mappings still hold the earlier board
 * pack's figures ($26M M&A, 11%, 1%, 0.25) — the M&A mapping's own targetBudget
 * is $26M. Those are planning records outside the October report, so they are
 * reported for a decision rather than rewritten by this correction.
 */

export type GoalLine = {
  /** The definition's stable metric key. */
  metricKey: string;
  /** Its name, for the preview and the audit row. */
  name: string;
  /** The exact target text this correction expects to find. */
  from: string | null;
  /** The exact target text to store. */
  to: string;
  /** Why the reviewed report reads it this way. */
  reason: string;
};

export const OCTOBER_GOAL_LINES: readonly GoalLine[] = [
  {
    metricKey: "user_review:bd_unit_adds",
    name: "BD Unit Adds (BD Master)",
    from: null,
    to: "YTD budget 2,608 (+28%) · full-year budget 3,152 already passed · FY27 22% gross adds (30% stretch)",
    reason:
      "The reviewed report states Grow's YTD budget, its already-passed full-year budget and its FY27 growth plan in one line; the definition holds none of them. Budgets stay budgets, so the card plots 2,608 and 3,152 and never judges the count against a growth percentage.",
  },
  {
    metricKey: "FY27:M&A",
    name: "Acquired EBITDA closed",
    from: "2026 goal $23M · $26M total; $11M via tuck-ins; $47M stretch",
    to: "2026 goal $23M · FY27 ~$33M (1/3 tuck-ins) · $47M stretch",
    reason:
      "The reviewed report states $23M as the 2026 goal, ~$33M as the FY27 budget (about a third from tuck-ins) and $47M as the FY27 stretch, and Justin approved showing those figures. The stored text instead carries the superseded $26M planning total with no year, so it reads as a second 2026 goal. The middle figure is labelled FY27 and a middle-dot separator keeps the goal, budget and stretch as three markers.",
  },
];

export type GoalLinePlan = {
  changes: { line: GoalLine; id: string }[];
  /** Definitions whose current text is neither the expected text nor the new one. */
  drift: { line: GoalLine; state: "missing" | "already-applied" | "unexpected"; found: string | null }[];
};

/** Sorted, not applied: what the correction would write, and what it refuses to touch. */
export function planGoalLineChanges(
  rows: readonly { id: string; metricKey: string; name: string; target: string | null }[],
): GoalLinePlan {
  const changes: GoalLinePlan["changes"] = [];
  const drift: GoalLinePlan["drift"] = [];
  for (const line of OCTOBER_GOAL_LINES) {
    const row = rows.find((candidate) => candidate.metricKey === line.metricKey);
    if (!row) {
      drift.push({ line, state: "missing", found: null });
      continue;
    }
    if (row.target === line.to) {
      drift.push({ line, state: "already-applied", found: row.target });
      continue;
    }
    if (row.target !== line.from) {
      drift.push({ line, state: "unexpected", found: row.target });
      continue;
    }
    changes.push({ line, id: row.id });
  }
  return { changes, drift };
}

/** One line per change, for a dry run a person can read before approving. */
export function describeGoalLineChange(change: GoalLinePlan["changes"][number]): string {
  const { line } = change;
  return [
    `${line.name} (${line.metricKey}, ${change.id})`,
    `  from: ${line.from === null ? "(no target text)" : line.from}`,
    `    to: ${line.to}`,
    `  why:  ${line.reason}`,
  ].join("\n");
}
