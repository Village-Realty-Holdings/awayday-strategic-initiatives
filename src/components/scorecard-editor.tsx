"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "@/components/icons";
import type { Goal } from "@/lib/sources";
import { CodeMultiSelect, type CodeOption } from "@/components/code-multiselect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEditableRows } from "@/components/use-editable-rows";
import { saveScorecard } from "@/app/(app)/settings/admin/scorecard/actions";

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

export function ScorecardEditor({
  goals,
  onDone,
  siOptions,
  cimOptions,
  onSave = saveScorecard,
}: {
  goals: Goal[];
  onDone?: () => void;
  siOptions: CodeOption[];
  cimOptions: CodeOption[];
  /** Injectable so /dev/comparison can render the editor without saving. */
  onSave?: (fd: FormData) => Promise<unknown>;
}) {
  const [initial] = useState(() => goals.map(toRow));
  const { rows, update, add: addRow, remove, addedIndex, dirty } = useEditableRows<Row>(initial);
  const [saving, setSaving] = useState(false);

  const add = () =>
    addRow({ category: rows[rows.length - 1]?.category ?? "", name: "", goal: "", ltm: "", ytdBud: "", status: "", color: "grey", owner: "", cim: "", sis: "", notes: "" });

  const handleSave = async (fd: FormData) => {
    setSaving(true);
    try {
      await onSave(fd);
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

      <Table size="compact" containerClassName="rounded-xl border border-border bg-surface">
        <TableHeader>
          <TableRow className="[&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wide">
            <TableHead>Category</TableHead>
            <TableHead>Goal &amp; notes</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>LTM</TableHead>
            <TableHead>YTD Bud</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>CIM</TableHead>
            <TableHead>SIs</TableHead>
            <TableHead><span className="sr-only">Remove</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <TableEmpty colSpan={11}>No goals yet. Add a row to start the scorecard.</TableEmpty>}
          {rows.map((r, i) => (
            <TableRow key={i} className="align-top">
              <TableCell className="min-w-[120px]"><Input size="cell" value={r.category} onChange={(e) => update(i, "category", e.target.value)} aria-label="Category" /></TableCell>
              <TableCell className="min-w-[200px]">
                <Input size="cell" value={r.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Goal name" aria-label="Goal name" autoFocus={i === addedIndex} className="mb-1 font-medium" />
                <Input size="cell" value={r.notes} onChange={(e) => update(i, "notes", e.target.value)} placeholder="Notes" aria-label="Notes" className="text-ink-faint" />
              </TableCell>
              <TableCell className="min-w-[80px]"><Input size="cell" value={r.goal} onChange={(e) => update(i, "goal", e.target.value)} aria-label="Target" className="tabular" /></TableCell>
              <TableCell className="min-w-[70px]"><Input size="cell" value={r.ltm} onChange={(e) => update(i, "ltm", e.target.value)} aria-label="LTM" className="tabular" /></TableCell>
              <TableCell className="min-w-[70px]"><Input size="cell" value={r.ytdBud} onChange={(e) => update(i, "ytdBud", e.target.value)} aria-label="YTD budget" className="tabular" /></TableCell>
              <TableCell className="min-w-[110px]"><Input size="cell" value={r.status} onChange={(e) => update(i, "status", e.target.value)} aria-label="Status" /></TableCell>
              <TableCell className="min-w-[90px]">
                <NativeSelect size="cell" value={r.color} onChange={(e) => update(i, "color", e.target.value)} aria-label="Color">
                  {COLORS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                </NativeSelect>
              </TableCell>
              <TableCell className="min-w-[120px]"><Input size="cell" value={r.owner} onChange={(e) => update(i, "owner", e.target.value)} aria-label="Owner" /></TableCell>
              <TableCell className="min-w-[150px]"><CodeMultiSelect options={cimOptions} value={toArr(r.cim)} onChange={(codes) => update(i, "cim", codes.join(", "))} placeholder="+ CIM" /></TableCell>
              <TableCell className="min-w-[170px]"><CodeMultiSelect options={siOptions} value={toArr(r.sis)} onChange={(codes) => update(i, "sis", codes.join(", "))} placeholder="+ SI" /></TableCell>
              <TableCell>
                <Button type="button" variant="faint" size="icon-sm" onClick={() => remove(i)} title="Remove row" aria-label={`Remove ${r.name || "row"}`} className="rounded-md hover:bg-risk-soft hover:text-risk">
                  <Trash2 size={14} aria-hidden />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-fit">
        <Plus size={14} aria-hidden /> Add row
      </Button>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save scorecard"}
        </Button>
        {dirty && !saving && <span className="text-xs text-warn">Unsaved changes</span>}
        {onDone && (
          <Button type="button" variant="ghost" size="bare" onClick={onDone} className="text-sm hover:bg-transparent">Cancel</Button>
        )}
      </div>
    </form>
  );
}
