import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  EBITDA_SETTING_KEY,
  PILLARS_SETTING_KEY,
  GOAL_COLORS,
  cimKpiMap,
  parseEbitdaBuild,
  parsePillars,
  type EbitdaBuild,
  type Goal,
  type GoalColor,
  type Pillar,
} from "@/lib/strategy-reference";

// Strategy reference data, read from the database (see strategy-reference.ts).
// The two Setting-backed blobs are read in ONE query and memoized per request
// (React cache()), so the getters share a round trip. Per-request only: edits
// on Admin > Strategy reference show up immediately.
const getReferenceSettings = cache(async (): Promise<Map<string, string>> => {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [EBITDA_SETTING_KEY, PILLARS_SETTING_KEY] } },
  });
  return new Map(rows.map((r) => [r.key, r.value]));
});

/** The EBITDA build to the exit target, or null until an admin enters one. */
export async function getEbitdaBuild(): Promise<EbitdaBuild | null> {
  return parseEbitdaBuild((await getReferenceSettings()).get(EBITDA_SETTING_KEY));
}

/** The 2026 cultural pillars (the bright future). */
export async function getPillars(): Promise<Pillar[]> {
  return parsePillars((await getReferenceSettings()).get(PILLARS_SETTING_KEY));
}

/** Financial & Operating Scorecard rows (ScorecardGoal), in display order. */
export async function getScorecardGoals(): Promise<Goal[]> {
  const rows = await prisma.scorecardGoal.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    name: r.name,
    goal: r.goal ?? "",
    ltm: r.ltm ?? "",
    ytdBud: r.ytdBud ?? "",
    status: r.status ?? "",
    color: GOAL_COLORS.includes(r.color as GoalColor) ? (r.color as GoalColor) : "grey",
    owner: r.owner ?? "",
    cim: r.cim,
    sis: r.sis,
    notes: r.notes ?? "",
  }));
}

/** CIM code → "KPI → target" labels for the initiative form. */
export async function getCimKpiMap(): Promise<Record<string, string[]>> {
  const goals = await prisma.scorecardGoal.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { name: true, goal: true, cim: true },
  });
  return cimKpiMap(goals.map((g) => ({ name: g.name, goal: g.goal ?? "", cim: g.cim })));
}
