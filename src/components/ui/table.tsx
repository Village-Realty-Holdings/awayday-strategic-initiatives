"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// shadcn Table on the Awayday tokens.
//  - `containerClassName` styles the scroll wrapper (e.g. the bordered card),
//    so callers never nest a second overflow div around it.
//  - `size="compact"` tightens cell padding for inline-edit grids.
//  - `stickyHeader` caps the height and pins the header row while the body
//    scrolls (sticky needs the scroll container to be the table's own).
//  - Rows only highlight on hover when marked `data-interactive` (clickable
//    rows) or selected; static rows stay still.
//  - Cells wrap by default; add `whitespace-nowrap` where a column must not.

type TableProps = React.ComponentProps<"table"> & {
  containerClassName?: string
  size?: "default" | "compact"
  stickyHeader?: boolean
}

function Table({ className, containerClassName, size = "default", stickyHeader = false, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto",
        stickyHeader && "max-h-[calc(100dvh-14rem)] overflow-y-auto",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        data-size={size}
        data-sticky={stickyHeader || undefined}
        className={cn("group/table w-full caption-bottom border-collapse text-xs", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-surface-2 [&_tr]:border-b [&_tr]:border-border group-data-[sticky]/table:[&_th]:sticky group-data-[sticky]/table:[&_th]:top-0 group-data-[sticky]/table:[&_th]:z-10 group-data-[sticky]/table:[&_th]:bg-surface-2 group-data-[sticky]/table:[&_th]:shadow-[inset_0_-1px_0_var(--color-border)]",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t-2 border-border bg-surface-2/40 font-medium text-ink [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/60 transition-colors data-[interactive]:cursor-pointer data-[interactive]:hover:bg-surface-2/60 data-[state=selected]:bg-navy/5",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-3 text-left align-middle text-note font-medium whitespace-nowrap text-ink-muted group-data-[size=compact]/table:h-8 group-data-[size=compact]/table:px-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2 align-middle group-data-[size=compact]/table:px-2 group-data-[size=compact]/table:py-1.5 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-ink-muted", className)}
      {...props}
    />
  )
}

/** Full-width placeholder row for a table with no data. */
function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr data-slot="table-empty">
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-ink-faint">
        {children}
      </td>
    </tr>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
}
