import { cache } from "react";
import { PUBLICATION_APPROVED } from "@/lib/kpi";
import { prisma } from "@/lib/prisma";
import {
  buildBrandChurn,
  buildExecCards,
  buildPillarScorecard,
  buildReportRows,
  buildTrendChart,
  groupReportRows,
  orderByCatalogue,
  REVIEWED_METRIC_PREFIX,
  PILLAR_EXPECTATIONS,
  scopesIn,
  scopeLabel,
  BASE_BUSINESS_LINES,
  TREND_CHART_SPECS,
  type BrandChurn,
  type ExecCard,
  type PillarScorecard,
  type ReportMetric,
  type ReportObservation,
  type ReportTableRow,
  type TrendChart,
} from "@/lib/review-report";

// Server-side loading for the reviewed monthly report. The shaping rules live in
// review-report.ts so they can be tested without a database; this file only reads.

const OBSERVATION_SELECT = {
  kpiId: true,
  value: true,
  reportingPeriod: true,
  observedAt: true,
  refreshedAt: true,
  quality: true,
  publicationState: true,
  revision: true,
  reportingScope: true,
  comparisonBasis: true,
  timeBasis: true,
  entityScope: true,
  entityId: true,
  authorityRank: true,
} as const;

const CURRENT_WHERE = {
  publicationState: PUBLICATION_APPROVED,
  quality: { notIn: ["INVALID", "UNAVAILABLE"] },
};

/**
 * Only rows the reviewed-report ingestion published belong in these sections.
 * The same guard PR #23 used, so a hand-entered or differently-sourced value on
 * a reviewed definition cannot enter the Base Business or reported tables.
 */
const REVIEWED_SOURCE_CATEGORY = "USER_REVIEWED_REPORT";

/** Chart history is read for this many months, including the review month. */
const HISTORY_MONTHS = 24;

export function monthsBefore(period: string, months: number): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - months, 1));
  return date.toISOString().slice(0, 7);
}

export type ReportSection = {
  id: string;
  scopeLabel: string;
  /** Ordered P&L/table rows; empty for a population that only has grouped metrics. */
  rows: ReportTableRow[];
  groups: { id: string; label: string; rows: ReportTableRow[] }[];
  /** Base Business keeps the report's P&L line order; other populations use families. */
  kind: "base-business" | "operating";
};

export type ReviewedReport = {
  period: string;
  execCards: ExecCard[];
  sections: ReportSection[];
  /** Detailed scorecards keyed by StrategicArea.code. */
  scorecards: Record<string, PillarScorecard>;
  charts: TrendChart[];
  brandChurn: BrandChurn;
  counts: {
    /** Reviewed definitions that have a value in this month. */
    metricsWithValues: number;
    /** Reviewed definitions that are not linked to any pillar or enabler. */
    unlinkedMetrics: number;
    /** Distinct populations present in the month's reviewed rows. */
    populations: number;
  };
};

/**
 * Everything the reviewed report adds to the Strategy Review: headline cards,
 * the population-specific tables, pillar scorecards, historical series and the
 * brand churn table. Two bounded queries: the month's definitions with their
 * observations, and the chart families' history.
 */
