import { VALUE_CREATION } from "@/lib/sources";

// The strategy-house roof (mission, EBITDA goal, values) per plan version.
// Not stored in the database yet (see docs/review-data-gaps.md), so it lives
// here, keyed by PlanVersion.code. Unknown plans show the mission and values only.

export type PlanHeader = { mission: string; goal: string | null; values: string[] };

const VALUES = ["Servant Leadership", "Ownership Mentality", "Local", "Excellence"];

const HEADERS: Record<string, PlanHeader> = {
  // 260930 Awayday SI Refresh v1
  FY27: { mission: VALUE_CREATION.mission, goal: "$300M EBITDA by 12/31/28 · FY27 budget $180M, BHAG $200M", values: VALUES },
  // 4/10/26 board deck
  FY26: { mission: VALUE_CREATION.mission, goal: VALUE_CREATION.objective, values: VALUES },
};

export function planHeader(code: string | null): PlanHeader {
  return (code && HEADERS[code]) || { mission: VALUE_CREATION.mission, goal: null, values: VALUES };
}
