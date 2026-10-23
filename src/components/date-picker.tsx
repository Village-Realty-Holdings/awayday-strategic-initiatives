"use client";

import { useState } from "react";
import { CalendarDays } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDisplay, toISO, toParts, todayISO } from "@/lib/calendar";

// The app's one date control: a full-width field-style trigger (the whole
// field is clickable, unlike native <input type="date"> where only the tiny
// icon opens the picker in Chrome) plus a shadcn Popover + Calendar. The
// popover portals to <body>, so scrolling cards never clip it, and it flips
// when there's no room below.
//
// Two modes:
//  - uncontrolled (default): submits through the surrounding <form> via a hidden
//    input holding YYYY-MM-DD, so server actions' date parsing is untouched.
//  - controlled: pass `value` + `onChange` for React-state forms (e.g. wizards).
//
// Date math lives in @/lib/calendar (pure, unit-tested).

const toDate = (iso: string) => {
  const { y, m, d } = toParts(iso);
  return new Date(y, m, d);
};
const fromDate = (d: Date) => toISO(d.getFullYear(), d.getMonth(), d.getDate());

/** Last day of the calendar quarter containing `iso`. */
function endOfQuarter(iso: string): string {
  const { y, m } = toParts(iso);
  return toISO(y, Math.floor(m / 3) * 3 + 3, 0);
}

export function DatePicker({
  name,
  label,
  defaultValue = "",
  value: controlledValue,
  onChange,
  clearable = false,
  align = "start",
  disabled = false,
  id,
}: {
  /** Form field name. Omit only in controlled mode outside a form. */
  name?: string;
  /** Accessible name for the trigger and dialog (the visible label is a separate element). */
  label: string;
  /** Initial value, YYYY-MM-DD. Empty string = unset. Uncontrolled mode only. */
  defaultValue?: string;
  /** Controlled value, YYYY-MM-DD. Pass with onChange. */
  value?: string;
  /** Called with the new YYYY-MM-DD ("" when cleared). */
  onChange?: (value: string) => void;
  /** Show a Clear action in the popover footer (for optional dates). */
  clearable?: boolean;
  /** Popover anchoring edge, for fields near the right edge of the form. */
  align?: "start" | "end";
  disabled?: boolean;
  id?: string;
}) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : uncontrolledValue;

  const [open, setOpen] = useState(false);
  // Month on display; reset to the selected (or current) month on every open.
  const [month, setMonth] = useState(() => toDate(value || todayISO()));
  const today = todayISO();
  const thisYear = toParts(today).y;

  const commit = (next: string) => {
    if (!isControlled) setUncontrolledValue(next);
    onChange?.(next);
  };
  const pick = (next: string) => {
    commit(next);
    setOpen(false);
  };

  const quick = [
    { label: "Today", iso: today },
    { label: "End of quarter", iso: endOfQuarter(today) },
    { label: "End of year", iso: toISO(thisYear, 11, 31) },
  ];

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setMonth(toDate(value || today));
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={value ? `${label}: ${formatDisplay(value)}` : label}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-ink transition-colors outline-none hover:border-border-strong focus-visible:border-navy focus-visible:ring-2 focus-visible:ring-navy/25 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-navy data-[state=open]:ring-2 data-[state=open]:ring-navy/25"
        >
          {value ? <span>{formatDisplay(value)}</span> : <span className="text-ink-faint">mm/dd/yyyy</span>}
          <CalendarDays size={15} aria-hidden className="shrink-0 text-ink-faint" />
        </button>
      </PopoverTrigger>
      {name && <input type="hidden" name={name} value={value} />}

      <PopoverContent align={align} aria-label={label} className="w-auto p-3">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={new Date(thisYear - 5, 0)}
          endMonth={new Date(thisYear + 10, 11)}
          month={month}
          onMonthChange={setMonth}
          selected={value ? toDate(value) : undefined}
          onSelect={(d) => d && pick(fromDate(d))}
          autoFocus
        />
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border pt-2">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => pick(q.iso)}
              title={formatDisplay(q.iso)}
              className="rounded-md px-2 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-surface-2"
            >
              {q.label}
            </button>
          ))}
          {clearable && value && (
            <button
              type="button"
              onClick={() => pick("")}
              className="ml-auto rounded-md px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
