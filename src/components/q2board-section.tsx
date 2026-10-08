"use client";

import { useState } from "react";
import { Compass, Pencil, X, Plus, Trash2 } from "lucide-react";
import type { BoardItem } from "@/lib/sources";
import { CodeMultiSelect, type CodeOption } from "@/components/code-multiselect";
import { saveQ2Board } from "@/app/(app)/admin/q2board/actions";

// Editor-side row: cim/sis held as comma strings for the multi-select bridge.
type Row = { id: string; name: string; desc: string; owner: string; cim: string; sis: string; color: string };

const cell = "w-full rounded border border-border/70 bg-surface px-1.5 py-1 text-xs text-ink outline-none transition-colors focus:border-navy";
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
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2"
          >
            {editing ? <><X size={12} aria-hidden /> Close</> : <><Pencil size={12} aria-hidden /> Edit</>}
          </button>
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
  const [rows, setRows] = useState<Row[]>(items.map(toRow));
  const [saving, setSaving] = useState(false);

  const update = (i: number, key: keyof Row, value: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const add = () => setRows((rs) => [...rs, { id: "", name: "", desc: "", owner: "", cim: "", sis: "", color: "grey" }]);

  const handleSave = async (fd: FormData) => {
    setSaving(true);
    try {
      await saveQ2Board(fd);
      onDone();
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
              <th className="px-2 py-2 font-medium">Theme &amp; description</th>
              <th className="px-2 py-2 font-medium">Owner</th>
              <th className="px-2 py-2 font-medium">CIM</th>
              <th className="px-2 py-2 font-medium">SIs driving</th>
              <th className="px-2 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/50 align-top last:border-0">
                <td className="px-2 py-1.5 min-w-[260px]">
                  <input value={r.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Theme" className={`${cell} mb-1 font-medium`} />
                  <input value={r.desc} onChange={(e) => update(i, "desc", e.target.value)} placeholder="Description" className={`${cell} text-ink-faint`} />
                </td>
                <td className="px-2 py-1.5 min-w-[140px]"><input value={r.owner} onChange={(e) => update(i, "owner", e.target.value)} placeholder="Owner" className={cell} /></td>
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
        <Plus size={14} aria-hidden /> Add initiative
      </button>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button type="submit" disabled={saving} className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep disabled:opacity-60">
          {saving ? "Saving…" : "Save board initiatives"}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-ink-muted transition-colors hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
