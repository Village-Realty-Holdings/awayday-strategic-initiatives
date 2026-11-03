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
import { StatusBadge } from "@/components/badges";
import type { InitiativeStatus } from "@/generated/prisma/client";
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

export type BtlSi = {
  id: string;
  shortCode: string;
  name: string;
  goingFor: string | null;
  lead: string | null;
  status: InitiativeStatus | null;
  dueLabel: string;
};

export type BtlGroup = {
  areaId: string;
  areaCode: string;
  areaName: string;
  isEnabler: boolean;
  kindLabel: string;
  leads: string | null;
  sis: BtlSi[];
  rows: BtlRow[];
};

const STATUS_META: Record<BelowLineStatus, { label: string; variant: "ok" | "default" | "warn" | "risk" | "outline" | "secondary" }> = {
  DONE: { label: "Done", variant: "ok" },
  ON_TRACK: { label: "On-track", variant: "ok" },
  AT_RISK: { label: "At-risk", variant: "warn" },
  BLOCKED: { label: "Blocked", variant: "risk" },
  NOT_STARTED: { label: "Not started", variant: "outline" },
};

type StatusKey = BelowLineStatus | InitiativeStatus | "TBD";

const STATUS_FILTERS: { key: StatusKey; label: string }[] = [
  { key: "COMPLETE", label: "Complete" },
  { key: "ON_TRACK", label: "On-track" },
  { key: "AT_RISK", label: "At-risk" },
  { key: "OFF_TRACK", label: "Off-track" },
  { key: "BLOCKED", label: "Blocked" },
  { key: "NOT_STARTED", label: "Not started" },
  { key: "TBD", label: "No status" },
  { key: "DONE", label: "Done" },
];

const siStatusKey = (si: BtlSi): StatusKey => si.status ?? "TBD";

function AreaOptions({ groups }: { groups: BtlGroup[] }) {
  const pillars = groups.filter((g) => !g.isEnabler);
  const enablers = groups.filter((g) => g.isEnabler);
  return (
    <>
      {pillars.length > 0 && (
        <optgroup label="Value creation pillars">
          {pillars.map((g) => <option key={g.areaCode} value={g.areaCode}>{g.areaName}</option>)}
        </optgroup>
      )}
      {enablers.length > 0 && (
        <optgroup label="Enablers">
          {enablers.map((g) => <option key={g.areaCode} value={g.areaCode}>{g.areaName}</option>)}
        </optgroup>
      )}
    </>
  );
}

