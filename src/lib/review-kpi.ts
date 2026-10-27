import {
  CONSOLIDATED_REPORTING_SCOPE,
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
};

const TIME_ORDER = ["MONTHLY", "YTD", "LTM", "POINT_IN_TIME"];
const BASIS_ORDER = ["ACTUAL", "BUDGET", "FORECAST", "PRIOR_YEAR", "VARIANCE", "LTM"];
export const TIME_LABEL: Record<string, string> = { MONTHLY: "Month", YTD: "YTD", LTM: "LTM", POINT_IN_TIME: "Point" };
export const BASIS_LABEL: Record<string, string> = { ACTUAL: "Actual", BUDGET: "Budget", FORECAST: "Forecast", PRIOR_YEAR: "PY", VARIANCE: "vs Bud", LTM: "LTM" };

export type FinanceColumn = { key: string; label: string };
export type FinanceTable = { columns: FinanceColumn[]; rows: { id: string; label: string; cells: Record<string, string> }[] };

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
 * the period. Only current, approved, consolidated values are used.
 */
export function buildFinanceTable(defs: readonly KpiDefinitionLite[], rows: readonly KpiRow[], period: string): FinanceTable {
  const byKpi = new Map<string, KpiRow[]>();
  for (const r of rows) byKpi.set(r.kpiId, [...(byKpi.get(r.kpiId) ?? []), r]);

  const columnKeys = new Set<string>();
  const tableRows: FinanceTable["rows"] = [];
  for (const def of defs) {
    const current = selectCurrentObservations(byKpi.get(def.id) ?? [], {
      reportingPeriod: period,
      reportingScope: CONSOLIDATED_REPORTING_SCOPE,
    }).filter((o) => (o.entityScope ?? "CONSOLIDATED") === "CONSOLIDATED");
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
export function currentKpiValue(rows: readonly KpiRow[], period: string): KpiObservationRecord | null {
  const current = selectCurrentObservations(rows, { reportingPeriod: period });
  return current[0] ?? null;
}
