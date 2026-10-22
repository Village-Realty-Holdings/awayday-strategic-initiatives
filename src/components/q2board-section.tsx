"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Compass, Pencil, X, Plus, Trash2 } from "lucide-react";
import type { BoardItem } from "@/lib/sources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeMultiSelect, type CodeOption } from "@/components/code-multiselect";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEditableRows } from "@/components/use-editable-rows";
import { saveQ2Board } from "@/app/(app)/settings/admin/q2board/actions";

// Editor-side row: cim/sis held as comma strings for the multi-select bridge.
type Row = { id: string; name: string; desc: string; owner: string; cim: string; sis: string; color: string };

const toArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function toRow(b: BoardItem): Row {
  return { id: b.id, name: b.name, desc: b.desc, owner: b.owner, cim: b.cim.join(", "), sis: b.sis.join(", "), color: b.color };
}

// Inline Q2 board: read view (children) with an Edit toggle that swaps in the
// editable table in place. No page nav.
export function Q2BoardSection({
  items,
  editable,
  siOptions,
  cimOptions,
  children,
}: {
  items: BoardItem[];
  editable: boolean;
  siOptions: CodeOption[];
  cimOptions: CodeOption[];
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Compass size={15} className="text-navy" aria-hidden /> Q2 2026 Board Initiatives — focus through 6/30
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
      <div className="mb-3" />
      {editing ? (
        <Q2Editor items={items} siOptions={siOptions} cimOptions={cimOptions} onDone={() => setEditing(false)} />
      ) : (
        children
      )}
    </section>
  );
}

function Q2Editor({ items, siOptions, cimOptions, onDone }: { items: BoardItem[]; siOptions: CodeOption[]; cimOptions: CodeOption[]; onDone: () => void }) {
  const [initial] = useState(() => items.map(toRow));
  const { rows, update, add: addRow, remove, addedIndex, dirty } = useEditableRows<Row>(initial, "Initiative");
  const [saving, setSaving] = useState(false);

  const add = () => addRow({ id: "", name: "", desc: "", owner: "", cim: "", sis: "", color: "grey" });

  const handleSave = async (fd: FormData) => {
    setSaving(true);
    try {
      await saveQ2Board(fd);
      toast.success("Q2 board saved");
      onDone();
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
            <TableHead>Theme &amp; description</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>CIM</TableHead>
            <TableHead>SIs driving</TableHead>
            <TableHead><span className="sr-only">Remove</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <TableEmpty colSpan={5}>No board initiatives yet. Add one to start.</TableEmpty>}
          {rows.map((r, i) => (
            <TableRow key={i} className="align-top">
              <TableCell className="min-w-[260px]">
                <Input size="cell" value={r.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Theme" aria-label="Theme" autoFocus={i === addedIndex} className="mb-1 font-medium" />
                <Input size="cell" value={r.desc} onChange={(e) => update(i, "desc", e.target.value)} placeholder="Description" aria-label="Description" className="text-ink-faint" />
              </TableCell>
              <TableCell className="min-w-[140px]"><Input size="cell" value={r.owner} onChange={(e) => update(i, "owner", e.target.value)} placeholder="Owner" aria-label="Owner" /></TableCell>
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
        <Plus size={14} aria-hidden /> Add initiative
      </Button>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save board initiatives"}
        </Button>
        {dirty && !saving && <span className="text-xs text-warn">Unsaved changes</span>}
        <Button type="button" variant="ghost" size="bare" onClick={onDone} className="text-sm hover:bg-transparent">Cancel</Button>
      </div>
    </form>
  );
}