/** Files under the selected pillar or enabler; with none selected, asks which. */
function NewProjectForm({ groups, selected }: { groups: BtlGroup[]; selected: BtlGroup | null }) {
  const [picked, setPicked] = useState(groups[0]?.areaCode ?? "");
  const group = selected ?? groups.find((g) => g.areaCode === picked);
  return (
    <details className="rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        Add a below the line item{selected ? ` to ${selected.areaName}` : ""}
      </summary>
      <form action={createBelowLineProject} className="mt-4 grid gap-3 sm:grid-cols-2">
        {selected ? (
          <input type="hidden" name="strategicAreaId" value={selected.areaId} />
        ) : (
          <Label className="flex flex-col gap-1.5">
            Pillar or enabler
            <NativeSelect value={picked} onChange={(e) => setPicked(e.target.value)} required>
              <AreaOptions groups={groups} />
            </NativeSelect>
            <input type="hidden" name="strategicAreaId" value={group?.areaId ?? ""} />
          </Label>
        )}
        <Label className="flex flex-col gap-1.5">
          Feeds SI
          <NativeSelect key={group?.areaCode} name="initiativeId" defaultValue="">
            <option value="">No SI yet</option>
            {(group?.sis ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.shortCode} {s.name}</option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5 sm:col-span-2">
          Item name
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
          <Button type="submit" size="sm">Add item</Button>
        </div>
      </form>
    </details>
  );
}

export function BelowTheLineView({ groups, initialArea, canCreate }: { groups: BtlGroup[]; initialArea: string | null; canCreate: boolean }) {
  const [areaCode, setAreaCode] = useState(initialArea ?? "");
  const [filter, setFilter] = useState<StatusKey | "ALL">("ALL");
  const selected = groups.find((g) => g.areaCode === areaCode) ?? null;
  const inScope = selected ? [selected] : groups;

  const statuses: StatusKey[] = [...inScope.flatMap((g) => g.sis.map(siStatusKey)), ...inScope.flatMap((g) => g.rows.map((r) => r.status))];
  const count = (f: StatusKey | "ALL") => (f === "ALL" ? statuses.length : statuses.filter((s) => s === f).length);
  const visible = inScope
    .map((g) => ({
      ...g,
      sis: g.sis.filter((s) => filter === "ALL" || siStatusKey(s) === filter),
      rows: g.rows.filter((r) => filter === "ALL" || r.status === filter),
    }))
    .filter((g) => selected || g.sis.length + g.rows.length > 0);

  function onAreaChange(code: string) {
    setAreaCode(code);
    setFilter("ALL");
    // Keeps the choice in the URL, so a link or refresh lands on the same area.
    window.history.replaceState(null, "", code ? `/below-the-line?area=${encodeURIComponent(code)}` : "/below-the-line");
  }

  return (
    <div className="flex flex-col gap-5">
      <Label className="flex max-w-sm flex-col gap-1.5">
        Pillar or enabler
        <NativeSelect value={areaCode} onChange={(e) => onAreaChange(e.target.value)}>
          <option value="">All pillars and enablers</option>
          <AreaOptions groups={groups} />
        </NativeSelect>
      </Label>
      {canCreate && <NewProjectForm groups={groups} selected={selected} />}
      {statuses.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filter by status">
          <Button size="xs" variant={filter === "ALL" ? "default" : "outline"} aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>
            All {count("ALL")}
          </Button>
          {STATUS_FILTERS.filter((f) => count(f.key) > 0).map((f) => (
            <Button key={f.key} size="xs" variant={filter === f.key ? "default" : "outline"} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} {count(f.key)}
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
              <span className="text-xs font-normal text-ink-muted">
                {g.sis.length} Awayday SI{g.sis.length === 1 ? "" : "s"} · {g.rows.length} below the line
              </span>
            </CardTitle>
            {g.leads && <CardDescription>{g.leads}</CardDescription>}
          </CardHeader>
          <CardContent>
            {g.sis.length + g.rows.length === 0 ? (
              <p className="text-xs text-ink-faint">{filter === "ALL" ? "Nothing filed here yet." : "Nothing with this status."}</p>
            ) : (
              <div className="rounded-lg border border-border">
                <Table className="min-w-[52rem]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Initiative</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Feeds SI</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Next checkpoint</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.sis.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-normal">
                          <Link href={`/initiatives/${s.id}`} className="font-medium text-ink hover:text-navy-deep hover:underline">
                            <span className="tabular mr-1.5 text-micro font-normal text-ink-faint">{s.shortCode}</span>
                            {s.name}
                          </Link>
                          {s.goingFor && <p className="mt-0.5 text-note leading-4 text-ink-muted">{s.goingFor}</p>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap"><Badge variant="default">Awayday SI</Badge></TableCell>
                        <TableCell className="text-ink-faint">—</TableCell>
                        <TableCell className="whitespace-normal text-ink-muted">{s.lead ?? "TBD"}</TableCell>
                        <TableCell className="whitespace-nowrap"><StatusBadge status={s.status} /></TableCell>
                        <TableCell className="tabular whitespace-nowrap text-right text-ink-muted">{s.dueLabel}</TableCell>
                      </TableRow>
                    ))}
                    {g.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-normal">
                          <p className="font-medium text-ink">{r.name}</p>
                          {r.description && <p className="mt-0.5 text-note leading-4 text-ink-muted">{r.description}</p>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap"><Badge variant="outline">Below the line</Badge></TableCell>
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
            )}
          </CardContent>
        </Card>
      ))}
      {!selected && statuses.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
          No initiatives yet.{canCreate ? " Add the first below the line item above." : ""}
        </p>
      )}
      {!selected && statuses.length > 0 && visible.length === 0 && <p className="text-xs text-ink-faint">Nothing with this status.</p>}
    </div>
  );
}
