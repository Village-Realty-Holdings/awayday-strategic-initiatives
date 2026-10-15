"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Target, Pencil, X, Plus, Trash2 } from "lucide-react";
import type { Pillar } from "@/lib/sources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PillarCards, ProgressMini, siProgress, type SiMap } from "@/components/overview-sections";
import { CodeMultiSelect, type CodeOption } from "@/components/code-multiselect";
import { savePillars } from "@/app/(app)/admin/pillars/actions";

const toArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

// Editor-side shape: cim/sis held as comma strings for type-in-place editing.
type EItem = { id: string; name: string; desc: string; cim: string; sis: string };
type EPillar = { id: string; name: string; icon: string; headline: string; items: EItem[] };

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
      toast.success("Pillars saved");
      onDone();
    } catch {
      toast.error("Couldn't save your changes. Please try again.");
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
              <Input size="xs" value={p.icon} onChange={(e) => setPillar(pi, "icon", e.target.value)} className="w-9 shrink-0 px-1 text-center text-lg" aria-label="Icon" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Input size="xs" value={p.name} onChange={(e) => setPillar(pi, "name", e.target.value)} placeholder="Pillar name" className="w-full text-sm font-semibold" />
                <Input size="xs" value={p.headline} onChange={(e) => setPillar(pi, "headline", e.target.value)} placeholder="Headline" className="w-full text-sm italic text-navy-deep" />
              </div>
            </div>

            <ul className="mt-3 flex flex-col gap-3 border-t border-border/60 pt-3">
              {p.items.map((it, ii) => (
                <li key={ii} className="rounded-lg border border-border/70 bg-surface-2/30 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <ProgressMini value={siProgress(it.sis.split(",").map((s) => s.trim()).filter(Boolean), siMap)} />
                    <Button type="button" variant="faint" size="bare" onClick={() => removeItem(pi, ii)} title="Remove item" aria-label="Remove item" className="hover:text-risk">
                      <Trash2 size={13} aria-hidden />
                    </Button>
                  </div>
                  <Input size="xs" value={it.name} onChange={(e) => setItem(pi, ii, "name", e.target.value)} placeholder="Item name" className="mb-1.5 w-full text-sm font-medium" />
                  <Input size="xs" value={it.desc} onChange={(e) => setItem(pi, ii, "desc", e.target.value)} placeholder="Description" className="mb-2 w-full text-[11px] text-ink-faint" />
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
            <Button type="button" variant="outline" size="xs" onClick={() => addItem(pi)} className="mt-2.5 w-fit gap-1 px-2.5">
              <Plus size={12} aria-hidden /> Add item
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save 2026 goals"}
        </Button>
        <Button type="button" variant="ghost" size="bare" onClick={onDone} className="text-sm hover:bg-transparent">Cancel</Button>
      </div>
    </form>
  );
}
