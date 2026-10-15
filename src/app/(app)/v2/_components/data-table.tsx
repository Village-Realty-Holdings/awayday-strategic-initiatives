import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Numbers render in the tabular font and never wrap. */
  numeric?: boolean;
  className?: string;
};

export type DataRow = {
  id: string;
  cells: Record<string, ReactNode>;
  bold?: boolean;
};

/**
 * Small shadcn Table wrapper used across the V2 review sections. The Table
 * primitive already wraps itself in an overflow-x container, so wide tables
 * scroll inside the card at phone width.
 */
export function DataTable({
  columns,
  rows,
  minWidth = "28rem",
  caption,
}: {
  columns: DataColumn[];
  rows: DataRow[];
  /** Tailwind arbitrary min width so narrow screens scroll instead of squashing. */
  minWidth?: string;
  caption?: string;
}) {
  return (
    <div className="rounded-lg border border-border">
      <Table style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c, i) => (
              <TableHead key={c.key} className={cn(c.align === "right" || (c.numeric && c.align !== "left") ? "text-right" : "text-left", i === 0 && "text-left", c.className)}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={r.bold ? "font-semibold text-ink" : "text-ink-muted"}>
              {columns.map((c, i) => {
                const right = i > 0 && (c.align === "right" || (c.numeric && c.align !== "left"));
                return i === 0 ? (
                  <TableCell key={c.key} className={cn("whitespace-normal font-medium text-ink", c.className)}>
                    {r.cells[c.key]}
                  </TableCell>
                ) : (
                  <TableCell key={c.key} className={cn(right && "text-right", c.numeric ? "tabular" : "whitespace-normal", c.className)}>
                    {r.cells[c.key]}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Colours a signed delta: positive ok, negative risk. */
export function Delta({ value, suffix = "", prefix = "", digits }: { value: number; suffix?: string; prefix?: string; digits?: number }) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return (
    <span className={value > 0 ? "text-ok" : value < 0 ? "text-risk" : "text-ink-muted"}>
      {sign}
      {prefix}
      {Math.abs(value).toFixed(digits ?? (Number.isInteger(value) ? 0 : 1))}
      {suffix}
    </span>
  );
}
