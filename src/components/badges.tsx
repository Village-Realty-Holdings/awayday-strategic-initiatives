"use client";

import type { InitiativeStatus, Quadrant } from "@/generated/prisma/client";
import { STATUS_META, QUADRANT_META } from "@/lib/initiatives";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: InitiativeStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
      <span className={`${m.fg} text-micro leading-none`} aria-hidden>
        {m.glyph}
      </span>
      <span className="text-ink">{m.label}</span>
    </span>
  );
}

export function QuadrantBadge({ quadrant }: { quadrant: Quadrant }) {
  const m = QUADRANT_META[quadrant];
  return (
    <Badge variant="custom" title={m.hint} className={`${m.bg} ${m.fg}`}>
      {m.label}
    </Badge>
  );
}

// Thin horizontal progress bar with tabular % label.
export function ProgressBar({ value, hideLabel = false }: { value: number; hideLabel?: boolean }) {
  const pct = Math.round(value * 100); // can exceed 100 (e.g. 125% of target)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="presentation">
        <div
          className="h-full rounded-full bg-navy transition-[width] duration-500"
          style={{ width: `${Math.min(100, pct)}%`, transitionTimingFunction: "var(--ease-out-quint)" }}
        />
      </div>
      {!hideLabel && <span className="tabular w-9 shrink-0 text-right text-xs text-ink-muted">{pct}%</span>}
    </div>
  );
}