export const getReviewedReport = cache(async (period: string): Promise<ReviewedReport> => {
  const [defs, history] = await Promise.all([
    prisma.kpiDefinition.findMany({
      where: { metricKey: { startsWith: REVIEWED_METRIC_PREFIX } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        metricKey: true,
        name: true,
        unit: true,
        displayFormat: true,
        target: true,
        strategicAreaId: true,
        strategicArea: { select: { code: true, name: true } },
        observations: {
          where: { ...CURRENT_WHERE, reportingPeriod: period, sourceCategory: REVIEWED_SOURCE_CATEGORY },
          select: OBSERVATION_SELECT,
        },
      },
    }),
    // Only the two chart families, for a fixed window: no unbounded read.
    prisma.kpiObservation.findMany({
      where: {
        ...CURRENT_WHERE,
        reportingPeriod: { gte: monthsBefore(period, HISTORY_MONTHS), lte: period },
        sourceCategory: REVIEWED_SOURCE_CATEGORY,
        kpi: { metricKey: { startsWith: REVIEWED_METRIC_PREFIX } },
        OR: [
          { kpi: { name: { contains: "ebitda", mode: "insensitive" } } },
          { kpi: { name: { contains: "trevpar", mode: "insensitive" } } },
        ],
      },
      orderBy: { reportingPeriod: "asc" },
      take: 2000,
      select: OBSERVATION_SELECT,
    }),
  ]);

  const metrics: ReportMetric[] = defs.map((def) => ({
    id: def.id,
    metricKey: def.metricKey,
    name: def.name,
    unit: def.unit,
    displayFormat: def.displayFormat,
    target: def.target,
    strategicAreaId: def.strategicAreaId,
    areaCode: def.strategicArea?.code ?? null,
  }));

  const periodRows: ReportObservation[] = defs.flatMap((def) => def.observations.map((observation) => ({ ...observation, kpiId: def.id })));
  const historyRows: ReportObservation[] = history;

  // One section per population actually present. Base Business is a P&L; every
  // other reviewed population is a set of operating metric families. They are
  // never merged into a single table or metric identity.
  const sections: ReportSection[] = scopesIn(periodRows)
    .map((scope): ReportSection | null => {
      const rows = buildReportRows(metrics, periodRows.filter((row) => row.reportingScope === scope.reportingScope && (row.entityScope ?? "") === scope.entityScope && (row.entityId ?? null) === null));
      if (rows.length === 0) return null;
      if (scope.reportingScope === "BASE_BUSINESS") {
        return { id: "base-business", scopeLabel: scopeLabel(scope), rows: orderByCatalogue(rows, BASE_BUSINESS_LINES), groups: [], kind: "base-business" as const };
      }
      return { id: `reported-${scope.reportingScope.toLowerCase()}-${scope.entityScope.toLowerCase()}`, scopeLabel: scopeLabel(scope), rows, groups: groupReportRows(rows), kind: "operating" as const };
    })
    .filter((section): section is ReportSection => section !== null);

  const areaSeeds = new Map<string, { id: string; code: string; name: string }>();
  for (const def of defs) {
    if (def.strategicAreaId && def.strategicArea) {
      areaSeeds.set(def.strategicArea.code, { id: def.strategicAreaId, code: def.strategicArea.code, name: def.strategicArea.name });
    }
  }
  const scorecards: Record<string, PillarScorecard> = {};
  for (const area of areaSeeds.values()) {
    scorecards[area.code] = buildPillarScorecard(area, metrics, periodRows, period);
  }
  // Reviewed metrics that are not linked to a pillar yet still fill the scorecard
  // their documented identity belongs to, so the depth is there before curation.
  for (const code of Object.keys(PILLAR_EXPECTATIONS)) {
    if (scorecards[code]) continue;
    const scorecard = buildPillarScorecard({ id: null, code, name: code }, metrics, periodRows, period);
    if (scorecard.loaded > 0) scorecards[code] = scorecard;
  }

  const execCards = buildExecCards(metrics, periodRows, period);
  // A chart may not reuse a headline's exact identity: the reviewed history and the
  // headline are different facts even when they share a definition.
  const headlineIdentities = new Set(
    execCards.filter((card) => card.metricId).map((card) => `${card.metricId}\u0000${card.timeBasis ?? ""}`),
  );

  return {
    period,
    execCards,
    sections,
    scorecards,
    charts: TREND_CHART_SPECS.map((spec) =>
      buildTrendChart(spec, metrics, [...historyRows, ...periodRows], { headlineIdentities }),
    ),
    brandChurn: buildBrandChurn(metrics, periodRows, period),
    counts: {
      metricsWithValues: defs.filter((def) => def.observations.length > 0).length,
      unlinkedMetrics: metrics.filter((metric) => !metric.strategicAreaId).length,
      populations: scopesIn(periodRows).length,
    },
  };
});
