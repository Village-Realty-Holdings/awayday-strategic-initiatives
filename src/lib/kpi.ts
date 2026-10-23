import { prisma } from "@/lib/prisma";

export type KpiSource = "SNOWFLAKE" | "SHAREPOINT_EXCEL" | "MANUAL";

export type KpiQuality = "VALID" | "STALE" | "UNAVAILABLE" | "INVALID";

/**
 * The only reporting perimeter ADI publishes. A value is only meaningful
 * together with the perimeter it covers, so callers that name a scope get
 * consolidated figures or nothing — never a regional/shop row by accident.
 */
export const CONSOLIDATED_REPORTING_SCOPE = "AWAYDAY_CONSOLIDATED";

/** APPROVED rows are current facts; SUPERSEDED rows are retained history only. */
export const PUBLICATION_APPROVED = "APPROVED";
export const PUBLICATION_SUPERSEDED = "SUPERSEDED";

/**
 * Qualities that can never describe a current value. `STALE` is allowed: it is
 * a real, approved observation that is merely late.
 */
const NON_CURRENT_QUALITIES: readonly string[] = ["INVALID", "UNAVAILABLE"];

export type ResolvedKpi = {
  metricKey: string;
  name: string;
  value: string | null;
  reportingPeriod: string | null;
  source: KpiSource | "UNAVAILABLE";
  quality: KpiQuality;
  refreshedAt: Date | null;
  target: string | null;
  overrideActive: boolean;
  // Which logical fact (identity) the value belongs to. Optional so existing
  // object literals keep compiling; always populated by the resolver.
  reportingScope?: string | null;
  comparisonBasis?: string | null;
  timeBasis?: string | null;
  revision?: number | null;
  observedAt?: Date | null;
};

/**
 * Optional narrowing for a resolve call. Every field is a filter; omitted
 * fields do not constrain. Omitted `reportingPeriod` resolves the newest
 * period that has an approved value (see `selectCurrentObservations`).
 */
export type KpiObservationFilter = {
  reportingScope?: string | null;
  comparisonBasis?: string | null;
  timeBasis?: string | null;
  reportingPeriod?: string | null;
};

/** The row shape the pure selector needs (a structural subset of KpiObservation). */
export type KpiObservationRecord = {
  value: string;
  reportingPeriod: string;
  observedAt: Date;
  refreshedAt?: Date | null;
  quality: string;
  publicationState?: string | null;
  revision?: number | null;
  reportingScope?: string | null;
  comparisonBasis?: string | null;
  timeBasis?: string | null;
  authorityRank?: number | null;
};

type KpiDefinitionRecord = {
  id: string;
  metricKey: string;
  name: string;
  target: string | null;
  sourceType: string | null;
};

type KpiOverrideRecord = {
  value: string;
  reportingPeriod: string;
  createdAt: Date;
};

/**
 * A metric can legitimately hold several current values at once — a monthly
 * actual, a YTD actual and an LTM figure for the same period are different
 * facts, not revisions of one another. Each identity is reported separately.
 */
export type ResolvedKpiSeries = {
  metricKey: string;
  name: string;
  target: string | null;
  /** The active manual override, if any. An override beats every observation. */
  override: ResolvedKpi | null;
  /** One entry per identity, strongest first (see `compareIdentities`). */
  values: ResolvedKpi[];
};

// ---------------------------------------------------------------------------
// Pure selection helpers
// ---------------------------------------------------------------------------

/**
 * Is this row allowed to represent a *current* value?
 *
 * - publicationState must be APPROVED, or NULL for rows written before the
 *   consolidated-ingestion migration; SUPERSEDED (or anything unexpected) is history.
 * - quality INVALID / UNAVAILABLE is never current.
 * - when a reporting scope is supplied, only AWAYDAY_CONSOLIDATED rows qualify:
 *   legacy rows with no scope are out-of-perimeter and must not be presented.
 * - explicit basis / period filters must match exactly.
 */
