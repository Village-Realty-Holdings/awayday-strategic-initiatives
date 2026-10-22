"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BtlStatus } from "../_mock/below-the-line";
import { MockNote } from "./preview";

export type BtlRow = {
  id: string;
  name: string;
  feeds: string;
  team: string;
  owner: string;
  status: BtlStatus;
  dueLabel: string;
  si: { code: string; shortCode: string; name: string } | null;
};

export type BtlGroup = {
  areaCode: string;
  areaName: string;
  kindLabel: string;
  leads: string;
  rows: BtlRow[];
};

const STATUS_META: Record<BtlStatus, { label: string; variant: "ok" | "default" | "warn" | "risk" | "outline" | "secondary" }> = {
  DONE: { label: "Done", variant: "ok" },
  ON_TRACK: { label: "On track", variant: "default" },
  AT_RISK: { label: "At risk", variant: "warn" },
  BLOCKED: { label: "Blocked", variant: "risk" },
  NOT_STARTED: { label: "Not started", variant: "outline" },
};

const FILTERS: (BtlStatus | "ALL")[] = ["ALL", "ON_TRACK", "AT_RISK", "BLOCKED", "NOT_STARTED", "DONE"];

export function BelowTheLineView({ groups }: { groups: BtlGroup[] }) {
  const [filter, setFilter] = useState<BtlStatus | "ALL">("ALL");
  const all = groups.flatMap((g) => g.rows);
  const count = (f: BtlStatus | "ALL") => (f === "ALL" ? all.length : all.filter((r) => r.status === f).length);
  const visible = groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => filter === "ALL" || r.status === filter) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="xs"
              variant={filter === f ? "default" : "outline"}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All" : STATUS_META[f].label} {count(f)}
            </Button>
          ))}
        </div>
        <MockNote>Mock projects: invented for the preview</MockNote>
      </div>

      {visible.map((g) => (
        <Card key={g.areaCode} id={`btl-${g.areaCode}`} className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {g.areaName}
              <Badge variant="secondary">{g.kindLabel}</Badge>
              <span className="text-xs font-normal text-ink-muted">{g.rows.length} project{g.rows.length === 1 ? "" : "s"}</span>
            </CardTitle>
            <CardDescription>{g.leads}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Project</TableHead>
                    <TableHead>Feeds SI</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Next checkpoint</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-normal">
                        <p className="font-medium text-ink">{r.name}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">{r.feeds}</p>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {r.si ? (
                          <Link href={`/v2/si/${r.si.code}`} className="text-ink hover:text-navy-deep hover:underline">
                            <span className="tabular mr-1.5 text-[10px] text-ink-faint">{r.si.shortCode}</span>
                            {r.si.name}
                          </Link>
                        ) : (
                          <span className="text-ink-faint">No SI yet</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal text-ink-muted">
                        {r.owner}
                        <span className="block text-[11px] text-ink-faint">{r.team}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={STATUS_META[r.status].variant}>{STATUS_META[r.status].label}</Badge>
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right text-ink-muted">{r.dueLabel}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
      {visible.length === 0 && <p className="text-xs text-ink-faint">No projects with this status.</p>}
    </div>
  );
}
