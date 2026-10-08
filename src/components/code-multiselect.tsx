"use client";

import { X } from "lucide-react";

export type CodeOption = { code: string; label: string };

// Chip + dropdown multi-select for code references (CIM / SIs). Selected codes
// show as removable chips; the dropdown lists the remaining options with labels.
// Value/onChange work in arrays; callers bridge to comma strings as needed.
export function CodeMultiSelect({
  options,
  value,
  onChange,
  placeholder = "+ add",
}: {
  options: CodeOption[];
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
}) {
  const selected = new Set(value);
  const available = options.filter((o) => !selected.has(o.code));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((code) => {
        const opt = options.find((o) => o.code === code);
        return (
          <span key={code} title={opt?.label} className="tabular inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
            {code}
            <button type="button" onClick={() => onChange(value.filter((c) => c !== code))} title={`Remove ${code}`} className="text-ink-faint transition-colors hover:text-risk">
              <X size={10} aria-hidden />
            </button>
          </span>
        );
      })}
      <select
        value=""
        onChange={(e) => { if (e.target.value) onChange([...value, e.target.value]); }}
        className="rounded border border-border/70 bg-surface px-1.5 py-0.5 text-[10px] text-ink-muted outline-none transition-colors focus:border-navy"
      >
        <option value="">{placeholder}</option>
        {available.map((o) => (
          <option key={o.code} value={o.code}>{o.code} — {o.label}</option>
        ))}
      </select>
    </div>
  );
}
