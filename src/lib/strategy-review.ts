import { prisma } from "@/lib/prisma";
import { getEbitdaBuild, getScorecardGoals } from "@/lib/overview-data";
import {
  FINANCE_ROWS,
  KPI_ROWS,
  REVIEW_ENABLERS,
  REVIEW_META,
  REVIEW_PILLARS,
  SUMMARY_TILES,
  type ReviewPillar,
  type ReviewSnapshot,
  type ReviewTone,
} from "@/lib/strategy-review-data";

const toneFromColor: Record<string, ReviewTone> = {
  green: "good",
  amber: "warn",
  red: "risk",
  grey: "neutral",
};

const statusTone: Record<string, ReviewTone> = {
  NOT_STARTED: "neutral",
  PLANNING: "warn",
  IN_PROGRESS: "good",
  AT_RISK: "risk",
  DONE: "good",
};

const scorecardMap = (rows: Awaited<ReturnType<typeof getScorecardGoals>>) =>
  new Map(rows.map((row) => [row.name.toLowerCase(), row]));

function scorecardValue(map: ReturnType<typeof scorecardMap>, name: string, fallback: string) {
  return map.get(name.toLowerCase())?.ltm || fallback;
}

function scorecardTarget(map: ReturnType<typeof scorecardMap>, name: string, fallback: string) {
  return map.get(name.toLowerCase())?.goal || fallback;
}

function scorecardTone(map: ReturnType<typeof scorecardMap>, name: string, fallback: ReviewTone): ReviewTone {
  const color = map.get(name.toLowerCase())?.color;
  return color ? toneFromColor[color] ?? fallback : fallback;
}

export async function getStrategyReviewSnapshot(): Promise<ReviewSnapshot> {
  const codes = REVIEW_PILLARS.flatMap((pillar) => pillar.initiatives.map((initiative) => initiative.code));
  const [ebitda, goals, initiatives] = await Promise.all([
    getEbitdaBuild(),
    getScorecardGoals(),
    prisma.initiative.findMany({
      where: { code: { in: codes } },
      select: {
        id: true,
        code: true,
        status: true,
        milestones: { orderBy: [{ dueAt: "asc" }, { order: "asc" }] },
        updates: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const scores = scorecardMap(goals);
  const liveByCode = new Map(initiatives.map((initiative) => [initiative.code, initiative]));
  const pillars: ReviewPillar[] = REVIEW_PILLARS.map((pillar) => {
    const scorecard = pillar.id === "units" ? "Gross Adds"
      : pillar.id === "retention" ? "Owner Churn %"
        : pillar.id === "trevpar" ? "TrevPAR vs PY"
          : pillar.id === "margin" ? "NOI Margin Impr vs PY (Excl OTA)"
            : null;
    const initiativesForPillar = pillar.initiatives.map((initiative) => {
      const live = liveByCode.get(initiative.code);
      const liveMilestones = live?.milestones.map((milestone) => {
        const date = milestone.dueAt ? milestone.dueAt.toISOString().slice(0, 10) : "TBD";
        return `${milestone.title} · ${date}`;
      }) ?? [];
      return {
        ...initiative,
        status: live ? statusTone[live.status] ?? initiative.status : initiative.status,
        milestones: liveMilestones.length > 0 ? liveMilestones : initiative.milestones,
        latestUpdate: live?.updates[0]?.update ?? undefined,
      };
    });

    return {
      ...pillar,
      actual: scorecard ? scorecardValue(scores, scorecard, pillar.actual) : pillar.actual,
      target: scorecard ? scorecardTarget(scores, scorecard, pillar.target) : pillar.target,
      status: scorecard ? scorecardTone(scores, scorecard, pillar.status) : pillar.status,
      initiatives: initiativesForPillar,
    };
  });

  const dynamicSummary = SUMMARY_TILES.map((tile) => [...tile] as [string, string, string, string]);
  const lenderIndex = dynamicSummary.findIndex(([label]) => label === "LTM PF lender EBITDA");
  if (lenderIndex >= 0) {
    dynamicSummary[lenderIndex] = [
      "LTM PF lender EBITDA",
      `$${ebitda.lender.toFixed(1)}M`,
      `${ebitda.asOf} · target $${ebitda.target2027.toFixed(1)}M`,
      "good",
    ];
  }

  return {
    meta: { ...REVIEW_META, asOf: `Data as of ${ebitda.asOf}` },
    pillars,
    enablers: REVIEW_ENABLERS,
    summaryTiles: dynamicSummary,
    financeRows: FINANCE_ROWS,
    kpiRows: KPI_ROWS,
    ebitdaTrend: ebitda.trend,
    initiativeLinks: initiatives.map(({ id, code }) => ({ id, code })),
  };
}
