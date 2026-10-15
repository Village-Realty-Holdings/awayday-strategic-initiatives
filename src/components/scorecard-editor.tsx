"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Goal } from "@/lib/sources";
import { CodeMultiSelect, type CodeOption } from "@/components/code-multiselect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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
      toast.success("Scorecard saved");
      onDone?.();
    } catch {
      toast.error("Couldn't save your changes. Please try again.");
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
                <td className="px-2 py-1.5 min-w-[120px]"><Input size="cell" value={r.category} onChange={(e) => update(i, "category", e.target.value)} /></td>
                <td className="px-2 py-1.5 min-w-[200px]">
                  <Input size="cell" value={r.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Goal name" className="mb-1 font-medium" />
                  <Input size="cell" value={r.notes} onChange={(e) => update(i, "notes", e.target.value)} placeholder="Notes" className="text-ink-faint" />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]"><Input size="cell" value={r.goal} onChange={(e) => update(i, "goal", e.target.value)} /></td>
                <td className="px-2 py-1.5 min-w-[70px]"><Input size="cell" value={r.ltm} onChange={(e) => update(i, "ltm", e.target.value)} /></td>
                <td className="px-2 py-1.5 min-w-[70px]"><Input size="cell" value={r.ytdBud} onChange={(e) => update(i, "ytdBud", e.target.value)} /></td>
                <td className="px-2 py-1.5 min-w-[110px]"><Input size="cell" value={r.status} onChange={(e) => update(i, "status", e.target.value)} /></td>
                <td className="px-2 py-1.5 min-w-[90px]">
                  <NativeSelect size="cell" value={r.color} onChange={(e) => update(i, "color", e.target.value)}>
                    {COLORS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                  </NativeSelect>
                </td>
                <td className="px-2 py-1.5 min-w-[120px]"><Input size="cell" value={r.owner} onChange={(e) => update(i, "owner", e.target.value)} /></td>
                <td className="px-2 py-1.5 min-w-[150px]"><CodeMultiSelect options={cimOptions} value={toArr(r.cim)} onChange={(codes) => update(i, "cim", codes.join(", "))} placeholder="+ CIM" /></td>
                <td className="px-2 py-1.5 min-w-[170px]"><CodeMultiSelect options={siOptions} value={toArr(r.sis)} onChange={(codes) => update(i, "sis", codes.join(", "))} placeholder="+ SI" /></td>
                <td className="px-2 py-1.5">
                  <Button type="button" variant="faint" size="bare" onClick={() => remove(i)} title="Remove row" aria-label="Remove row" className="hover:text-risk">
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-fit">
        <Plus size={14} aria-hidden /> Add row
      </Button>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save scorecard"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" size="bare" onClick={onDone} className="text-sm hover:bg-transparent">Cancel</Button>
        )}
      </div>
    </form>
  );
}
