// The strategy-house roof (mission, EBITDA goal, values) per plan version.
// Not stored in the database yet (see docs/review-data-gaps.md), so it lives
// here, keyed by PlanVersion.code. Unknown plans show the mission and values only.

export type PlanHeader = { mission: string; goal: string | null; values: string[] };

const MISSION = "To Perfect the Vacation Rental Experience";
const VALUES = ["Servant Leadership", "Ownership Mentality", "Local", "Excellence"];

const HEADERS: Record<string, PlanHeader> = {
  // 260930 Awayday SI Refresh v1
  FY27: { mission: MISSION, goal: "$300M EBITDA by 12/31/28 · FY27 budget $180M, BHAG $200M", values: VALUES },
  // 4/10/26 board deck
  FY26: { mission: MISSION, goal: "$150M EBITDA by 12/31/27 · Guest CSAT > 4.65", values: VALUES },
};

export function planHeader(code: string | null): PlanHeader {
  return (code && HEADERS[code]) || { mission: MISSION, goal: null, values: VALUES };
}
