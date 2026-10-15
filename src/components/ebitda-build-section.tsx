"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";
import type { EbitdaBuild as EbitdaBuildData } from "@/lib/overview-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EbitdaBuild } from "@/components/ebitda-build";
import { saveEbitdaInline } from "@/app/(app)/admin/scoreboard/actions";

const fmt = (n: number) => `$${n.toFixed(1)}M`;

// Inline EBITDA scoreboard: read view by default; admins get an Edit toggle that
// turns the headline figures into inputs in place (big number + key figures grid).
// The LTM trend and the build bridge stay on the /admin/scoreboard page.
export function EbitdaBuildSection({ data, editable }: { data: EbitdaBuildData; editable: boolean }) {
  const [editing, setEditing] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">EBITDA — building a $150M business by 12/31/2027</h2>
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((v) => !v)}
            className="px-2.5 py-1"
          >
            {editing ? <><X size={12} aria-hidden /> Close</> : <><Pencil size={12} aria-hidden /> Edit</>}
          </Button>
        )}
      </div>
      <div className="mb-3" />
      {editing ? <EbitdaEditor data={data} onDone={() => setEditing(false)} /> : <EbitdaBuild data={data} />}
    </section>
  );
}

function EbitdaEditor({ data, onDone }: { data: EbitdaBuildData; onDone: () => void }) {
  const [asOf, setAsOf] = useState(data.asOf);
  const [target2026, setTarget2026] = useState(String(data.target2026));
  const [target2027, setTarget2027] = useState(String(data.target2027));
  const [ytdGrowth, setYtdGrowth] = useState(String(data.ytdGrowth));
  const [saving, setSaving] = useState(false);

  const n = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  // lender + valuation are derived from the build bridge, not edited here.
  const gap2026 = n(target2026) - data.lender;
  const gap2027 = n(target2027) - data.lender;

  const handleSave = async (fd: FormData) => {
    setSaving(true);
    try {
      await saveEbitdaInline(fd);
      toast.success("Headline figures saved");
      onDone();
    } catch {
      toast.error("Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form action={handleSave} className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <input type="hidden" name="asOf" value={asOf} />
      <input type="hidden" name="target2026" value={target2026} />
      <input type="hidden" name="target2027" value={target2027} />
      <input type="hidden" name="ytdGrowth" value={ytdGrowth} />

      <section className="rounded-xl border border-border bg-surface p-6">
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink-faint">
          LTM Pro Forma Lender EBITDA ·
          <Input size="xs" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-28 py-0.5" aria-label="As of" />
        </p>
        <p className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="tabular text-3xl font-semibold tracking-tight text-ink">{fmt(data.lender)}</span>
          <span className="text-sm text-ink-muted">building to</span>
          <Input size="xs" value={target2027} onChange={(e) => setTarget2027(e.target.value)} className="w-20 text-lg font-semibold tabular" type="number" step="0.1" aria-label="2027 target" />
          <span className="text-sm text-ink-muted">by 12/31/27</span>
        </p>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Derived label="Lender EBITDA (from build)" value={fmt(data.lender)} />
          <Derived label="Valuation EBITDA (from build)" value={fmt(data.valuation)} />
          <Figure label="YTD growth ($M)"><Input size="xs" value={ytdGrowth} onChange={(e) => setYtdGrowth(e.target.value)} className="w-24 text-sm tabular" type="number" step="0.1" /></Figure>
          <Figure label="2026 target ($M)"><Input size="xs" value={target2026} onChange={(e) => setTarget2026(e.target.value)} className="w-24 text-sm tabular" type="number" step="0.1" /></Figure>
          <Figure label="2027 target ($M)"><Input size="xs" value={target2027} onChange={(e) => setTarget2027(e.target.value)} className="w-24 text-sm tabular" type="number" step="0.1" /></Figure>
          <div className="flex flex-col">
            <span className="tabular text-sm font-medium text-ink">{fmt(gap2026)} / {fmt(gap2027)}</span>
            <span className="text-[11px] text-ink-faint">Gap to 2026 / 2027 (auto)</span>
          </div>
        </div>

        <p className="mt-5 text-[11px] leading-relaxed text-ink-faint">
          Lender &amp; Valuation EBITDA are computed from the build bridge (shown right), so the headline always matches the build. Edit the bridge line items and the LTM trend chart on the Admin · Overview scoreboard page.
        </p>

        <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save figures"}
          </Button>
          <Button type="button" variant="ghost" size="bare" onClick={onDone} className="text-sm hover:bg-transparent">Cancel</Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">How {fmt(data.lender)} builds</h3>
        <table className="w-full text-sm">
          <tbody>
            {data.bridge.map((b) => (
              <tr key={b.label} className={b.subtotal || b.total ? "border-t border-border" : ""}>
                <td className={`py-1.5 ${b.total ? "font-semibold text-ink" : b.subtotal ? "font-medium text-navy-deep" : "pl-3 text-ink-muted"}`}>{b.label}</td>
                <td className={`tabular py-1.5 text-right ${b.total ? "font-semibold text-navy" : b.subtotal ? "font-medium text-navy-deep" : "text-ink"}`}>{fmt(b.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          The build bridge is read-only here. Edit it on the Admin · Overview scoreboard page.
        </p>
      </section>
    </form>
  );
}

function Derived({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-sm font-medium text-ink">{value}</span>
      <span className="text-[11px] text-ink-faint">{label}</span>
    </div>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Label className="flex flex-col gap-1">
      {children}
      <span className="text-[11px] font-normal text-ink-faint">{label}</span>
    </Label>
  );
}
