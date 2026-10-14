import { prisma } from "@/lib/prisma";

export type KpiSource = "SNOWFLAKE" | "SHAREPOINT_EXCEL" | "MANUAL";

export type ResolvedKpi = {
  metricKey: string;
  name: string;
  value: string | null;
  reportingPeriod: string | null;
  source: KpiSource | "UNAVAILABLE";
  quality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID";
  refreshedAt: Date | null;
  target: string | null;
  overrideActive: boolean;
};

/**
 * Resolve a KPI without allowing a refresh to overwrite a manual override.
 * The active newest override wins; otherwise the newest valid observation wins.
 */
export async function resolveKpi(metricKey: string): Promise<ResolvedKpi | null> {
  const definition = await prisma.kpiDefinition.findUnique({
    where: { metricKey },
    include: {
      observations: { orderBy: { observedAt: "desc" }, take: 1 },
      overrides: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!definition) return null;

  const override = definition.overrides[0];
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

  const observation = definition.observations[0];
  if (!observation) {
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

  return {
    metricKey: definition.metricKey,
    name: definition.name,
    value: observation.value,
    reportingPeriod: observation.reportingPeriod,
    source: (definition.sourceType as KpiSource) ?? "UNAVAILABLE",
    quality: observation.quality as ResolvedKpi["quality"],
    refreshedAt: observation.refreshedAt,
    target: definition.target,
    overrideActive: false,
  };
}

export function assertConfiguredSource(source: KpiSource, identifier: string | null): void {
  if (!identifier?.trim()) {
    throw new Error(`${source} KPI source is not configured; provide a source identifier before refreshing.`);
  }
}
