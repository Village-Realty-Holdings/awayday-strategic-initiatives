"use client";

// SNAPSHOT of the done-checklist and status radios in
// src/app/(app)/v2/_components/my-updates.tsx before the shadcn Checkbox +
// RadioGroup migration, kept only for /dev/comparison.
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { SiStatus } from "@/app/(app)/v2/_mock/types";
import type { MyItem } from "@/app/(app)/v2/_components/my-updates";
import { SI_STATUS_META, SI_STATUS_ORDER } from "@/app/(app)/v2/_components/status";

export function LegacyItemChecklist({ title, items }: { title: string; items: MyItem[] }) {
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.id, i.done])));
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-ink">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-navy)]"
                checked={!!done[i.id]}
                onChange={(e) => setDone((d) => ({ ...d, [i.id]: e.target.checked }))}
              />
              <span className={done[i.id] ? "line-through" : ""}>
                {i.text} <span className="text-ink-faint">· {i.dueLabel}</span>
                {i.pastDue && !done[i.id] && <Badge variant="warn" className="ml-1.5">Needs a status</Badge>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LegacySiStatusPicker({ name, label, value, onChange }: { name: string; label: string; value: SiStatus | null; onChange: (s: SiStatus) => void }) {
  const status = value;
  const setStatus = onChange;
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {SI_STATUS_ORDER.map((s) => (
        <label
          key={s}
          className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
            status === s ? "border-navy bg-navy/10 font-medium text-navy-deep" : "border-border text-ink-muted hover:bg-surface-2"
          }`}
        >
          <input type="radio" name={name} className="sr-only" checked={status === s} onChange={() => setStatus(s)} />
          <span aria-hidden className="text-[9px]">{SI_STATUS_META[s].glyph}</span>
          {SI_STATUS_META[s].label}
        </label>
      ))}
    </div>
  );
}
