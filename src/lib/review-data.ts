import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getActivePlan } from "@/lib/active-plan";
import { PUBLICATION_APPROVED } from "@/lib/kpi";
import { buildFinanceTable, currentKpiValue, type FinanceTable, type KpiRow } from "@/lib/review-kpi";
import {
  isoDay,
  periodLabel,
  periodMonthName,
  ragFor,
  reviewPeriods,
  shortCode,
  splitNames,
  synthesiseAreas,
  type ReviewArea,
  type ReviewSi,
  type SiReviewStatus,
} from "@/lib/review-model";

export type ReviewPlan = {
  id: string | null;
  code: string | null;
  title: string | null;
  sourceFileName: string | null;
  /** True when the plan has no StrategicArea rows and areas come from cimDriver. */
  synthesised: boolean;
  areas: ReviewArea[];
};

export type ReviewPeriod = {
  id: string;
  label: string;
  monthName: string;
  /** Newest observedAt among the period's KPI values, as an ISO day. */
  dataAsOf: string | null;
  sources: string[];
};

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
  sourceDocumentName: true,
} as const;

const currentObservationWhere = {
  publicationState: PUBLICATION_APPROVED,
  quality: { notIn: ["INVALID", "UNAVAILABLE"] },
};

/** Every period that has KPI data or SI updates, newest first. */
export const getReviewPeriodIds = cache(async (): Promise<string[]> => {
  const [kpi, updates] = await Promise.all([
    prisma.kpiObservation.findMany({ where: currentObservationWhere, select: { reportingPeriod: true }, distinct: ["reportingPeriod"] }),
    prisma.initiativeUpdate.findMany({ where: { reportingPeriod: { not: null } }, select: { reportingPeriod: true }, distinct: ["reportingPeriod"] }),
  ]);
  return reviewPeriods([...kpi.map((k) => k.reportingPeriod), ...updates.map((u) => u.reportingPeriod)]);
});

/** Period header: label, data-as-of and the source documents behind its figures. */
export const getReviewPeriod = cache(async (id: string): Promise<ReviewPeriod> => {
  const rows = await prisma.kpiObservation.findMany({
    where: { ...currentObservationWhere, reportingPeriod: id },
    select: { observedAt: true, sourceDocumentName: true },
  });
  const latest = rows.reduce<Date | null>((max, r) => (!max || r.observedAt > max ? r.observedAt : max), null);
  const sources = [...new Set(rows.map((r) => r.sourceDocumentName).filter((s): s is string => Boolean(s)))].sort();
  return { id, label: periodLabel(id), monthName: periodMonthName(id), dataAsOf: isoDay(latest), sources };
});

/**
 * The active plan, normalised for the review: areas (StrategicArea rows, or
 * synthesised from cimDriver when the plan has none) with their SIs, this
 * period's update, milestones, actions and ELT asks.
 */
