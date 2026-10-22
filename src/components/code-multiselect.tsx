"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CodeOption = { code: string; label: string };

// Chip + searchable picker for code references (CIM / SIs). Selected codes
// show as removable chips; the "+" trigger opens a type-to-filter list where
// each option toggles (so codes can be added or removed from the list too).
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
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const toggle = (code: string) => onChange(selected.has(code) ? value.filter((c) => c !== code) : [...value, code]);
  const noun = placeholder.replace(/^\+\s*/, "");

  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((code) => {
        const opt = options.find((o) => o.code === code);
        return (
          <span key={code} title={opt?.label} className="tabular inline-flex items-center gap-0.5 rounded bg-surface-2 py-0.5 pl-1.5 pr-0.5 text-[10px] font-medium text-ink-muted">
            {code}
            <Button
              type="button"
              variant="faint"
              size="bare"
              onClick={() => onChange(value.filter((c) => c !== code))}
              aria-label={`Remove ${code}`}
              className="rounded-sm p-0.5 hover:bg-risk-soft hover:text-risk"
            >
              <X size={10} aria-hidden />
            </Button>
          </span>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Add ${noun}`}
            className="inline-flex items-center gap-0.5 rounded border border-dashed border-border-strong px-1.5 py-0.5 text-[10px] text-ink-muted transition-colors hover:border-navy/50 hover:text-ink data-[state=open]:border-navy data-[state=open]:text-ink"
          >
            <Plus size={10} aria-hidden />
            {noun}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Command>
            <CommandInput placeholder={`Search ${noun} by code or name…`} />
            <CommandList>
              <CommandEmpty>No match.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const on = selected.has(o.code);
                  return (
                    <CommandItem key={o.code} value={`${o.code} ${o.label}`} onSelect={() => toggle(o.code)}>
                      <span
                        className={cn(
                          "grid size-3.5 shrink-0 place-items-center rounded-sm border",
                          on ? "border-navy bg-navy text-white" : "border-border-strong",
                        )}
                        aria-hidden
                      >
                        {on && <Check size={10} strokeWidth={3} />}
                      </span>
                      <span className="tabular shrink-0 font-medium text-ink">{o.code}</span>
                      <span className="truncate text-ink-muted">{o.label}</span>
                      {on && <span className="sr-only">(selected)</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            {value.length > 0 && (
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[11px] text-ink-muted">
                <span className="tabular">{value.length} selected</span>
                <button type="button" onClick={() => onChange([])} className="text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                  Clear
                </button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
