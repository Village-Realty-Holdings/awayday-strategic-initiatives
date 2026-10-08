"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  MONTHS,
  WEEKDAYS,
  addDays,
  formatDisplay,
  formatFull,
  monthWeeks,
  toISO,
  toParts,
  todayISO,
} from "@/lib/calendar";

// The app's one date control. A full-width button trigger (the whole field is
// clickable, unlike native <input type="date"> where only the tiny icon opens
// the picker in Chrome) plus a calendar popover styled on the app tokens.
//
// Two modes:
//  - uncontrolled (default): submits through the surrounding <form> via a hidden
//    input holding YYYY-MM-DD, so server actions' date parsing is untouched.
//  - controlled: pass `value` + `onChange` for React-state forms (e.g. wizards).
//
// Date math lives in @/lib/calendar (pure, unit-tested).

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
  const [view, setView] = useState(() => toParts(value || todayISO()));
  const [focused, setFocused] = useState(value || todayISO());

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const today = todayISO();

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openPicker = useCallback(() => {
    const base = value || todayISO();
    setView(toParts(base));
    setFocused(base);
    setOpen(true);
  }, [value]);

  // Outside click closes (pointerdown so it beats focus shifts).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus to the focused day whenever the popover is open.
  useEffect(() => {
    if (!open) return;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focused}"]`);
    btn?.focus();
  }, [open, focused, view]);

  const commit = (next: string) => {
    if (!isControlled) setUncontrolledValue(next);
    onChange?.(next);
  };

  const select = (iso: string) => {
    commit(iso);
    close(true);
  };

  const moveFocus = (delta: number) => {
    const next = addDays(focused, delta);
    const p = toParts(next);
    setFocused(next);
    if (p.y !== view.y || p.m !== view.m) setView({ ...p, d: 1 });
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      moveFocus(moves[e.key]);
    }
    // Enter / Space activate the focused day button natively.
  };

  const weeks = monthWeeks(view.y, view.m);
  const navBtn =
    "flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `${label}: ${formatDisplay(value)}` : label}
        onClick={() => (open ? close(true) : openPicker())}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-ink transition-colors focus:border-navy focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {value ? <span>{formatDisplay(value)}</span> : <span className="text-ink-faint">mm/dd/yyyy</span>}
        <CalendarDays size={15} aria-hidden className="shrink-0 text-ink-faint" />
      </button>

      {name && <input type="hidden" name={name} value={value} />}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close(true);
            }
          }}
          onBlur={(e) => {
            // Tabbing out of the popover closes it without stealing focus back.
            if (rootRef.current && !rootRef.current.contains(e.relatedTarget as Node)) setOpen(false);
          }}
          className={`dp-pop absolute top-full z-30 mt-1.5 w-max max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-3 shadow-lg ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView((v) => toParts(toISO(v.y, v.m - 1, 1)))}
              className={navBtn}
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <div aria-live="polite" className="text-sm font-semibold text-ink">
              {MONTHS[view.m]} {view.y}
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView((v) => toParts(toISO(v.y, v.m + 1, 1)))}
              className={navBtn}
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>

          <div className="mt-1 grid grid-cols-7">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                aria-hidden
                className="flex h-8 w-10 items-center justify-center text-[11px] font-medium text-ink-faint"
              >
                {wd}
              </div>
            ))}
          </div>

          <div ref={gridRef} role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`} onKeyDown={onGridKeyDown}>
            {weeks.map((week, w) => (
              <div key={w} role="row" className="grid grid-cols-7">
                {week.map((iso, i) =>
                  iso === null ? (
                    <div key={`pad-${i}`} role="gridcell" aria-hidden className="h-10 w-10" />
                  ) : (
                    <button
                      key={iso}
                      type="button"
                      role="gridcell"
                      data-iso={iso}
                      tabIndex={iso === focused ? 0 : -1}
                      aria-selected={iso === value}
                      aria-label={formatFull(iso)}
                      aria-current={iso === today ? "date" : undefined}
                      onClick={() => select(iso)}
                      className={`flex h-10 w-10 items-center justify-center rounded-md text-sm tabular-nums transition-colors ${
                        iso === value
                          ? "bg-navy font-medium text-white hover:bg-navy-deep"
                          : iso === today
                            ? "font-semibold text-navy hover:bg-surface-2"
                            : "text-ink hover:bg-surface-2"
                      }`}
                    >
                      {toParts(iso).d}
                    </button>
                  ),
                )}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => select(today)}
              className="rounded-md px-2.5 py-2 text-xs font-medium text-navy transition-colors hover:bg-surface-2"
            >
              Today
            </button>
            {clearable && (
              <button
                type="button"
                onClick={() => {
                  commit("");
                  close(true);
                }}
                className="rounded-md px-2.5 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
