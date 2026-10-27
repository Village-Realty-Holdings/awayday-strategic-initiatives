"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createBelowLineProject } from "@/app/(app)/review-actions";
import { BELOW_LINE_STATUSES, type BelowLineStatus } from "@/lib/review-model";

export type BtlRow = {
  id: string;
  name: string;
  description: string | null;
  team: string | null;
  owner: string | null;
  status: BelowLineStatus;
  dueLabel: string;
  si: { id: string; shortCode: string; name: string } | null;
};

export type BtlGroup = {
  areaId: string;
  areaName: string;
  kindLabel: string;
  leads: string | null;
  sis: { id: string; shortCode: string; name: string }[];
  rows: BtlRow[];
};

const STATUS_META: Record<BelowLineStatus, { label: string; variant: "ok" | "default" | "warn" | "risk" | "outline" | "secondary" }> = {
  DONE: { label: "Done", variant: "ok" },
  ON_TRACK: { label: "On track", variant: "default" },
  AT_RISK: { label: "At risk", variant: "warn" },
  BLOCKED: { label: "Blocked", variant: "risk" },
  NOT_STARTED: { label: "Not started", variant: "outline" },
};

const FILTERS: (BelowLineStatus | "ALL")[] = ["ALL", "ON_TRACK", "AT_RISK", "BLOCKED", "NOT_STARTED", "DONE"];

function NewProjectForm({ groups }: { groups: BtlGroup[] }) {
  const [areaId, setAreaId] = useState(groups[0]?.areaId ?? "");
  const sis = groups.find((g) => g.areaId === areaId)?.sis ?? [];
  return (
    <details className="rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold text-ink">Add a project</summary>
      <form action={createBelowLineProject} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Label className="flex flex-col gap-1.5">
          Area
          <NativeSelect name="strategicAreaId" value={areaId} onChange={(e) => setAreaId(e.target.value)} required>
            {groups.map((g) => (
              <option key={g.areaId} value={g.areaId}>{g.areaName}</option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5">
          Feeds SI
          <NativeSelect name="initiativeId" defaultValue="">
            <option value="">No SI yet</option>
            {sis.map((s) => (
              <option key={s.id} value={s.id}>{s.shortCode} {s.name}</option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5 sm:col-span-2">
          Project name
          <Input name="name" required maxLength={200} />
        </Label>
        <Label className="flex flex-col gap-1.5 sm:col-span-2">
          What it does
          <Textarea name="description" rows={2} />
        </Label>
        <Label className="flex flex-col gap-1.5">
          Owner
          <Input name="owner" maxLength={120} />
        </Label>
        <Label className="flex flex-col gap-1.5">
          Team
          <Input name="team" maxLength={120} />
        </Label>
        <Label className="flex flex-col gap-1.5">
          Status
          <NativeSelect name="status" defaultValue="NOT_STARTED">
            {BELOW_LINE_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5">
          Next checkpoint
          <Input name="dueAt" type="date" />
        </Label>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">Add project</Button>
        </div>
      </form>
    </details>
  );
}

export function BelowTheLineView({ groups, canCreate }: { groups: BtlGroup[]; canCreate: boolean }) {
  const [filter, setFilter] = useState<BelowLineStatus | "ALL">("ALL");
  const all = groups.flatMap((g) => g.rows);
  const count = (f: BelowLineStatus | "ALL") => (f === "ALL" ? all.length : all.filter((r) => r.status === f).length);
  const visible = groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => filter === "ALL" || r.status === filter) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {canCreate && groups.length > 0 && <NewProjectForm groups={groups} />}
      {all.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Button key={f} size="xs" variant={filter === f ? "default" : "outline"} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "ALL" ? "All" : STATUS_META[f].label} {count(f)}
            </Button>
          ))}
        </div>
      )}

      {visible.map((g) => (
        <Card key={g.areaId} className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {g.areaName}
              <Badge variant="secondary">{g.kindLabel}</Badge>
              <span className="text-xs font-normal text-ink-muted">{g.rows.length} project{g.rows.length === 1 ? "" : "s"}</span>
            </CardTitle>
            {g.leads && <CardDescription>{g.leads}</CardDescription>}
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
                        {r.description && <p className="mt-0.5 text-note leading-4 text-ink-muted">{r.description}</p>}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {r.si ? (
                          <Link href={`/initiatives/${r.si.id}`} className="text-ink hover:text-navy-deep hover:underline">
                            <span className="tabular mr-1.5 text-micro text-ink-faint">{r.si.shortCode}</span>
                            {r.si.name}
                          </Link>
                        ) : (
                          <span className="text-ink-faint">No SI yet</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal text-ink-muted">
                        {r.owner ?? "TBD"}
                        {r.team && <span className="block text-note text-ink-faint">{r.team}</span>}
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
      {all.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
          No below-the-line projects yet.{canCreate && groups.length > 0 ? " Add the first one above." : ""}
        </p>
      )}
      {all.length > 0 && visible.length === 0 && <p className="text-xs text-ink-faint">No projects with this status.</p>}
    </div>
  );
}
