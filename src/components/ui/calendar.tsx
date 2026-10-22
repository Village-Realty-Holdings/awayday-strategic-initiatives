"use client";

import * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

// shadcn Calendar (react-day-picker v9) on the Awayday tokens. Keyboard:
// arrows move by day/week, PageUp/PageDown by month (Shift for year),
// Home/End to the week's ends. captionLayout="dropdown" adds month/year
// selects for jumping to far-off dates.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames();
  return (
    <DayPicker
      data-slot="calendar"
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("w-fit text-ink", className)}
      classNames={{
        root: d.root,
        months: "relative flex flex-col",
        month: "flex flex-col gap-2",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40",
        button_next:
          "inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40",
        month_caption: "flex h-8 items-center justify-center px-8",
        caption_label: cn(
          "select-none text-sm font-semibold text-ink",
          captionLayout !== "label" &&
            "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm hover:bg-surface-2 [&>svg]:text-ink-faint",
        ),
        dropdowns: "flex items-center gap-1",
        dropdown_root: "relative has-focus-visible:rounded-md has-focus-visible:outline-2 has-focus-visible:outline-ring",
        dropdown: "absolute inset-0 cursor-pointer opacity-0",
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday: "w-9 pb-1 text-center text-[11px] font-medium text-ink-faint",
        week: "flex",
        day: "group/day size-9 p-0 text-center text-sm",
        day_button:
          "inline-flex size-9 items-center justify-center rounded-md tabular-nums transition-colors hover:bg-surface-2 group-data-[selected=true]/day:bg-navy group-data-[selected=true]/day:font-medium group-data-[selected=true]/day:text-white group-data-[selected=true]/day:hover:bg-navy-deep",
        today: "[&>button]:font-semibold [&>button]:text-navy [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-navy/30",
        outside: "text-ink-faint/60",
        disabled: "opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) => {
          const Icon = orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : ChevronDown;
          return <Icon size={orientation === "down" ? 13 : 16} className={c} aria-hidden />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
