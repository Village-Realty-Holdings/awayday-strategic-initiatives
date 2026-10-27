"use client";

import { useState } from "react";
import { Plus, X } from "@/components/icons";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// One of the charter's tables (risks, dependencies, milestones) as editable
// rows. The rows post as JSON in a hidden input named `name`; the server
// matches them to stored rows by id (src/lib/charter-rows.ts).

export type RowColumn = {
  key: string;
  label: string;
  placeholder?: string;
  /** "long" grows with its text; "person" offers the People directory; "date" is a date picker (YYYY-MM-DD). */
  kind?: "text" | "long" | "person" | "date";
  /** CSS grid track for this column on wider screens. */
  width?: string;
};

type Row = Record<string, string> & { _k: string };

let seq = 0;
const key = () => `r${++seq}`;

export function CharterRowsEditor({
  name,
  rowLabel,
  columns,
  initialRows,
  addLabel,
  emptyText,
  peopleListId,
}: {
  name: string;
  /** What one row is ("Risk"), for the inputs' accessible names: "Risk 2 owner". */
  rowLabel: string;
  columns: RowColumn[];
  initialRows: Record<string, string | undefined>[];
  addLabel: string;
  emptyText: string;
  peopleListId: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows.map((r) => ({ ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ""])), _k: key() }) as Row),
  );
  const blank = (): Row => ({ ...Object.fromEntries(columns.map((c) => [c.key, ""])), _k: key() }) as Row;
  const set = (k: string, field: string, value: string) => setRows((rs) => rs.map((r) => (r._k === k ? { ...r, [field]: value } : r)));
  const remove = (k: string) => setRows((rs) => rs.filter((r) => r._k !== k));
  // The React key stays client-side.
  const posted = JSON.stringify(rows, (k, v) => (k === "_k" ? undefined : v));
  const template = `${columns.map((c) => c.width ?? "minmax(0,1fr)").join(" ")} 2rem`;

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={posted} />
      {rows.length > 0 && (
        <div className="hidden gap-2 sm:grid" style={{ gridTemplateColumns: template }} aria-hidden>
          {columns.map((c) => (
            <span key={c.key} className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">{c.label}</span>
          ))}
        </div>
      )}
      {rows.length === 0 && <p className="text-note text-ink-faint">{emptyText}</p>}
      <ol className="grid gap-3 sm:gap-2">
        {rows.map((row, index) => (
          <li
            key={row._k}
            className="grid grid-cols-[minmax(0,1fr)_2rem] items-start gap-2 rounded-md border border-border/70 p-2 sm:grid-cols-(--row-cols) sm:border-0 sm:p-0"
            style={{ "--row-cols": template } as React.CSSProperties}
          >
            {columns.map((c) => {
              const label = `${rowLabel} ${index + 1} ${c.label.toLowerCase()}`;
              return (
                <div key={c.key} className="col-start-1 min-w-0 sm:col-auto">
                  {c.kind === "date" ? (
                    <DatePicker value={row[c.key]} onChange={(v) => set(row._k, c.key, v)} label={label} clearable align="end" />
                  ) : c.kind === "long" ? (
                    <Textarea
                      size="sm"
                      rows={1}
                      value={row[c.key]}
                      onChange={(e) => set(row._k, c.key, e.target.value)}
                      placeholder={c.placeholder ?? c.label}
                      aria-label={label}
                      className="field-sizing-content w-full resize-none"
                    />
                  ) : (
                    <Input
                      size="sm"
                      value={row[c.key]}
                      onChange={(e) => set(row._k, c.key, e.target.value)}
                      placeholder={c.placeholder ?? c.label}
                      aria-label={label}
                      className="w-full"
                      list={c.kind === "person" ? peopleListId : undefined}
                    />
                  )}
                </div>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(row._k)}
              aria-label={`Remove ${rowLabel.toLowerCase()} ${index + 1}`}
              className="col-start-2 row-start-1 text-ink-faint hover:text-risk sm:col-auto sm:row-auto"
            >
              <X size={14} aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="xs" onClick={() => setRows((rs) => [...rs, blank()])} className="w-fit px-2.5">
        <Plus size={12} aria-hidden /> {addLabel}
      </Button>
    </div>
  );
}
