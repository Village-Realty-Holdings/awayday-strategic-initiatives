import {
  CONSOLIDATED_REPORTING_SCOPE,
  DEFAULT_TIME_BASIS,
  selectCurrentObservations,
  type KpiObservationRecord,
} from "@/lib/kpi";

// KPI shaping for the review: the financial table and a metric's current value.
// Server-side only: kpi.ts also holds the Prisma-backed resolvers, so client
// components must not import this file.

// ---------------------------------------------------------------------------
// Financial table from the period's approved KPI observations
// ---------------------------------------------------------------------------

export type KpiDefinitionLite = {
  id: string;
  metricKey: string;
  name: string;
  unit: string | null;
  displayFormat: string | null;
};

export type KpiRow = KpiObservationRecord & {
  kpiId: string;
  sourceDocumentName?: string | null;
  sourceCategory?: string | null;
  sourceLocation?: string | null;
  evidence?: string | null;
};

// ---------------------------------------------------------------------------
// Pillar measure values entered by hand in the review's Edit Mode
// ---------------------------------------------------------------------------

/** sourceCategory of a value typed in on the review rather than loaded from a document. */
export const MANUAL_SOURCE_CATEGORY = "MANUAL";

/**
 * The identity a hand-entered measure value is stored under: the consolidated
 * actual as at the month. The sourceRef keeps it apart from any loaded row.
 */
export const MANUAL_MEASURE_IDENTITY = {
  sourceRef: "review:edit-mode",
  comparisonBasis: "ACTUAL",
  timeBasis: "POINT_IN_TIME",
  reportingScope: CONSOLIDATED_REPORTING_SCOPE,
  entityScope: "CONSOLIDATED",
  entityId: null,
} as const;

const TIME_ORDER = ["MONTHLY", "YTD", "LTM", "POINT_IN_TIME"];
const BASIS_ORDER = ["ACTUAL", "BUDGET", "FORECAST", "PRIOR_YEAR", "VARIANCE", "LTM"];
export const TIME_LABEL: Record<string, string> = { MONTHLY: "Month", YTD: "YTD", LTM: "LTM", POINT_IN_TIME: "Point" };
export const BASIS_LABEL: Record<string, string> = { ACTUAL: "Actual", BUDGET: "Budget", FORECAST: "Forecast", PRIOR_YEAR: "PY", VARIANCE: "vs Bud", LTM: "LTM" };

export type FinanceColumn = { key: string; label: string };
export type FinanceTable = {
  columns: FinanceColumn[];
  rows: { id: string; label: string; cells: Record<string, string> }[];
};

export function formatKpiValue(value: string, def: Pick<KpiDefinitionLite, "unit" | "displayFormat">): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const format = (def.displayFormat ?? def.unit ?? "").toLowerCase();
  if (format.includes("percent") || format === "%") return `${n.toFixed(1)}%`;
  if (format.includes("currency") || format === "usd") {
    const abs = Math.abs(n);
    const sign = n < 0 ? "−" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(2)}`;
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * One row per metric, one column per (time basis × comparison basis) present in
 * the period. Only current, approved values within the requested scope are used.
 */
export function buildFinanceTable(
  defs: readonly KpiDefinitionLite[],
  rows: readonly KpiRow[],
  period: string,
  scope: { reportingScope: string; entityScope: string } = {
    reportingScope: CONSOLIDATED_REPORTING_SCOPE,
    entityScope: "CONSOLIDATED",
  },
): FinanceTable {
  const byKpi = new Map<string, KpiRow[]>();
  for (const r of rows) byKpi.set(r.kpiId, [...(byKpi.get(r.kpiId) ?? []), r]);

  const columnKeys = new Set<string>();
  const tableRows: FinanceTable["rows"] = [];
  for (const def of defs) {
    const current = selectCurrentObservations(byKpi.get(def.id) ?? [], {
      reportingPeriod: period,
    }).filter((o) =>
      o.reportingScope === scope.reportingScope &&
      (o.entityScope ?? "CONSOLIDATED") === scope.entityScope
    );
    if (current.length === 0) continue;
    const cells: Record<string, string> = {};
    for (const o of current) {
      const key = `${o.timeBasis ?? "YTD"}:${o.comparisonBasis ?? "ACTUAL"}`;
      columnKeys.add(key);
      cells[key] = formatKpiValue(o.value, def);
    }
    tableRows.push({ id: def.metricKey, label: def.name, cells });
  }

  const rank = (key: string) => {
    const [t, b] = key.split(":");
    const ti = TIME_ORDER.indexOf(t);
    const bi = BASIS_ORDER.indexOf(b);
    return (ti === -1 ? 9 : ti) * 10 + (bi === -1 ? 9 : bi);
  };
  const columns = [...columnKeys]
    .sort((a, b) => rank(a) - rank(b))
    .map((key) => {
      const [t, b] = key.split(":");
      return { key, label: `${TIME_LABEL[t] ?? t} ${BASIS_LABEL[b] ?? b}` };
    });
  return { columns, rows: tableRows };
}

/** The current value of one metric for a period, or null. */
export function currentKpiValue<T extends KpiObservationRecord>(rows: readonly T[], period: string): T | null {
  // selectCurrentObservations returns the rows it was given, not copies.
  const current = selectCurrentObservations(rows, { reportingPeriod: period }) as T[];
  return current[0] ?? null;
}

/**
 * The value a pillar's measure shows: its own approved actual, in the basis the
 * measure's mapping declares.
 *
 * A metric can publish several time bases for the same month — BD unit adds is
 * both 330 for October and 3,340 year to date — and the selector's presentation
 * order puts MONTHLY first. Taking that first row ignores what the measure says
 * it is: a mapping declared YTD would show the month's figure while its status
 * was worked out from the year-to-date one, so the number and the colour would
 * describe different facts. The declared basis therefore decides, and only when
 * the metric does not publish it at all does the value fall back (YTD first,
 * then any actual) rather than claim a basis it was not given.
 */
export function measureValue<T extends KpiObservationRecord>(rows: readonly T[], period: string, timeBasis: string | null | undefined): T | null {
  const candidates = [
    timeBasis ? { reportingPeriod: period, comparisonBasis: "ACTUAL", timeBasis } : null,
    // The basis Finance publishes headline figures on, before the month's own.
    { reportingPeriod: period, comparisonBasis: "ACTUAL", timeBasis: DEFAULT_TIME_BASIS },
    { reportingPeriod: period, comparisonBasis: "ACTUAL" },
    { reportingPeriod: period },
  ];
  for (const filter of candidates) {
    if (!filter) continue;
    const [row] = selectCurrentObservations(rows, filter) as T[];
    if (row) return row;
  }
  return null;
}
