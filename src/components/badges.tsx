"use client";

import type { InitiativeStatus, Quadrant, DmaicStage } from "@/generated/prisma/client";
import { STATUS_META, QUADRANT_META, DMAIC_META } from "@/lib/initiatives";

export function DmaicBadge({ stage, showStep = true }: { stage: DmaicStage; showStep?: boolean }) {
  const m = DMAIC_META[stage];
  return (
    <span
      title={`DMAIC stage ${m.n} of 5: ${m.label}`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${m.bg} ${m.fg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />
      {showStep && <span className="tabular opacity-70">{m.n}</span>} {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: InitiativeStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
      <span className={`${m.fg} text-[10px] leading-none`} aria-hidden>
        {m.glyph}
      </span>
      <span className="text-ink">{m.label}</span>
    </span>
  );
}

export function QuadrantBadge({ quadrant }: { quadrant: Quadrant }) {
  const m = QUADRANT_META[quadrant];
  return (
    <span
      title={m.hint}
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${m.bg} ${m.fg}`}
    >
      {m.label}
    </span>
  );
}

// Thin horizontal progress bar with tabular % label.
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100); // can exceed 100 (e.g. 125% of target)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="presentation">
        <div
          className="h-full rounded-full bg-navy transition-[width] duration-500"
          style={{ width: `${Math.min(100, pct)}%`, transitionTimingFunction: "var(--ease-out-quint)" }}
        />
      </div>
      <span className="tabular w-9 shrink-0 text-right text-xs text-ink-muted">{pct}%</span>
    </div>
  );
}
