import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  VALUE_SCALE,
  LIFT_SCALE,
  STATUS_META,
  QUADRANT_META,
  HEALTH_META,
  HEALTH_ORDER,
  siHealth,
  quadrantTooltipClasses,
  type Health,
} from "@/lib/initiatives";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lift × Value — Awayday" };

// Score positions 1..5 map to 10%..90% on each axis.
const GRID = [10, 30, 50, 70, 90];

export default async function QuadrantPage() {
  // Only value initiatives are scored on the Lift × Value map; non-value
  // (enabler/milestone) initiatives are excluded.
  const items = await prisma.initiative.findMany({ where: { valueType: "VALUE" }, orderBy: { code: "asc" } });
  const now = new Date();

  // Deterministic jitter so initiatives sharing the same (value, lift) don't fully overlap.
  const seen = new Map<string, number>();
  const dots = items.map((i) => {
    const key = `${i.value}-${i.lift}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const angle = n * 2.39996; // golden angle
    const r = n === 0 ? 0 : 3.2 + n * 0.7;
    const baseX = ((5 - i.lift) / 4) * 80 + 10; // higher lift -> left
    const baseY = ((i.value - 1) / 4) * 80 + 10; // higher value -> top
    const health = siHealth(i.status, i.pctComplete, i.startDate, i.endDate, now);
    return {
      i,
      health,
      x: Math.max(4, Math.min(96, baseX + Math.cos(angle) * r)),
      y: Math.max(4, Math.min(96, baseY + Math.sin(angle) * r)),
    };
  });

  return (
    <div className="mx-auto max-w-[900px]">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Lift × Value</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Where to spend: strategic value against effort to deliver. Top-right is the sweet spot.
          Dot color shows delivery health against the timeline.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-4 pb-3 text-[11px] text-ink-muted">
        {HEALTH_ORDER.map((h) => (
          <span key={h} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_META[h].dot}`} aria-hidden /> {HEALTH_META[h].label}
          </span>
        ))}
      </div>

      <div className="flex gap-3">
        {/* Y axis label */}
        <div className="flex w-5 items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-[11px] font-medium tracking-wide text-ink-faint">
            Strategic value →
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface">
            {/* Quadrant tints (2x2) */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              <div className="bg-navy/[0.05]" />
              <div className="bg-ok/[0.06]" />
              <div className="bg-risk/[0.05]" />
              <div className="bg-surface-2/60" />
            </div>
            {/* Score gridlines (1-5 on each axis) */}
            {GRID.map((p) => (
              <span key={`v${p}`} className={`absolute inset-y-0 w-px ${p === 50 ? "bg-border" : "bg-border/40"}`} style={{ left: `${p}%` }} aria-hidden />
            ))}
            {GRID.map((p) => (
              <span key={`h${p}`} className={`absolute inset-x-0 h-px ${p === 50 ? "bg-border" : "bg-border/40"}`} style={{ bottom: `${p}%` }} aria-hidden />
            ))}

            {/* Quadrant labels */}
            <span className="absolute left-3 top-3 text-[11px] font-medium text-navy-deep">Big Bet</span>
            <span className="absolute right-3 top-3 text-[11px] font-medium text-ok">Quick Win</span>
            <span className="absolute left-3 bottom-3 text-[11px] font-medium text-risk">Avoid</span>
            <span className="absolute right-3 bottom-3 text-[11px] font-medium text-ink-faint">Maybe</span>

            {/* Dots */}
            {dots.map(({ i, x, y, health }) => (
              <Link
                key={i.id}
                href={`/initiatives/${i.id}`}
                // hover:z-30 lifts the hovered dot's stacking context above its
                // siblings; without it, later-DOM dots paint over the tooltip.
                className="group absolute z-10 -translate-x-1/2 translate-y-1/2 hover:z-30"
                style={{ left: `${x}%`, bottom: `${y}%` }}
              >
                <span
                  className={`block h-3 w-3 rounded-full ring-2 ring-surface transition-transform group-hover:scale-150 ${HEALTH_META[health].dot}`}
                />
                <span
                  className={`pointer-events-none absolute z-20 hidden w-max max-w-[200px] rounded-md bg-ink px-2 py-1.5 text-left text-[10px] leading-snug text-white shadow-lg group-hover:block ${quadrantTooltipClasses(x, y)}`}
                >
                  <span className="font-semibold">{i.code} · {i.name}</span>
                  <span className="mt-0.5 block text-white/70">
                    Value {i.value} · Lift {i.lift} · {QUADRANT_META[i.quadrant].label}
                  </span>
                  <span className="block text-white/70">
                    {i.teamLead ?? "Unassigned"} · {STATUS_META[i.status].label} {Math.round(i.pctComplete * 100)}%
                  </span>
                  <span className="block text-white/70">Health: {HEALTH_META[health].label}</span>
                </span>
              </Link>
            ))}
          </div>
          {/* X axis label */}
          <div className="mt-1.5 flex justify-between px-1 text-[11px] text-ink-faint">
            <span>← harder (more lift)</span>
            <span className="font-medium">Ease to deliver →</span>
          </div>
        </div>
      </div>

      {/* Quadrant guide + scoring rubric */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Quadrants</h2>
          <ul className="flex flex-col gap-2.5 text-sm">
            <Guide color="bg-ok" name="Quick Win" sub="High value, easy to ship. Do these now." />
            <Guide color="bg-navy" name="Big Bet" sub="High value, harder to ship. Resource carefully." />
            <Guide color="bg-ink-faint" name="Maybe" sub="Low value, easy. Only if there's slack." />
            <Guide color="bg-risk" name="Avoid" sub="Low value, hard. Stop or descope." />
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Scoring rubric</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-medium text-ink-faint">Value</p>
              <ul className="flex flex-col gap-0.5">
                {VALUE_SCALE.map((v) => (
                  <li key={v.n} className="text-xs text-ink-muted">
                    <span className="tabular font-medium text-ink">{v.n}</span> {v.label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium text-ink-faint">Lift (effort)</p>
              <ul className="flex flex-col gap-0.5">
                {LIFT_SCALE.map((l) => (
                  <li key={l.n} className="text-xs text-ink-muted">
                    <span className="tabular font-medium text-ink">{l.n}</span> {l.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Guide({ color, name, sub }: { color: string; name: string; sub: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden />
      <span>
        <span className="font-medium text-ink">{name}</span>
        <span className="text-ink-muted"> — {sub}</span>
      </span>
    </li>
  );
}
