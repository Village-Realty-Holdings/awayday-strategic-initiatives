import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { EBITDA_BUILD, GOALS_2026, PILLARS_2026, Q2_BOARD, type Goal, type GoalColor, type Pillar, type BoardItem } from "@/lib/sources";

export type EbitdaBuild = typeof EBITDA_BUILD;

const KEY = "ebitda_build";

// The Overview pulls three Setting-backed blobs (EBITDA build, Q2 board, pillars).
// Read them in ONE query and memoize per request (React cache()) so the three
// getters share a single round trip instead of issuing a findUnique each (#4).
// Per-request only — no cross-request caching (keeps edits immediately visible).
const getOverviewSettings = cache(async (): Promise<Map<string, string>> => {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [KEY, "q2_board", "pillars_2026"] } },
  });
  return new Map(rows.map((r) => [r.key, r.value]));
});

const round1 = (n: number) => Math.round(n * 10) / 10;

// The build bridge is the single source of truth. The subtotal row ("LTM PF
// Valuation EBITDA") is the running sum of the component rows before it; the
// total row ("LTM PF Lender EBITDA") is the sum of all component rows. The
// headline `valuation` and `lender` are derived from those rows so the headline
// can never drift from the build that produces it.
export function normalizeEbitda(b: EbitdaBuild): EbitdaBuild {
  let acc = 0;
  const bridge = b.bridge.map((row) => {
    if (row.subtotal) return { ...row, value: round1(acc) };
    if (row.total) return { ...row, value: round1(acc) };
    acc = round1(acc + row.value);
    return { ...row };
  });
  const sub = bridge.find((r) => r.subtotal);
  const tot = bridge.find((r) => r.total);
  return {
    ...b,
    bridge,
    valuation: sub ? sub.value : b.valuation,
    lender: tot ? tot.value : b.lender,
  };
}

// Returns the EBITDA scoreboard from the DB if an admin has edited it, otherwise the
// hardcoded board-deck defaults. Anything missing in the saved JSON falls back to
// default, then the headline is reconciled to the build bridge.
export async function getEbitdaBuild(): Promise<EbitdaBuild> {
  const value = (await getOverviewSettings()).get(KEY);
  if (!value) return normalizeEbitda(EBITDA_BUILD);
  try {
    const parsed = JSON.parse(value) as Partial<EbitdaBuild>;
    return normalizeEbitda({ ...EBITDA_BUILD, ...parsed });
  } catch {
    return normalizeEbitda(EBITDA_BUILD);
  }
}

export const EBITDA_SETTING_KEY = KEY;

// Financial & Operating Scorecard rows. Editable in-app (ScorecardGoal table);
// falls back to the hardcoded GOALS_2026 until the table is seeded.
export async function getScorecardGoals(): Promise<Goal[]> {
  const rows = await prisma.scorecardGoal.findMany({ orderBy: { order: "asc" } });
  if (rows.length === 0) return GOALS_2026;
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    name: r.name,
    goal: r.goal ?? "",
    ltm: r.ltm ?? "",
    ytdBud: r.ytdBud ?? "",
    status: r.status ?? "",
    color: (r.color as GoalColor) ?? "grey",
    owner: r.owner ?? "",
    cim: r.cim,
    sis: r.sis,
    notes: r.notes ?? "",
  }));
}

export const Q2_SETTING_KEY = "q2_board";

// Q2 2026 board initiatives. Editable in-app (Setting JSON blob); falls back to
// the hardcoded Q2_BOARD until an editor saves.
export async function getQ2Board(): Promise<BoardItem[]> {
  const value = (await getOverviewSettings()).get(Q2_SETTING_KEY);
  if (!value) return Q2_BOARD;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as BoardItem[];
    return Q2_BOARD;
  } catch {
    return Q2_BOARD;
  }
}

export const PILLARS_SETTING_KEY = "pillars_2026";

// 2026 cultural pillars (the bright future). Editable in-app (stored as a Setting
// JSON blob); falls back to the hardcoded PILLARS_2026 until an editor saves.
export async function getPillars(): Promise<Pillar[]> {
  const value = (await getOverviewSettings()).get(PILLARS_SETTING_KEY);
  if (!value) return PILLARS_2026;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Pillar[];
    return PILLARS_2026;
  } catch {
    return PILLARS_2026;
  }
}
