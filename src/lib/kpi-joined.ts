import { comparePeriods } from "@/lib/kpi";
import { prisma } from "@/lib/prisma";
import { formatKpiValue } from "@/lib/review-kpi";

// Temporary admin view: every KPI definition joined to its observations and their
// revision history, one row per observation (or one empty row for a definition with
// none). Mirrors the "KPI Joined" export; overrides and commentary are left out.

export type KpiJoinedRevision = {
  revision: number;
  value: string;
  publicationState: string;
  recordedAt: Date;
};

export type KpiJoinedDefinition = {
  id: string;
  metricKey: string;
  name: string;
  unit: string | null;
  displayFormat: string | null;
  target: string | null;
  sourceType: string;
  strategicArea: { name: string } | null;
  observations: {
    id: string;
    value: string;
    reportingPeriod: string;
    comparisonBasis: string | null;
    timeBasis: string | null;
    reportingScope: string | null;
    entityScope: string | null;
    entityId: string | null;
    quality: string;
    publicationState: string;
    revision: number;
    observedAt: Date;
    refreshedAt: Date;
    sourceDocumentName: string | null;
    sourceDocumentVersion: string | null;
    sourceLocation: string | null;
    valueDerivation: string | null;
    authorityRank: number | null;
    revisions: KpiJoinedRevision[];
  }[];
};

export type KpiJoinedRow = {
  id: string;
  metricKey: string;
  name: string;
  area: string;
  target: string | null;
  sourceType: string;
  /** Null for a definition that has no observations yet. */
  observation: {
    reportingPeriod: string;
    comparisonBasis: string | null;
    timeBasis: string | null;
    value: string;
    formattedValue: string;
    publicationState: string;
    quality: string;
    revision: number;
    observedAt: Date;
    refreshedAt: Date;
    sourceDocumentName: string | null;
    sourceDocumentVersion: string | null;
    sourceLocation: string | null;
    reportingScope: string | null;
    entityScope: string | null;
    entityId: string | null;
    valueDerivation: string | null;
    authorityRank: number | null;
    revisions: KpiJoinedRevision[];
  } | null;
};

const byText = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").localeCompare(b ?? "");

export function buildKpiJoinedRows(defs: readonly KpiJoinedDefinition[]): KpiJoinedRow[] {
  const sorted = [...defs].sort((a, b) => byText(b.sourceType, a.sourceType) || byText(a.metricKey, b.metricKey));
  return sorted.flatMap((d): KpiJoinedRow[] => {
    const base = { metricKey: d.metricKey, name: d.name, area: d.strategicArea?.name ?? "Company-wide", target: d.target, sourceType: d.sourceType };
    if (d.observations.length === 0) return [{ ...base, id: d.id, observation: null }];
    const observations = [...d.observations].sort(
      (a, b) =>
        comparePeriods(a.reportingPeriod, b.reportingPeriod) ||
        byText(a.comparisonBasis, b.comparisonBasis) ||
        byText(a.timeBasis, b.timeBasis) ||
        byText(a.id, b.id),
    );
    return observations.map((o) => ({
      ...base,
      id: o.id,
      observation: {
        reportingPeriod: o.reportingPeriod,
        comparisonBasis: o.comparisonBasis,
        timeBasis: o.timeBasis,
        value: o.value,
        formattedValue: formatKpiValue(o.value, d),
        publicationState: o.publicationState,
        quality: o.quality,
        revision: o.revision,
        observedAt: o.observedAt,
        refreshedAt: o.refreshedAt,
        sourceDocumentName: o.sourceDocumentName,
        sourceDocumentVersion: o.sourceDocumentVersion,
        sourceLocation: o.sourceLocation,
        reportingScope: o.reportingScope,
        entityScope: o.entityScope,
        entityId: o.entityId,
        valueDerivation: o.valueDerivation,
        authorityRank: o.authorityRank,
        revisions: [...o.revisions].sort((a, b) => a.revision - b.revision),
      },
    }));
  });
}

export async function loadKpiJoinedRows(): Promise<KpiJoinedRow[]> {
  const defs = await prisma.kpiDefinition.findMany({
    select: {
      id: true,
      metricKey: true,
      name: true,
      unit: true,
      displayFormat: true,
      target: true,
      sourceType: true,
      strategicArea: { select: { name: true } },
      observations: {
        select: {
          id: true,
          value: true,
          reportingPeriod: true,
          comparisonBasis: true,
          timeBasis: true,
          reportingScope: true,
          entityScope: true,
          entityId: true,
          quality: true,
          publicationState: true,
          revision: true,
          observedAt: true,
          refreshedAt: true,
          sourceDocumentName: true,
          sourceDocumentVersion: true,
          sourceLocation: true,
          valueDerivation: true,
          authorityRank: true,
          revisions: { select: { revision: true, value: true, publicationState: true, recordedAt: true }, orderBy: { revision: "asc" } },
        },
      },
    },
  });
  return buildKpiJoinedRows(defs);
}