export const getReviewPlan = cache(async (period: string): Promise<ReviewPlan> => {
  const plan = await getActivePlan();
  const planWhere = plan ? { planVersionId: plan.id } : {};
  const [version, areaRows, initiatives] = await Promise.all([
    plan ? prisma.planVersion.findUnique({ where: { id: plan.id }, select: { sourceFileName: true } }) : null,
    plan
      ? prisma.strategicArea.findMany({
          where: { planVersionId: plan.id },
          orderBy: [{ kind: "desc" }, { order: "asc" }],
          include: { kpis: { select: { id: true, name: true, target: true, observations: { where: currentObservationWhere, select: OBSERVATION_SELECT } } } },
        })
      : [],
    prisma.initiative.findMany({
      where: planWhere,
      orderBy: { code: "asc" },
      include: {
        updates: { orderBy: { createdAt: "desc" } },
        milestones: { orderBy: [{ dueAt: "asc" }, { order: "asc" }] },
        actionItems: { orderBy: [{ dueAt: "asc" }, { order: "asc" }] },
        eltRequests: { orderBy: { order: "asc" } },
      },
    }),
  ]);

  const synthesised = areaRows.length === 0;
  type AreaSeed = Omit<ReviewArea, "sis" | "number"> & { match: (i: (typeof initiatives)[number]) => boolean };
  const seeds: AreaSeed[] = synthesised
    ? synthesiseAreas(initiatives.map((i) => i.cimDriver)).map((a) => ({
        id: null,
        code: a.code,
        name: a.name,
        kind: a.kind,
        goal: null,
        ownerLine: null,
        measure: null,
        match: (i) => ((i.cimDriver && i.cimDriver.trim()) || "Other") === a.driver,
      }))
    : areaRows.map((a) => {
        const kpi = a.kpis[0];
        const obs = kpi ? currentKpiValue(kpi.observations as KpiRow[], period) : null;
        const target = kpi?.target ?? a.kpiTarget ?? null;
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          kind: a.kind === "ENABLER" ? "ENABLER" : "VALUE_DRIVER",
          goal: a.goal,
          ownerLine: a.owner,
          measure: kpi || a.kpiName ? { name: kpi?.name ?? a.kpiName ?? "", value: obs?.value ?? null, target, rag: ragFor(obs?.value ?? null, target, obs?.quality) } : null,
          match: (i) => i.strategicAreaId === a.id,
        };
      });

  let pillarNumber = 0;
  const areas: ReviewArea[] = seeds.map(({ match, ...seed }) => {
    const sis: ReviewSi[] = initiatives.filter(match).map((i) => {
      const update = i.updates.find((u) => u.reportingPeriod === period) ?? null;
      return {
        id: i.id,
        code: i.code,
        shortCode: shortCode(i.code),
        name: i.name,
        areaCode: seed.code,
        areaName: seed.name,
        lead: i.teamLead,
        sponsor: i.secondaryLead,
        ownerUserId: i.ownerUserId,
        what: i.problem,
        goingFor: [i.quantMetric, i.quantTarget].filter(Boolean).join(": ") || i.valueWhenComplete,
        status: (update?.reviewStatus as SiReviewStatus | null) ?? null,
        latestProgress: update?.update ?? null,
        whatNext: update?.pathForward ?? null,
        updatedThisPeriod: Boolean(update),
        updatedBy: update?.updatedBy ?? null,
        milestones: i.milestones.map((m) => ({
          id: m.id,
          siId: i.id,
          siCode: i.code,
          siName: i.name,
          areaCode: seed.code,
          title: m.title,
          owner: m.owner,
          date: isoDay(m.dueAt),
          done: Boolean(m.completedAt),
        })),
        actions: i.actionItems.map((a) => ({ id: a.id, siCode: i.code, kind: a.kind, title: a.title, owner: a.owner, date: isoDay(a.dueAt), done: a.status === "DONE" })),
        asks: i.eltRequests.map((r) => ({ id: r.id, siCode: i.code, request: r.request, kind: r.kind, status: r.status, raisedOn: isoDay(r.createdAt) ?? "" })),
      };
    });
    const ownerLine = seed.ownerLine ?? ([...new Set(sis.flatMap((s) => splitNames(s.lead)))].join(" / ") || null);
    return { ...seed, ownerLine, number: seed.kind === "VALUE_DRIVER" ? ++pillarNumber : null, sis };
  });

  return {
    id: plan?.id ?? null,
    code: plan?.code ?? null,
    title: plan?.title ?? null,
    sourceFileName: version?.sourceFileName ?? null,
    synthesised,
    areas,
  };
});

/** Financial table for the period, from approved, consolidated KPI values not tied to an area. */
export const getFinanceTable = cache(async (period: string): Promise<FinanceTable> => {
  const defs = await prisma.kpiDefinition.findMany({
    where: { strategicAreaId: null, observations: { some: { ...currentObservationWhere, reportingPeriod: period } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      metricKey: true,
      name: true,
      unit: true,
      displayFormat: true,
      observations: { where: { ...currentObservationWhere, reportingPeriod: period }, select: OBSERVATION_SELECT },
    },
  });
  return buildFinanceTable(defs, defs.flatMap((d) => d.observations as KpiRow[]), period);
});

export function allSis(plan: ReviewPlan): ReviewSi[] {
  return plan.areas.flatMap((a) => a.sis);
}

/** The requested period when it exists, otherwise the newest one. */
export async function resolvePeriod(requested?: string | null): Promise<{ id: string; periods: string[] }> {
  const periods = await getReviewPeriodIds();
  return { id: requested && periods.includes(requested) ? requested : periods[0], periods };
}
