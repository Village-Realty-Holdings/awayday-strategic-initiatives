"use client";

import { useState } from "react";
import { Target, Pencil, X, Plus, Trash2 } from "lucide-react";
import type { Pillar } from "@/lib/sources";
import { PillarCards, ProgressMini, siProgress, type SiMap } from "@/components/overview-sections";
import { CodeMultiSelect, type CodeOption } from "@/components/code-multiselect";
import { savePillars } from "@/app/(app)/admin/pillars/actions";

const toArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

// Editor-side shape: cim/sis held as comma strings for type-in-place editing.
type EItem = { id: string; name: string; desc: string; cim: string; sis: string };
type EPillar = { id: string; name: string; icon: string; headline: string; items: EItem[] };

const inp = "w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink outline-none transition-colors focus:border-navy";
const inpSm = "w-full rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-ink-faint outline-none transition-colors focus:border-navy";

function toEditable(pillars: Pillar[]): EPillar[] {
  return pillars.map((p) => ({
    id: p.id, name: p.name, icon: p.icon, headline: p.headline,
    items: p.items.map((it) => ({ id: it.id, name: it.name, desc: it.desc, cim: it.cim.join(", "), sis: it.sis.join(", ") })),
  }));
}

export function PillarsSection({ pillars, siMap, editable, siOptions, cimOptions }: { pillars: Pillar[]; siMap: SiMap; editable: boolean; siOptions: CodeOption[]; cimOptions: CodeOption[] }) {
  const [editing, setEditing] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Target size={15} className="text-navy" aria-hidden /> 2026 Goals — the bright future
        </h2>
        {editable && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2"
          >
            {editing ? <><X size={12} aria-hidden /> Close</> : <><Pencil size={12} aria-hidden /> Edit</>}
          </button>
        )}
      </div>
      <p className="mb-3 mt-1 max-w-3xl text-xs text-ink-faint">
        The three cultural pillars enabling the year. Progress is the average of the SIs driving each item.
      </p>
      {editing ? (
        <PillarsEditor pillars={pillars} siMap={siMap} siOptions={siOptions} cimOptions={cimOptions} onDone={() => setEditing(false)} />
      ) : (
        <PillarCards pillars={pillars} siMap={siMap} />
      )}
    </section>
  );
}

function PillarsEditor({ pillars, siMap, siOptions, cimOptions, onDone }: { pillars: Pillar[]; siMap: SiMap; siOptions: CodeOption[]; cimOptions: CodeOption[]; onDone: () => void }) {
  const [rows, setRows] = useState<EPillar[]>(toEditable(pillars));
  const [saving, setSaving] = useState(false);

  const setItem = (pi: number, ii: number, key: keyof EItem, value: string) =>
    setRows((rs) => rs.map((p, x) => x !== pi ? p : { ...p, items: p.items.map((it, y) => (y === ii ? { ...it, [key]: value } : it)) }));
  const setPillar = (pi: number, key: keyof EPillar, value: string) =>
    setRows((rs) => rs.map((p, x) => (x === pi ? { ...p, [key]: value } : p)));
  const addItem = (pi: number) =>
    setRows((rs) => rs.map((p, x) => x !== pi ? p : { ...p, items: [...p.items, { id: "", name: "", desc: "", cim: "", sis: "" }] }));
  const removeItem = (pi: number, ii: number) =>
    setRows((rs) => rs.map((p, x) => x !== pi ? p : { ...p, items: p.items.filter((_, y) => y !== ii) }));

  // Serialize cim/sis back to arrays for the payload.
  const payload = rows.map((p) => ({
    ...p,
    items: p.items.map((it) => ({ ...it, cim: it.cim.split(",").map((s) => s.trim()).filter(Boolean), sis: it.sis.split(",").map((s) => s.trim()).filter(Boolean) })),
  }));

  const handleSave = async (fd: FormData) => {
    setSaving(true);
    try {
      await savePillars(fd);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form action={handleSave} className="flex flex-col gap-4">
      <input type="hidden" name="pillars" value={JSON.stringify(payload)} />
      <div className="grid gap-4 lg:grid-cols-3">
        {rows.map((p, pi) => (
          <div key={pi} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start gap-2">
              <input value={p.icon} onChange={(e) => setPillar(pi, "icon", e.target.value)} className="w-9 shrink-0 rounded-md border border-border bg-surface px-1 py-1 text-center text-lg outline-none focus:border-navy" aria-label="Icon" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <input value={p.name} onChange={(e) => setPillar(pi, "name", e.target.value)} placeholder="Pillar name" className={`${inp} font-semibold`} />
                <input value={p.headline} onChange={(e) => setPillar(pi, "headline", e.target.value)} placeholder="Headline" className={`${inp} italic text-navy-deep`} />
              </div>
            </div>

            <ul className="mt-3 flex flex-col gap-3 border-t border-border/60 pt-3">
              {p.items.map((it, ii) => (
                <li key={ii} className="rounded-lg border border-border/70 bg-surface-2/30 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <ProgressMini value={siProgress(it.sis.split(",").map((s) => s.trim()).filter(Boolean), siMap)} />
                    <button type="button" onClick={() => removeItem(pi, ii)} title="Remove item" className="text-ink-faint transition-colors hover:text-risk">
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </div>
                  <input value={it.name} onChange={(e) => setItem(pi, ii, "name", e.target.value)} placeholder="Item name" className={`${inp} mb-1.5 font-medium`} />
                  <input value={it.desc} onChange={(e) => setItem(pi, ii, "desc", e.target.value)} placeholder="Description" className={`${inpSm} mb-2`} />
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-medium uppercase tracking-wide text-ink-faint">SIs driving</span>
                      <CodeMultiSelect options={siOptions} value={toArr(it.sis)} onChange={(codes) => setItem(pi, ii, "sis", codes.join(", "))} placeholder="+ SI" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-medium uppercase tracking-wide text-ink-faint">CIM items</span>
                      <CodeMultiSelect options={cimOptions} value={toArr(it.cim)} onChange={(codes) => setItem(pi, ii, "cim", codes.join(", "))} placeholder="+ CIM" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => addItem(pi)} className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-2">
              <Plus size={12} aria-hidden /> Add item
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button type="submit" disabled={saving} className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep disabled:opacity-60">
          {saving ? "Saving…" : "Save 2026 goals"}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-ink-muted transition-colors hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
