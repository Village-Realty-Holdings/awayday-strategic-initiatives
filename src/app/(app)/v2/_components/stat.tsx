import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className="tabular mt-0.5 text-xl font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">{sub}</p>}
    </div>
  );
}

/** Horizontal bar scaled to `max`, with an optional target band (min..max of the target). */
export function Meter({
  value,
  max,
  band,
  tone = "navy",
  label,
}: {
  value: number;
  max: number;
  band?: [number, number];
  tone?: "navy" | "ok" | "risk" | "warn";
  label: string;
}) {
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / max) * 100))}%`;
  const fill = { navy: "bg-navy", ok: "bg-ok", risk: "bg-risk", warn: "bg-warn" }[tone];
  return (
    <div
      role="img"
      aria-label={label}
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
    >
      {band && (
        <span
          className="absolute inset-y-0 bg-ok/25"
          style={{ left: pct(band[0]), width: `${((band[1] - band[0]) / max) * 100}%` }}
        />
      )}
      <span className={cn("absolute inset-y-0 left-0 rounded-full", fill)} style={{ width: pct(value) }} />
    </div>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-deep">{children}</p>;
}

/** Thousands separators without relying on the runtime locale. */
export function fmtInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