export function isCurrentObservation(
  observation: KpiObservationRecord,
  filter: KpiObservationFilter = {},
): boolean {
  const state = observation.publicationState ?? null;
  if (state !== null && state !== PUBLICATION_APPROVED) return false;

  if (NON_CURRENT_QUALITIES.includes(observation.quality)) return false;

  if (filter.reportingScope != null) {
    if (filter.reportingScope !== CONSOLIDATED_REPORTING_SCOPE) return false;
    if (observation.reportingScope !== CONSOLIDATED_REPORTING_SCOPE) return false;
  }
  if (filter.comparisonBasis != null && (observation.comparisonBasis ?? null) !== filter.comparisonBasis) return false;
  if (filter.timeBasis != null && (observation.timeBasis ?? null) !== filter.timeBasis) return false;
  if (filter.reportingPeriod != null && observation.reportingPeriod !== filter.reportingPeriod) return false;

  return true;
}

/**
 * Logical identity of an observation. Two values with the same identity are
 * revisions of one fact; two values that differ here coexist and must never
 * overwrite each other.
 */
export function observationIdentity(observation: {
  reportingPeriod: string;
  comparisonBasis?: string | null;
  timeBasis?: string | null;
  reportingScope?: string | null;
}): string {
  return [
    observation.reportingPeriod,
    observation.comparisonBasis ?? "",
    observation.timeBasis ?? "",
    observation.reportingScope ?? "",
  ].join("\u0000");
}

