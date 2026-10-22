"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { UpdateState } from "../_mock/types";
import type { EditorSiRow } from "./review-editor";
import { UpdateStateBadge } from "./status";

type Filter = UpdateState | "ALL";

const FILTERS: [Filter, string][] = [
  ["ALL", "All"],
  ["SUBMITTED", "Submitted"],
  ["DRAFT", "Draft"],
  ["NOT_SUBMITTED", "Not submitted"],
];

const EMPTY: Record<Filter, string> = {
  ALL: "No SIs in this review yet.",
  SUBMITTED: "No SIs submitted yet.",
  DRAFT: "No SIs in draft.",
  NOT_SUBMITTED: "Every SI has started its update.",
};

// "SI submission status" block of the review editor: filter chips by update
// state plus the SI table.
export function SiSubmissionStatus({ sis }: { sis: EditorSiRow[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const counts: Record<Filter, number> = { ALL: sis.length, SUBMITTED: 0, DRAFT: 0, NOT_SUBMITTED: 0 };
  for (const s of sis) counts[s.state] += 1;
  const rows = sis.filter((s) => filter === "ALL" || s.state === filter);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">SI submission status</h2>
        <ToggleGroup
          type="single"
          variant="chip"
          size="sm"
          value={filter}
          // Single-select chips never clear: clicking the active chip keeps it.
          onValueChange={(v) => v && setFilter(v as Filter)}
          aria-label="Filter SIs by update state"
        >
          {FILTERS.map(([k, label]) => (
            <ToggleGroupItem key={k} value={k} className="group rounded-md">
              {label}
              <span className="tabular rounded bg-surface-2 px-1 text-[10px] text-ink-muted group-data-[state=on]:bg-white/60">
                {counts[k]}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Table containerClassName="rounded-xl border border-border bg-surface" className="min-w-[40rem]">
        <TableHeader>
          <TableRow>
            <TableHead>SI</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>This month</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <TableEmpty colSpan={4}>{EMPTY[filter]}</TableEmpty>}
          {rows.map((s) => (
            <TableRow key={s.code}>
              <TableCell>
                <Link href={`/v2/si/${s.code}`} className="font-medium text-ink underline-offset-2 hover:text-navy-deep hover:underline">
                  <span className="tabular mr-2 text-[10px] text-ink-faint">{s.shortCode}</span>
                  {s.name}
                </Link>
              </TableCell>
              <TableCell className="text-ink-muted">{s.area}</TableCell>
              <TableCell className="whitespace-nowrap text-ink-muted">{s.owner}</TableCell>
              <TableCell className="whitespace-nowrap"><UpdateStateBadge state={s.state} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-2 text-[11px] text-ink-faint">Nothing on this page is saved. Owners submit from My SIs.</p>
    </section>
  );
}
