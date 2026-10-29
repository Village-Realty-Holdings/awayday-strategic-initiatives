import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getActivePlan } from "@/lib/active-plan";
import { PUBLICATION_APPROVED } from "@/lib/kpi";
import { buildFinanceTable, currentKpiValue, MANUAL_SOURCE_CATEGORY, type FinanceTable, type KpiRow } from "@/lib/review-kpi";
import {
  homeReviewPeriod,
  isoDay,
  openUpdatePeriod,
  periodLabel,
  periodMonthName,
  ragFor,
  reviewPeriods,
  shortCode,
  splitNames,
  synthesiseAreas,
  SUMMARY_SCOPE,
  type ReviewArea,
  type ReviewPeriodStatus,
  type ReviewSi,
  type SiReviewStatus,
  type SoWhat,
} from "@/lib/review-model";

export type ReviewPlan = {
  id: string | null;
  code: string | null;
  title: string | null;
  sourceFileName: string | null;
  /** Strategy-house roof, edited on Admin > Plan versions. */
  mission: string | null;
  goal: string | null;
  values: string[];
  /** True when the plan has no StrategicArea rows and areas come from cimDriver. */
  synthesised: boolean;
  areas: ReviewArea[];
};

export type ReviewPeriod = {
  id: string;
  label: string;
  monthName: string;
  /** True when Strategy has saved this month (a ReviewPeriod row exists). */
  stored: boolean;
  /** DRAFT until Strategy publishes; a month with no row is a draft. */
  status: ReviewPeriodStatus;
  preparedBy: string | null;
  meetingDate: string | null;
  updatesDueDate: string | null;
  /** The stored override, else the newest observedAt among the period's KPI values (ISO days). */
  dataAsOf: string | null;
  /** Newest observedAt among the period's KPI values, ignoring the override. */
  observedAsOf: string | null;
  /** The data-as-of Strategy typed in, if any. */
  dataAsOfOverride: string | null;
  sources: string[];
  /** The summary so-whats, in order. */
  summary: SoWhat[];
  /** So-whats per StrategicArea code, in order. */
  areaSoWhats: Record<string, SoWhat[]>;
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
  sourceCategory: true,
} as const;

const currentObservationWhere = {
  publicationState: PUBLICATION_APPROVED,
  quality: { notIn: ["INVALID", "UNAVAILABLE"] },
};

/** Every review period, newest first, and which of them are published. */
export const getReviewPeriodIndex = cache(async (): Promise<{ periods: string[]; published: string[] }> => {
  const [kpi, updates, stored] = await Promise.all([
    prisma.kpiObservation.findMany({ where: currentObservationWhere, select: { reportingPeriod: true }, distinct: ["reportingPeriod"] }),
    prisma.initiativeUpdate.findMany({ where: { reportingPeriod: { not: null } }, select: { reportingPeriod: true }, distinct: ["reportingPeriod"] }),
    prisma.reviewPeriod.findMany({ select: { id: true, status: true } }),
  ]);
  const periods = reviewPeriods([...kpi.map((k) => k.reportingPeriod), ...updates.map((u) => u.reportingPeriod), ...stored.map((p) => p.id)]);
  return { periods, published: stored.filter((p) => p.status === "PUBLISHED").map((p) => p.id) };
});

