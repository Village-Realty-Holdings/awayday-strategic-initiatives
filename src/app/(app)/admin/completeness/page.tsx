import Link from "next/link";
import { requireSession } from "@/lib/session";
import { FY27_PLAN } from "@/lib/fy27-plan";

export const dynamic = "force-dynamic";
export const metadata = { title: "FY27 completeness — Awayday" };

export default async function CompletenessPage() {
  await requireSession({ role: "admin" });
  const incompleteAreas = FY27_PLAN.areas.filter((area) => !area.kpiName || !area.kpiTarget || area.owner.includes("TBD"));
  const incompleteInitiatives = FY27_PLAN.initiatives.filter((initiative) => initiative.owner === "TBD" || !initiative.valueMetric);

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">← Admin</Link>
      <header className="mb-6 mt-4">
        <h1 className="text-xl font-semibold tracking-tight text-ink">FY27 completeness report</h1>
        <p className="mt-1 text-sm text-ink-muted">Deck fields that are explicitly TBD, optional, or still require business-owner completion.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Areas needing KPI/owner review" value={String(incompleteAreas.length)} />
        <Metric label="Initiatives needing charter review" value={String(incompleteInitiatives.length)} />
        <Metric label="Source integrations configured" value="0" />
      </div>
      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Areas requiring review</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {incompleteAreas.map((area) => <li key={area.code} className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2 text-sm text-ink"><b>{area.name}</b> — KPI: {area.kpiName ?? "TBD"}; target: {area.kpiTarget ?? "TBD"}; owner: {area.owner}</li>)}
        </ul>
      </section>
      <section className="mt-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Initiatives needing charter review</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {incompleteInitiatives.map((initiative) => <li key={initiative.code} className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2 text-sm text-ink"><b>{initiative.code} · {initiative.name}</b> — owner: {initiative.owner}; value metric: {initiative.valueMetric ?? "TBD"}</li>)}
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="tabular text-xl font-semibold text-ink">{value}</p><p className="mt-0.5 text-[11px] text-ink-faint">{label}</p></div>;
}
