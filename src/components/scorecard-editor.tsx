"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Goal } from "@/lib/sources";
import { CodeMultiSelect, type CodeOption } from "@/components/code-multiselect";
import { saveScorecard } from "@/app/(app)/admin/scorecard/actions";

const toArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

type Row = {
  category: string; name: string; goal: string; ltm: string; ytdBud: string;
  status: string; color: string; owner: string; cim: string; sis: string; notes: string;
};

const COLORS = [
  { v: "green", label: "Green" },
  { v: "amber", label: "Amber" },
  { v: "red", label: "Red" },
  { v: "grey", label: "Grey / n/a" },
];

// Compact cell inputs so the edit table reads like the read-only table.
const cell = "w-full rounded border border-border/70 bg-surface px-1.5 py-1 text-xs text-ink outline-none transition-colors focus:border-navy";

function toRow(g: Goal): Row {
  return {
    category: g.category, name: g.name, goal: g.goal, ltm: g.ltm, ytdBud: g.ytdBud,
    status: g.status, color: g.color, owner: g.owner, cim: g.cim.join(", "), sis: g.sis.join(", "), notes: g.notes,
  };
}

export function ScorecardEditor({ goals, onDone, siOptions, cimOptions }: { goals: Goal[]; onDone?: () => void; siOptions: CodeOption[]; cimOptions: CodeOption[] }) {
  const [rows, setRows] = useState<Row[]>(goals.map(toRow));
  const [saving, setSaving] = useState(false);

  const update = (i: number, key: keyof Row, value: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const add = () =>
    setRows((rs) => [...rs, { category: rs[rs.length - 1]?.category ?? "", name: "", goal: "", ltm: "", ytdBud: "", status: "", color: "grey", owner: "", cim: "", sis: "", notes: "" }]);

  const handleSave = async (fd: FormData) => {
    setSaving(true);
    try {
      await saveScorecard(fd);
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form action={handleSave} className="flex flex-col gap-4">
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-2 py-2 font-medium">Category</th>
              <th className="px-2 py-2 font-medium">Goal &amp; notes</th>
              <th className="px-2 py-2 font-medium">Target</th>
              <th className="px-2 py-2 font-medium">LTM</th>
              <th className="px-2 py-2 font-medium">YTD Bud</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Color</th>
              <th className="px-2 py-2 font-medium">Owner</th>
              <th className="px-2 py-2 font-medium">CIM</th>
              <th className="px-2 py-2 font-medium">SIs</th>
              <th className="px-2 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/50 align-top last:border-0">
                <td className="px-2 py-1.5 min-w-[120px]"><input value={r.category} onChange={(e) => update(i, "category", e.target.value)} className={cell} /></td>
                <td className="px-2 py-1.5 min-w-[200px]">
                  <input value={r.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Goal name" className={`${cell} mb-1 font-medium`} />
                  <input value={r.notes} onChange={(e) => update(i, "notes", e.target.value)} placeholder="Notes" className={`${cell} text-ink-faint`} />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]"><input value={r.goal} onChange={(e) => update(i, "goal", e.target.value)} className={cell} /></td>
                <td className="px-2 py-1.5 min-w-[70px]"><input value={r.ltm} onChange={(e) => update(i, "ltm", e.target.value)} className={cell} /></td>
                <td className="px-2 py-1.5 min-w-[70px]"><input value={r.ytdBud} onChange={(e) => update(i, "ytdBud", e.target.value)} className={cell} /></td>
                <td className="px-2 py-1.5 min-w-[110px]"><input value={r.status} onChange={(e) => update(i, "status", e.target.value)} className={cell} /></td>
                <td className="px-2 py-1.5 min-w-[90px]">
                  <select value={r.color} onChange={(e) => update(i, "color", e.target.value)} className={cell}>
                    {COLORS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 min-w-[120px]"><input value={r.owner} onChange={(e) => update(i, "owner", e.target.value)} className={cell} /></td>
                <td className="px-2 py-1.5 min-w-[150px]"><CodeMultiSelect options={cimOptions} value={toArr(r.cim)} onChange={(codes) => update(i, "cim", codes.join(", "))} placeholder="+ CIM" /></td>
                <td className="px-2 py-1.5 min-w-[170px]"><CodeMultiSelect options={siOptions} value={toArr(r.sis)} onChange={(codes) => update(i, "sis", codes.join(", "))} placeholder="+ SI" /></td>
                <td className="px-2 py-1.5">
                  <button type="button" onClick={() => remove(i)} title="Remove row" className="text-ink-faint transition-colors hover:text-risk">
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={add} className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2">
        <Plus size={14} aria-hidden /> Add row
      </button>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button type="submit" disabled={saving} className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep disabled:opacity-60">
          {saving ? "Saving…" : "Save scorecard"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="text-sm text-ink-muted transition-colors hover:text-ink">Cancel</button>
        )}
      </div>
    </form>
  );
}
