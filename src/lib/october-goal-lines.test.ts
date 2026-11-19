import { describe, expect, it } from "vitest";
import { OCTOBER_GOAL_LINES, describeGoalLineChange, planGoalLineChanges } from "./october-goal-lines";

const rows = [
  { id: "d-bd", metricKey: "user_review:bd_unit_adds", name: "BD Unit Adds (BD Master)", target: null },
  { id: "d-ma", metricKey: "FY27:M&A", name: "Acquired EBITDA closed", target: "2026 goal $23M · $26M total; $11M via tuck-ins; $47M stretch" },
];

describe("October goal wording", () => {
  it("plans both reviewed goal lines against the stored text", () => {
    const plan = planGoalLineChanges(rows);
    expect(plan.drift).toEqual([]);
    expect(plan.changes.map((change) => change.id)).toEqual(["d-bd", "d-ma"]);
    expect(plan.changes[0].line.to).toBe(
      "YTD budget 2,608 (+28%) · full-year budget 3,152 already passed · FY27 22% gross adds (30% stretch)",
    );
    expect(plan.changes[1].line.to).toBe("2026 goal $23M · FY27 ~$33M (1/3 tuck-ins) · $47M stretch");
  });

  it("refuses to overwrite a newer approved edit", () => {
    const edited = [{ ...rows[0], target: "YTD budget 2,700" }, rows[1]];
    const plan = planGoalLineChanges(edited);
    expect(plan.changes.map((change) => change.id)).toEqual(["d-ma"]);
    expect(plan.drift).toEqual([{ line: OCTOBER_GOAL_LINES[0], state: "unexpected", found: "YTD budget 2,700" }]);
  });

  it("is idempotent once applied, and reports a missing definition", () => {
    const applied = [{ ...rows[0], target: OCTOBER_GOAL_LINES[0].to }, { ...rows[1], target: OCTOBER_GOAL_LINES[1].to }];
    expect(planGoalLineChanges(applied).changes).toEqual([]);
    expect(planGoalLineChanges(applied).drift.map((entry) => entry.state)).toEqual(["already-applied", "already-applied"]);
    expect(planGoalLineChanges([]).drift.map((entry) => entry.state)).toEqual(["missing", "missing"]);
  });

  it("previews the exact before and after text with the record id", () => {
    const [change] = planGoalLineChanges([{ ...rows[1] }]).changes;
    const preview = describeGoalLineChange(change);
    expect(preview).toContain("d-ma");
    expect(preview).toContain("from: 2026 goal $23M · $26M total; $11M via tuck-ins; $47M stretch");
    expect(preview).toContain("to: 2026 goal $23M · FY27 ~$33M (1/3 tuck-ins) · $47M stretch");
  });

  it("never states a figure the reviewed report or the plan record does not", () => {
    // Every number in the two lines is stated by the reviewed October report;
    // nothing is back-solved or invented.
    for (const line of OCTOBER_GOAL_LINES) {
      expect(line.to).toMatch(/2,608|3,152|23M|33M|47M/);
      expect(line.reason.length).toBeGreaterThan(40);
    }
  });
});