/** Compare period labels naturally, so FY27-P10 sorts after FY27-P09. */
export function comparePeriods(a: string, b: string): number {
  const chunks = (value: string) => value.match(/\d+|\D+/g) ?? [value];
  const left = chunks(a);
  const right = chunks(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = left[i];
    const y = right[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xNumeric = /^\d+$/.test(x);
    const yNumeric = /^\d+$/.test(y);
    if (xNumeric && yNumeric) {
      const delta = Number(x) - Number(y);
      if (delta !== 0) return delta;
      continue;
    }
    const xText = x.toLowerCase();
    const yText = y.toLowerCase();
    if (xText !== yText) return xText < yText ? -1 : 1;
  }
  return 0;
}

/**
 * Which approved row owns an identity when a publisher re-runs. Mirrors the
 * partial unique index in the migration: strongest authority first, then the
 * most recently observed / refreshed value.
 */
export function compareObservations(a: KpiObservationRecord, b: KpiObservationRecord): number {
  const rankDelta =
    (a.authorityRank ?? Number.POSITIVE_INFINITY) - (b.authorityRank ?? Number.POSITIVE_INFINITY);
  if (rankDelta !== 0) return rankDelta;

  const observedDelta = b.observedAt.getTime() - a.observedAt.getTime();
  if (observedDelta !== 0) return observedDelta;

  const refreshedDelta =
    (b.refreshedAt?.getTime() ?? 0) - (a.refreshedAt?.getTime() ?? 0);
  if (refreshedDelta !== 0) return refreshedDelta;

  return (b.revision ?? 0) - (a.revision ?? 0);
}

/**
 * Default preference between identities that coexist in the same period.
 * Explicitly passed comparisonBasis / timeBasis always wins; this order only
 * decides which one a caller that asked for "the" current value receives.
 */
const COMPARISON_BASIS_PRECEDENCE = ["ACTUAL", "PRIOR_YEAR", "BUDGET", "FORECAST", "VARIANCE", "LTM"];
const TIME_BASIS_PRECEDENCE = ["MONTHLY", "YTD", "POINT_IN_TIME", "LTM"];

function comparisonBasisRank(value: string | null | undefined): number {
  // Rows written before basis tracking carry no basis; they are actuals.
  if (!value) return 0;
  const index = COMPARISON_BASIS_PRECEDENCE.indexOf(value.toUpperCase());
  return index === -1 ? COMPARISON_BASIS_PRECEDENCE.length : index;
}

function timeBasisRank(value: string | null | undefined): number {
  if (!value) return TIME_BASIS_PRECEDENCE.length;
  const index = TIME_BASIS_PRECEDENCE.indexOf(value.toUpperCase());
  return index === -1 ? TIME_BASIS_PRECEDENCE.length : index;
}

function scopeRank(value: string | null | undefined): number {
  return value === CONSOLIDATED_REPORTING_SCOPE ? 0 : 1;
}

export function compareIdentities(a: KpiObservationRecord, b: KpiObservationRecord): number {
  return (
    comparisonBasisRank(a.comparisonBasis) - comparisonBasisRank(b.comparisonBasis) ||
    timeBasisRank(a.timeBasis) - timeBasisRank(b.timeBasis) ||
    scopeRank(a.reportingScope) - scopeRank(b.reportingScope) ||
    compareObservations(a, b)
  );
}

/**
 * The current, approved value of every identity in the newest period that has
 * one. Superseded / invalid rows are dropped; when several rows claim the same
 * identity the strongest one wins. Historical periods are reached by passing
 * `filter.reportingPeriod` — nothing here is limited to the newest period for
 * an explicit request.
 */
export function selectCurrentObservations(
  observations: readonly KpiObservationRecord[],
  filter: KpiObservationFilter = {},
): KpiObservationRecord[] {
  const eligible = observations.filter((observation) => isCurrentObservation(observation, filter));
  if (eligible.length === 0) return [];

  let candidates = eligible;
  if (filter.reportingPeriod == null) {
    const latestPeriod = eligible
      .map((observation) => observation.reportingPeriod)
      .reduce((latest, period) => (comparePeriods(period, latest) > 0 ? period : latest));
    candidates = eligible.filter((observation) => observation.reportingPeriod === latestPeriod);
  }

  const winners = new Map<string, KpiObservationRecord>();
  for (const observation of candidates) {
    const identity = observationIdentity(observation);
    const existing = winners.get(identity);
    if (!existing || compareObservations(observation, existing) < 0) {
      winners.set(identity, observation);
    }
  }

  return [...winners.values()].sort(compareIdentities);
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

/**
 * Push the "can this row be current" rules into the query as well as enforcing
 * them in memory: a resolver must not depend on the database returning only
 * approved rows, and a mock/test double must not be able to sneak one in.
 */
function buildObservationWhere(kpiId: string, filter: KpiObservationFilter) {
  return {
    kpiId,
    // `publicationState` is NOT NULL DEFAULT 'APPROVED' since the consolidated-ingestion
    // migration, so "legacy NULL rows" cannot exist — and a null filter on a non-nullable
    // column is rejected by the generated client ("Argument `publicationState` is missing"),
    // which made *every* resolve call throw instead of returning the approved row.
    publicationState: PUBLICATION_APPROVED,
    quality: { notIn: [...NON_CURRENT_QUALITIES] },
    ...(filter.reportingScope != null ? { reportingScope: CONSOLIDATED_REPORTING_SCOPE } : {}),
    ...(filter.comparisonBasis != null ? { comparisonBasis: filter.comparisonBasis } : {}),
    ...(filter.timeBasis != null ? { timeBasis: filter.timeBasis } : {}),
    ...(filter.reportingPeriod != null ? { reportingPeriod: filter.reportingPeriod } : {}),
  };
}

async function loadEligibleObservations(
  kpiId: string,
  filter: KpiObservationFilter,
): Promise<KpiObservationRecord[]> {
  // Asking for a perimeter ADI does not publish is not a reason to fall back to
  // another perimeter: there is no current value for it.
  if (filter.reportingScope != null && filter.reportingScope !== CONSOLIDATED_REPORTING_SCOPE) return [];

  const rows = await prisma.kpiObservation.findMany({
    where: buildObservationWhere(kpiId, filter),
    orderBy: [{ observedAt: "desc" }, { refreshedAt: "desc" }],
  });
  return (rows ?? []) as KpiObservationRecord[];
}

async function loadActiveOverride(
  kpiId: string,
  filter: KpiObservationFilter,
): Promise<KpiOverrideRecord | null> {
  // A manual override always wins over observations; a historical period query
  // still gets the override that belongs to that period.
  const override = await prisma.kpiOverride.findFirst({
    where: {
      kpiId,
      active: true,
      ...(filter.reportingPeriod != null ? { reportingPeriod: filter.reportingPeriod } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return (override ?? null) as KpiOverrideRecord | null;
}

async function loadKpiSubject(metricKey: string, filter: KpiObservationFilter) {
  const definition = (await prisma.kpiDefinition.findUnique({
    where: { metricKey },
    select: { id: true, metricKey: true, name: true, target: true, sourceType: true },
  })) as KpiDefinitionRecord | null;
  if (!definition) return null;

  const [override, observations] = await Promise.all([
    loadActiveOverride(definition.id, filter),
    loadEligibleObservations(definition.id, filter),
  ]);

  return { definition, override, observations };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function unavailable(definition: KpiDefinitionRecord): ResolvedKpi {
  return {
    metricKey: definition.metricKey,
    name: definition.name,
    value: null,
    reportingPeriod: null,
    source: "UNAVAILABLE",
    quality: "UNAVAILABLE",
    refreshedAt: null,
    target: definition.target,
    overrideActive: false,
  };
}

function toResolvedKpi(
  definition: KpiDefinitionRecord,
  observation: KpiObservationRecord,
  overrideActive: boolean,
): ResolvedKpi {
  return {
    metricKey: definition.metricKey,
    name: definition.name,
    value: observation.value,
    reportingPeriod: observation.reportingPeriod,
    source: (definition.sourceType as KpiSource) ?? "UNAVAILABLE",
    quality: observation.quality as KpiQuality,
    refreshedAt: observation.refreshedAt ?? null,
    target: definition.target,
    overrideActive,
    reportingScope: observation.reportingScope ?? null,
    comparisonBasis: observation.comparisonBasis ?? null,
    timeBasis: observation.timeBasis ?? null,
    revision: observation.revision ?? null,
    observedAt: observation.observedAt ?? null,
  };
}

/**
 * Resolve one KPI without allowing a refresh to overwrite a manual override,
 * and without allowing a superseded, invalid or out-of-perimeter observation to
 * be presented as the current value.
 *
 * The active newest override wins; otherwise the strongest approved observation
 * of the newest period wins. Pass `filter` to ask for a specific basis
 * (MONTHLY / YTD / LTM), comparison basis, perimeter or historical period.
 */
export async function resolveKpi(
  metricKey: string,
  filter: KpiObservationFilter = {},
): Promise<ResolvedKpi | null> {
  const subject = await loadKpiSubject(metricKey, filter);
  if (!subject) return null;

  const { definition, override } = subject;
  if (override) {
    return {
      metricKey: definition.metricKey,
      name: definition.name,
      value: override.value,
      reportingPeriod: override.reportingPeriod,
      source: "MANUAL",
      quality: "VALID",
      refreshedAt: override.createdAt,
      target: definition.target,
      overrideActive: true,
    };
  }

  const current = selectCurrentObservations(subject.observations, filter)[0];
  if (!current) return unavailable(definition);

  return toResolvedKpi(definition, current, false);
}

/**
 * Every current value of a KPI, one per identity. Monthly, YTD and LTM figures
 * for the same period are returned side by side instead of one silently
 * replacing the others.
 */
export async function resolveKpiSeries(
  metricKey: string,
  filter: KpiObservationFilter = {},
): Promise<ResolvedKpiSeries | null> {
  const subject = await loadKpiSubject(metricKey, filter);
  if (!subject) return null;

  const { definition, override } = subject;

  return {
    metricKey: definition.metricKey,
    name: definition.name,
    target: definition.target,
    override: override
      ? {
          metricKey: definition.metricKey,
          name: definition.name,
          value: override.value,
          reportingPeriod: override.reportingPeriod,
          source: "MANUAL",
          quality: "VALID",
          refreshedAt: override.createdAt,
          target: definition.target,
          overrideActive: true,
        }
      : null,
    values: selectCurrentObservations(subject.observations, filter).map((observation) =>
      toResolvedKpi(definition, observation, false),
    ),
  };
}

export function assertConfiguredSource(source: KpiSource, identifier: string | null): void {
  if (!identifier?.trim()) {
    throw new Error(`${source} KPI source is not configured; provide a source identifier before refreshing.`);
  }
}
