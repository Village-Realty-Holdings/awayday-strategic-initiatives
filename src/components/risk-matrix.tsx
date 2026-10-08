"use client";

import { Flame } from "lucide-react";

export type RiskPoint = {
  id: string;
  code: string;
  category: string;
  risk: string;
  owner: string | null;
  coverage: number; // 0..1
  prize: string | null;
  prizeNum: number | null;
  critical: boolean;
  siCount: number;
};

function covTone(cov: number): { dot: string; ring: string } {
  if (cov < 0.34) return { dot: "bg-risk", ring: "ring-risk" };
  if (cov < 0.67) return { dot: "bg-warn", ring: "ring-warn" };
  return { dot: "bg-ok", ring: "ring-ok" };
}

export function RiskMatrix({ risks }: { risks: RiskPoint[] }) {
  const maxPrize = Math.max(10, ...risks.map((r) => r.prizeNum ?? 0));
  // sqrt scale spreads the cluster of small prizes upward while keeping order.
  // Plot inside an inset band (10..84) so dots never land in the corner-label
  // rows at the very top/bottom of the chart.
  const yPos = (p: number | null) => (p && p > 0 ? Math.sqrt(p / maxPrize) * 74 + 10 : 10);

  // Deterministic jitter so risks sharing a cell don't fully overlap.
  const seen = new Map<string, number>();
  const dots = risks.map((r) => {
    const baseX = r.coverage * 84 + 8;
    const baseY = yPos(r.prizeNum);
    const key = `${Math.round(baseX / 6)}-${Math.round(baseY / 6)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const ang = n * 2.39996;
    // Wider golden-angle spiral so stacked risks in a dense cell separate clearly.
    const rad = n === 0 ? 0 : 3.8 + n * 1.15;
    return {
      r,
      x: Math.max(6, Math.min(94, baseX + Math.cos(ang) * rad)),
      y: Math.max(9, Math.min(86, baseY + Math.sin(ang) * rad)),
    };
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Exposure map</h2>
        <div className="flex items-center gap-3 text-[11px] text-ink-muted">
          <Legend dot="bg-risk" label="<34% covered" />
          <Legend dot="bg-warn" label="34-66%" />
          <Legend dot="bg-ok" label="67%+" />
          <span className="inline-flex items-center gap-1"><Flame size={11} className="text-risk" aria-hidden /> critical</span>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex w-5 items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-[11px] font-medium tracking-wide text-ink-faint">$ at stake →</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border bg-surface">
            {/* quadrant tints */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              <div className="bg-risk/[0.06]" />
              <div className="bg-ok/[0.05]" />
              <div className="bg-warn/[0.05]" />
              <div className="bg-surface-2/50" />
            </div>
            {/* mid gridlines */}
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />

            {/* quadrant labels — above dots, with a translucent backdrop so they stay readable */}
            <span className="absolute left-3 top-2.5 z-20 rounded bg-surface/75 px-1 text-[11px] font-semibold text-risk">Address now</span>
            <span className="absolute right-3 top-2.5 z-20 rounded bg-surface/75 px-1 text-[11px] font-medium text-ok">Maintain</span>
            <span className="absolute left-3 bottom-2.5 z-20 rounded bg-surface/75 px-1 text-[11px] font-medium text-warn">Watch</span>
            <span className="absolute right-3 bottom-2.5 z-20 rounded bg-surface/75 px-1 text-[11px] font-medium text-ink-faint">Lower priority</span>

            {dots.map(({ r, x, y }) => {
              const tone = covTone(r.coverage);
              // Flip the tooltip so it never clips the plot edge or sits off-screen:
              // below the dot when it's in the upper area, above when it's low; and
              // anchor left/right near the side edges instead of centering.
              const vClass = y >= 50 ? "top-4" : "bottom-4";
              const hClass = x <= 18 ? "left-0" : x >= 82 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <a
                  key={r.id}
                  href={`#${r.code}`}
                  className="group absolute z-10 -translate-x-1/2 translate-y-1/2 hover:z-30"
                  style={{ left: `${x}%`, bottom: `${y}%` }}
                >
                  <span
                    className={`block rounded-full ring-2 ring-surface transition-transform group-hover:scale-150 ${tone.dot} ${
                      r.critical ? `h-3.5 w-3.5 ${tone.ring} ring-offset-1 ring-offset-surface` : "h-3 w-3"
                    }`}
                  />
                  <span className={`pointer-events-none absolute ${vClass} ${hClass} z-30 hidden w-max max-w-[220px] rounded-md bg-ink px-2 py-1.5 text-left text-[10px] leading-snug text-white shadow-lg group-hover:block`}>
                    <span className="font-semibold">{r.code} · {r.risk}</span>
                    <span className="mt-0.5 block text-white/70">
                      {r.owner ?? "Unassigned"}
                      {r.critical ? " · critical" : ""}
                    </span>
                    <span className="block text-white/70">
                      {Math.round(r.coverage * 100)}% covered
                      {r.prize ? ` · ${r.prize}` : ""}
                      {` · ${r.siCount} SI${r.siCount === 1 ? "" : "s"}`}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between px-1 text-[11px] text-ink-faint">
            <span>← under-mitigated</span>
            <span className="font-medium">Mitigation coverage →</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">
        Top-left is the danger zone: high dollars at stake, low mitigation. Click any risk to jump to its detail below.
      </p>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden /> {label}
    </span>
  );
}
