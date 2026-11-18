"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatValueForKind } from "@/lib/review-format";
import type { BrandChurn, BrandChurnRow } from "@/lib/review-report";

/**
 * Highlight threshold for a churn column, in percent. It is a display rule for
 * drawing attention, not a business target: the target lives in the metric's
 * definition (KpiDefinition.target) and is never inferred here.
 */
export const BRAND_CHURN_HIGHLIGHT_PCT = 15;

type NumericKey = "bookableUnits" | "monthChurned" | "monthAnnualizedPct" | "ltmChurned" | "ltmPct";
type SortKey = "brand" | NumericKey;

function isHigh(row: BrandChurnRow): boolean {
  return (
    (row.ltmPct != null && row.ltmPct >= BRAND_CHURN_HIGHLIGHT_PCT) ||
    (row.monthAnnualizedPct != null && row.monthAnnualizedPct >= BRAND_CHURN_HIGHLIGHT_PCT)
  );
}

/**
 * Brand-level churn for one month. Brands and their values come from KPI
 * observations that carry an entityId; nothing about a brand is listed in
 * source. Search, sort and the high-churn filter run in the browser so the
 * server sends one bounded table.
 */
export function BrandChurnTable({ churn, monthName }: { churn: BrandChurn; monthName: string }) {
  const [query, setQuery] = useState("");
  const [highOnly, setHighOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "ltmPct", dir: "desc" });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = churn.rows.filter((row) => (needle === "" || row.brand.toLowerCase().includes(needle)) && (!highOnly || isHigh(row)));
    return [...rows].sort((a, b) => {
      if (sort.key === "brand") {
        const order = a.brand.localeCompare(b.brand);
        return sort.dir === "asc" ? order : -order;
      }
      const av = a[sort.key];
      const bv = b[sort.key];
      // Rows without a value always sink, whichever way the column is sorted.
      if (av == null && bv == null) return a.brand.localeCompare(b.brand);
      if (av == null) return 1;
      if (bv == null) return -1;
      const order = av - bv;
      return sort.dir === "asc" ? order : -order;
    });
  }, [churn.rows, query, highOnly, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "brand" ? "asc" : "desc" }));
  };

  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" =>
    sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  if (churn.rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-ink-muted">
        No brand-level churn observations are loaded for {monthName}. Expected identity: one approved observation per brand, with the brand in the
        observation&apos;s entityId and a metric for bookable units, churned units, annualized churn and LTM churn.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="font-medium text-ink">Search brands</span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Brand name"
            className="h-8 w-44"
            aria-label="Search brands"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input type="checkbox" checked={highOnly} onChange={(event) => setHighOnly(event.target.checked)} className="h-3.5 w-3.5" />
          Only {BRAND_CHURN_HIGHLIGHT_PCT}%+ churn
        </label>
        <span className="text-note text-ink-faint">
          {filtered.length} of {churn.rows.length} {churn.totalsMixed ? "brand rows" : "brands"}
          {churn.scopeLabels.length > 0 ? ` · ${churn.scopeLabels.join(", ")}` : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[42rem] border-collapse text-xs">
          <caption className="sr-only">Brand-level churn for {monthName}</caption>
          <thead>
            <tr className="border-b border-border text-ink-faint">
              <th scope="col" aria-sort={ariaSort("brand")} className="px-3 py-2 text-left font-medium">
                <button type="button" onClick={() => toggleSort("brand")} className="font-medium hover:text-ink">
                  Brand {sort.key === "brand" ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
              {churn.columns.map((column) => (
                <th key={column.key} scope="col" aria-sort={ariaSort(column.key)} className="px-3 py-2 text-right font-medium">
                  <button type="button" onClick={() => toggleSort(column.key)} className="font-medium hover:text-ink">
                    {column.label} {sort.key === column.key ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                  </button>
                  <span className="block text-note font-normal text-ink-faint">{column.basisLabel}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className={`border-t border-border/60 ${isHigh(row) ? "bg-risk-soft/40" : ""}`}>
                <th scope="row" className="whitespace-normal px-3 py-1.5 text-left font-medium text-ink">
                  {row.brand}
                  {churn.totalsMixed && <span className="ml-2 font-normal text-ink-faint">{row.scopeLabel}</span>}
                  {isHigh(row) && (
                    <Badge variant="risk" className="ml-2">
                      High churn
                    </Badge>
                  )}
                </th>
                {churn.columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <td key={column.key} className="tabular px-3 py-1.5 text-right">
                      {value == null ? <span className="text-ink-faint">—</span> : formatValueForKind(column.kind, value)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={churn.columns.length + 1} className="px-3 py-3 text-center text-ink-faint">
                  No brand matches the filter.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-strong font-semibold text-ink">
              <th scope="row" className="px-3 py-2 text-left">
                {churn.totalsMixed ? "No total across populations" : `Total · ${churn.totals.brands} brands`}
              </th>
              {churn.columns.map((column) => {
                const total = column.key === "bookableUnits" ? churn.totals.bookableUnits : column.key === "monthChurned" ? churn.totals.monthChurned : column.key === "ltmChurned" ? churn.totals.ltmChurned : null;
                return (
                  <td key={column.key} className="tabular px-3 py-2 text-right">
                    {column.count && total != null ? formatValueForKind(column.kind, total) : <span className="font-normal text-ink-faint">—</span>}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-note text-ink-faint">
        {churn.totalsMixed
          ? "These brands are reported under more than one population, so no count is totalled or combined across them. "
          : "Totals add up the reported counts; "}
        percentages are not averaged or re-weighted here. Each column reads one time basis and one population, as its header says; a value published on
        another basis is not moved into it.{" "}
        {churn.ignoredTimeBasis > 0 ? `${churn.ignoredTimeBasis} churn observation${churn.ignoredTimeBasis === 1 ? " was" : "s were"} not shown because the time basis does not match the column. ` : ""}
        Rows at or above {BRAND_CHURN_HIGHLIGHT_PCT}% are highlighted for attention only. Month: {monthName}.
      </p>
    </div>
  );
}