/** Every period that has KPI data, SI updates or a stored review, newest first. */
/** Period header (label, status, prepared by, dates, sources) and its so-whats. */
export const getReviewPeriod = cache(async (id: string): Promise<ReviewPeriod> => {
  const [rows, stored] = await Promise.all([
    // Values typed in on the review don't move "data as of": that dates the loaded figures.
    prisma.kpiObservation.findMany({
      where: { ...currentObservationWhere, reportingPeriod: id, OR: [{ sourceCategory: null }, { sourceCategory: { not: MANUAL_SOURCE_CATEGORY } }] },
      select: { observedAt: true, sourceDocumentName: true },
    }),
    prisma.reviewPeriod.findUnique({
      where: { id },
      include: { soWhats: { orderBy: [{ scope: "asc" }, { order: "asc" }], select: { id: true, scope: true, headline: true, body: true } } },
    }),
  ]);
  const latest = rows.reduce<Date | null>((max, r) => (!max || r.observedAt > max ? r.observedAt : max), null);
  const sources = [...new Set(rows.map((r) => r.sourceDocumentName).filter((s): s is string => Boolean(s)))].sort();
  const summary: SoWhat[] = [];
  const areaSoWhats: Record<string, SoWhat[]> = {};
  for (const { scope, ...soWhat } of stored?.soWhats ?? []) {
    if (scope === SUMMARY_SCOPE) summary.push(soWhat);
    else (areaSoWhats[scope] ??= []).push(soWhat);
  }
  return {
    id,
    label: periodLabel(id),
    monthName: periodMonthName(id),
    stored: Boolean(stored),
    status: stored?.status ?? "DRAFT",
    preparedBy: stored?.preparedBy ?? null,
    meetingDate: isoDay(stored?.meetingDate),
    updatesDueDate: isoDay(stored?.updatesDueDate),
    dataAsOf: isoDay(stored?.dataAsOf) ?? isoDay(latest),
    observedAsOf: isoDay(latest),
    dataAsOfOverride: isoDay(stored?.dataAsOf),
    sources,
    summary,
    areaSoWhats,
  };
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
    plan ? prisma.planVersion.findUnique({ where: { id: plan.id }, select: { sourceFileName: true, mission: true, goal: true, values: true } }) : null,
    plan
      ? prisma.strategicArea.findMany({
          where: { planVersionId: plan.id },
          orderBy: [{ kind: "desc" }, { order: "asc" }],
          // Ordered so "the area's measure" is the same KPI here and in Edit Mode's save.
          include: { kpis: { orderBy: { name: "asc" }, select: { id: true, name: true, target: true, observations: { where: currentObservationWhere, select: OBSERVATION_SELECT } } } },
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
        owner: null,
        ownerLine: null,
        measure: null,
        match: (i) => ((i.cimDriver && i.cimDriver.trim()) || "Other") === a.driver,
      }))
    : areaRows.map((a) => {
        const kpi = a.kpis[0];
        const obs = kpi ? currentKpiValue(kpi.observations as KpiRow[], period) : null;
        const source = obs ? (obs.sourceCategory === MANUAL_SOURCE_CATEGORY ? "manual" : "import") : null;
        const target = kpi?.target ?? a.kpiTarget ?? null;
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          kind: a.kind === "ENABLER" ? "ENABLER" : "VALUE_DRIVER",
          goal: a.goal,
          owner: a.owner,
          ownerLine: a.owner,
          measure: kpi || a.kpiName
            ? { kpiId: kpi?.id ?? null, name: kpi?.name ?? a.kpiName ?? "", value: obs?.value ?? null, target, rag: ragFor(obs?.value ?? null, target, obs?.quality), source }
            : null,
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
        objective: i.valueWhenComplete,
        kpi: [i.quantMetric, i.quantTarget].filter(Boolean).join(": ") || null,
        goingFor: [i.quantMetric, i.quantTarget].filter(Boolean).join(": ") || i.valueWhenComplete,
        initiativeStatus: i.status,
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
    mission: version?.mission ?? null,
    goal: version?.goal ?? null,
    values: version?.values ?? [],
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

/**
 * The requested period when it exists, otherwise the default: for the review
 * (`/` and the pages beside it) the newest published month, for SI updates
 * (My SIs) the newest month still open. `home` is that default, which the
 * period switchers link to without a period.
 */
export async function resolvePeriod(
  requested?: string | null,
  fallback: "review" | "updates" = "review",
): Promise<{ id: string; periods: string[]; home: string; published: string[] }> {
  const { periods, published } = await getReviewPeriodIndex();
  const home = fallback === "updates" ? openUpdatePeriod(periods, published) : homeReviewPeriod(periods, published);
  return { id: requested && periods.includes(requested) ? requested : home, periods, home, published };
}
