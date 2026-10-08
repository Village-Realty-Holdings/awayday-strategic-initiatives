import Link from "next/link";
import { ArrowLeft, Check, TriangleAlert } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getEbitdaBuild } from "@/lib/overview-data";
import { saveEbitdaBuild } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Scoreboard editor — Awayday" };

const input = "rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-navy";

export default async function ScoreboardEditorPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireSession({ role: "admin" });
  const { saved, error } = await searchParams;
  const b = await getEbitdaBuild();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Admin
      </Link>
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">Overview scoreboard</h1>
      <p className="mb-5 text-sm text-ink-muted">
        The EBITDA build shown on the Overview. Update these monthly from the National Financial Review.
        Until a live data source is connected, this is the single place to keep the headline numbers current.
      </p>

      {saved && (
        <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-ok/40 bg-ok-soft px-3.5 py-2.5 text-sm text-ink">
          <Check size={16} className="text-ok" aria-hidden /> Saved. The Overview now reflects these numbers.
        </div>
      )}
      {error === "bridge" && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-risk/40 bg-risk-soft px-3.5 py-2.5 text-sm text-ink">
          <TriangleAlert size={16} className="text-risk" aria-hidden /> The bridge field wasn&apos;t valid JSON. Nothing was saved.
        </div>
      )}

      <form action={saveEbitdaBuild} className="flex flex-col gap-5">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Headline numbers</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="As of (label)"><input name="asOf" defaultValue={b.asOf} className={input} /></Field>
            <Field label="Lender EBITDA ($M)"><Derived value={`$${b.lender}M`} /></Field>
            <Field label="Valuation EBITDA ($M)"><Derived value={`$${b.valuation}M`} /></Field>
            <Field label="2026 target ($M)"><input name="target2026" type="number" step="0.1" defaultValue={b.target2026} className={input} /></Field>
            <Field label="2027 exit target ($M)"><input name="target2027" type="number" step="0.1" defaultValue={b.target2027} className={input} /></Field>
            <Field label="YTD growth ($M)"><input name="ytdGrowth" type="number" step="0.1" defaultValue={b.ytdGrowth} className={input} /></Field>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Lender &amp; Valuation EBITDA are computed from the bridge breakdown below (the total and valuation-subtotal rows), so the headline always matches the build. Edit the bridge line items to change them.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Monthly trend (sparkline)</h2>
          <p className="mb-3 text-xs text-ink-muted">The last few months of LTM Lender EBITDA ($M). Month on top, value below.</p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            {b.trend.map((t, idx) => (
              <div key={idx} className="flex flex-col items-stretch rounded-lg border border-border bg-surface-2/30 px-1.5 py-1.5">
                <input
                  name={`trend_m_${idx}`}
                  defaultValue={t.m}
                  placeholder="Month"
                  className="w-full rounded bg-transparent px-1 py-0.5 text-center text-[11px] font-medium text-ink-muted outline-none transition-colors focus:bg-surface focus:text-ink"
                />
                <input
                  name={`trend_v_${idx}`}
                  type="number"
                  step="0.1"
                  defaultValue={t.v}
                  className="tabular w-full rounded bg-transparent px-1 py-0.5 text-center text-base font-semibold text-ink outline-none transition-colors focus:bg-surface"
                />
              </div>
            ))}
          </div>
        </section>

        <details className="rounded-xl border border-border bg-surface p-5">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Bridge breakdown (advanced)</summary>
          <p className="mb-2 mt-3 text-xs text-ink-muted">
            The &quot;How it builds&quot; table, as JSON. Each row: <code className="text-ink">{`{ "label": "...", "value": 0, "subtotal": true, "total": true }`}</code> (subtotal/total optional).
          </p>
          <textarea name="bridge" rows={10} defaultValue={JSON.stringify(b.bridge, null, 2)} className={`${input} w-full font-mono text-xs`} />
        </details>

        <div>
          <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep">
            Save scoreboard
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

// Read-only display for figures derived from the bridge (not directly editable).
function Derived({ value }: { value: string }) {
  return (
    <span className="tabular rounded-md border border-dashed border-border bg-surface-2/40 px-3 py-2 text-sm font-medium text-ink">
      {value}
    </span>
  );
}
