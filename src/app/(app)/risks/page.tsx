import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession, canEdit } from "@/lib/session";
import { formatDateShort } from "@/lib/initiatives";
import { type RiskPoint } from "@/components/risk-matrix";
import { RiskViews } from "@/components/risk-views";
import { RiskTargetHighlight } from "@/components/risk-target-highlight";
import { Flame, Star, Plus, Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "CIM Risks — Awayday" };

type LinkedSI = { id: string; code: string; name: string; status: string; pctComplete: number };

function coverageOf(sis: LinkedSI[]) {
  if (sis.length === 0) return 0;
  return sis.reduce((a, i) => a + (i.status === "DONE" ? 1 : i.pctComplete), 0) / sis.length;
}

function covTone(cov: number): string {
  if (cov < 0.34) return "bg-risk";
  if (cov < 0.67) return "bg-warn";
  return "bg-ok";
}

function siColor(si: LinkedSI): string {
  const p = si.status === "DONE" ? 1 : si.pctComplete;
  if (si.status === "AT_RISK" || p < 0.25) return "bg-risk-soft text-risk";
  if (p < 0.6) return "bg-warn-soft text-warn";
  if (p >= 0.99) return "bg-ok-soft text-ok";
  return "bg-navy/10 text-navy-deep";
}

export default async function RisksPage() {
  const session = await requireSession();
  const editable = canEdit(session.user.role);
  const risks = await prisma.cimRisk.findMany({
    orderBy: { code: "asc" },
    include: { initiatives: { include: { initiative: true } } },
  });

  const withCov = risks.map((r) => {
    const linked = r.initiatives.map((ri) => ri.initiative) as LinkedSI[];
    return { r, linked, cov: coverageOf(linked) };
  });

  const totalPrize = risks.reduce((a, r) => a + (r.prizeNum ?? 0), 0);
  const critical = risks.filter((r) => r.critical).length;
  const avgCov = withCov.length ? withCov.reduce((a, x) => a + x.cov, 0) / withCov.length : 0;

  const groups: { category: string; items: typeof withCov }[] = [];
  for (const item of withCov) {
    let g = groups.find((x) => x.category === item.r.category);
    if (!g) { g = { category: item.r.category, items: [] }; groups.push(g); }
    g.items.push(item);
  }

  const points: RiskPoint[] = withCov.map(({ r, linked, cov }) => ({
    id: r.id,
    code: r.code,
    category: r.category,
    risk: r.risk,
    owner: r.owner,
    coverage: cov,
    prize: r.prize,
    prizeNum: r.prizeNum,
    critical: r.critical,
    siCount: linked.length,
  }));

  return (
    <div className="mx-auto max-w-[1200px]">
      <RiskTargetHighlight />
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">CIM Risk Scorecard</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Every risk dimension on one page. Coverage = the average progress of the SIs driving each
            risk toward its mitigated state.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Stat label="Risks" value={String(risks.length)} />
          <Stat label="Critical" value={String(critical)} tone={critical ? "risk" : undefined} />
          <Stat label="Avg coverage" value={`${Math.round(avgCov * 100)}%`} />
          <Stat label="Prize at stake" value={`$${totalPrize.toFixed(0)}M`} />
          {editable && (
            <Link href="/risks/new" className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-navy-deep">
              <Plus size={14} aria-hidden /> New risk
            </Link>
          )}
        </div>
      </header>

      <div className="mb-6">
        <RiskViews risks={points} />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink">All risks</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-[1fr_180px_120px] items-center gap-3 border-b border-border bg-surface-2/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint sm:grid-cols-[1fr_220px_160px_120px]">
          <span>Risk dimension</span>
          <span className="hidden sm:block">Driving initiatives</span>
          <span>Coverage</span>
          <span className="text-right">Prize · target</span>
        </div>

        {groups.map((group) => (
          <div key={group.category}>
            <div className="bg-surface-2/20 px-4 py-1.5 text-[11px] font-semibold text-ink-muted">{group.category}</div>
            {group.items.map(({ r, linked, cov }) => (
              <div
                key={r.id}
                id={r.code}
                className="grid scroll-mt-20 grid-cols-[1fr_180px_120px] items-center gap-3 border-t border-border/50 px-4 py-2.5 sm:grid-cols-[1fr_220px_160px_120px]"
              >
                {/* Risk name + flags */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="tabular text-[11px] text-ink-faint">{r.code}</span>
                    <span
                      className="truncate text-sm font-medium text-ink"
                      title={[r.currentState && `Now: ${r.currentState}`, r.targetState && `Mitigated: ${r.targetState}`].filter(Boolean).join("\n")}
                    >
                      {r.risk}
                    </span>
                    {r.critical && <Flame size={12} className="shrink-0 text-risk" aria-label="Critical" />}
                    {r.focus && <Star size={12} className="shrink-0 text-warn" aria-label="Focus" />}
                    {editable && (
                      <Link href={`/risks/${r.id}/edit`} title="Edit risk" className="shrink-0 text-ink-faint transition-colors hover:text-navy">
                        <Pencil size={11} aria-hidden />
                      </Link>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-faint">{r.owner ?? "Unassigned"}</p>
                </div>

                {/* Driving SIs (compact pills) */}
                <div className="hidden flex-wrap items-center gap-1 sm:flex">
                  {linked.length === 0 ? (
                    <span className="text-[10px] text-ink-faint">none</span>
                  ) : (
                    linked.slice(0, 4).map((si) => (
                      <Link
                        key={si.id}
                        href={`/initiatives/${si.id}`}
                        title={`${si.name} · ${Math.round((si.status === "DONE" ? 1 : si.pctComplete) * 100)}%`}
                        className={`tabular rounded px-1 py-0.5 text-[9px] font-medium transition-opacity hover:opacity-80 ${siColor(si)}`}
                      >
                        {si.code}
                      </Link>
                    ))
                  )}
                  {linked.length > 4 && <span className="text-[10px] text-ink-faint">+{linked.length - 4}</span>}
                </div>

                {/* Coverage */}
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className={`h-full rounded-full ${covTone(cov)}`} style={{ width: `${Math.round(cov * 100)}%` }} />
                  </div>
                  <span className="tabular w-8 text-right text-xs text-ink-muted">{Math.round(cov * 100)}%</span>
                </div>

                {/* Prize + target */}
                <div className="text-right text-[11px] leading-tight text-ink-muted">
                  <div className="tabular font-medium text-ink">{r.prize ?? "—"}</div>
                  {r.targetDate && <div className="text-ink-faint">{formatDateShort(r.targetDate)}</div>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-ink-faint">
        Hover a risk name to see its current and mitigated state. Click an initiative code to open its
        charter, or the pencil to edit the risk.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "risk" }) {
  return (
    <div className="text-right">
      <p className={`tabular text-lg font-semibold ${tone === "risk" ? "text-risk" : "text-ink"}`}>{value}</p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}
