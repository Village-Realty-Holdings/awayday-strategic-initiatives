"use client";

import { useState } from "react";
import { Flame, LayoutGrid, ScatterChart } from "lucide-react";
import { RiskMatrix, type RiskPoint } from "@/components/risk-matrix";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function healthChip(cov: number): string {
  if (cov < 0.34) return "bg-risk-soft text-risk";
  if (cov < 0.67) return "bg-warn-soft text-warn";
  return "bg-ok-soft text-ok";
}

export function RiskViews({ risks }: { risks: RiskPoint[] }) {
  const [view, setView] = useState<RiskView>("scorecard");

  // Group by category, preserving first-seen order.
  const groups: { category: string; items: RiskPoint[] }[] = [];
  for (const r of risks) {
    let g = groups.find((x) => x.category === r.category);
    if (!g) { g = { category: r.category, items: [] }; groups.push(g); }
    g.items.push(r);
  }

  return (
    <div>
      <RiskViewSwitch view={view} onChange={setView} className="mb-3" />

      {view === "matrix" ? (
        <RiskMatrix risks={risks} />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Risk scorecard</h2>
            <div className="flex items-center gap-3 text-[11px] text-ink-muted">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-risk" aria-hidden /> &lt;34%</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-warn" aria-hidden /> 34-66%</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-ok" aria-hidden /> 67%+</span>
              <span className="inline-flex items-center gap-1"><Flame size={11} className="text-risk" aria-hidden /> critical</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {groups.map((g) => (
              <div key={g.category} className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr] sm:items-start">
                <span className="pt-1 text-[11px] font-medium text-ink-muted">{g.category}</span>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((r) => (
                    <Badge
                      key={r.id}
                      asChild
                      variant="custom"
                      className={`py-1 text-[11px] transition-opacity hover:opacity-80 ${healthChip(r.coverage)}`}
                    >
                      <a
                        href={`#${r.code}`}
                        title={`${r.risk} · ${r.owner ?? "Unassigned"} · ${Math.round(r.coverage * 100)}% covered${r.prize ? ` · ${r.prize}` : ""}`}
                      >
                        <span className="tabular">{r.code}</span>
                        {r.critical && <Flame size={10} aria-hidden />}
                        <span className="tabular opacity-80">{Math.round(r.coverage * 100)}%</span>
                      </a>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-faint">
            Each chip is a risk, colored by mitigation coverage. Hover for detail, click to jump to its row below.
          </p>
        </div>
      )}
    </div>
  );
}

export type RiskView = "scorecard" | "matrix";

/** Scorecard / Exposure map switch (single choice, never empty). */
export function RiskViewSwitch({ view, onChange, className }: { view: RiskView; onChange: (v: RiskView) => void; className?: string }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={view}
      onValueChange={(v) => v && onChange(v as RiskView)}
      aria-label="Risk view"
      className={className}
    >
      <ToggleGroupItem value="scorecard">
        <LayoutGrid size={13} aria-hidden /> Scorecard
      </ToggleGroupItem>
      <ToggleGroupItem value="matrix">
        <ScatterChart size={13} aria-hidden /> Exposure map
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
