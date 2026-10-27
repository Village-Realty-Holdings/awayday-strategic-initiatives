"use client";

import { useId, useState } from "react";
import { Search } from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Item = { id: string; code: string; name: string };

// Multi-select list of initiatives for server-action forms (CIM risk links,
// group membership). Each tick posts `name=<id>` like a native checkbox, so
// the actions read it with fd.getAll(name) unchanged. Items filtered out by
// the search are hidden, not unmounted, so their ticks still submit.
export function InitiativeChecklist({
  name,
  initiatives,
  defaultSelected = [],
  emptyText = "No initiatives yet.",
  className = "max-h-56",
}: {
  name: string;
  initiatives: Item[];
  defaultSelected?: string[];
  emptyText?: string;
  /** Height cap for the scrolling list. */
  className?: string;
}) {
  const [selected, setSelected] = useState(() => new Set(defaultSelected));
  const [q, setQ] = useState("");
  const searchId = useId();
  const needle = q.trim().toLowerCase();
  const matches = (i: Item) => !needle || `${i.code} ${i.name}`.toLowerCase().includes(needle);
  const visible = initiatives.filter(matches);

  const set = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setVisible = (on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const i of visible) {
        if (on) next.add(i.id);
        else next.delete(i.id);
      }
      return next;
    });

  if (initiatives.length === 0) {
    return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-ink-faint">{emptyText}</p>;
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <label htmlFor={searchId} className="sr-only">Filter initiatives</label>
        <div className="relative min-w-40 flex-1">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            id={searchId}
            size="xs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            // Enter would submit the surrounding form; keep it for filtering.
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Filter by code or name…"
            className="w-full pl-7"
          />
        </div>
        <span className="tabular text-note text-ink-muted" aria-live="polite">
          {selected.size} of {initiatives.length} selected
        </span>
        <button type="button" onClick={() => setVisible(true)} className="text-note text-navy underline-offset-2 hover:underline">
          Select {needle ? "shown" : "all"}
        </button>
        <button type="button" onClick={() => setVisible(false)} className="text-note text-ink-muted underline-offset-2 hover:text-ink hover:underline">
          Clear
        </button>
      </div>
      <div className={`grid grid-cols-1 gap-x-4 gap-y-0.5 overflow-y-auto p-2 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
        {initiatives.map((i) => (
          <Label
            key={i.id}
            hidden={!matches(i)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs font-normal text-ink transition-colors hover:bg-surface-2 has-data-[state=checked]:bg-navy/5"
          >
            <Checkbox name={name} value={i.id} checked={selected.has(i.id)} onCheckedChange={(c) => set(i.id, c === true)} />
            <span className="truncate" title={`${i.code} · ${i.name}`}>
              <span className="tabular text-ink-faint">{i.code}</span> {i.name}
            </span>
          </Label>
        ))}
        {visible.length === 0 && <p className="col-span-full py-3 text-center text-xs text-ink-faint">No initiatives match “{q}”.</p>}
      </div>
    </div>
  );
}
