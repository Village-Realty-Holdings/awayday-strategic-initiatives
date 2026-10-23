"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, Upload } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DataSourceKind, DataSourceStatus } from "../_mock/data-inputs";
import { MockNote } from "./preview";
import { fmtInt } from "./stat";

export type DataSourceRow = {
  id: string;
  name: string;
  artifact: string;
  kind: DataSourceKind;
  owner: string;
  cadence: string;
  feeds: string[];
  /** Pre-formatted so server and client agree. */
  lastLoadedLabel: string;
  lastLoadedBy: string;
  ageLabel: string;
  status: DataSourceStatus;
  rows: number;
  note?: string;
};

type LogEntry = { id: string; when: string; source: string; what: string; by: string };

const STATUS_META: Record<DataSourceStatus, { label: string; variant: "ok" | "warn" | "outline" }> = {
  LOADED: { label: "Loaded", variant: "ok" },
  DRAFT: { label: "Draft loaded", variant: "warn" },
  PENDING: { label: "Waiting", variant: "outline" },
};

export function DataInputsView({
  sources: initial,
  initialLog,
  todayLabel,
  periodLabel,
  canLoad,
}: {
  sources: DataSourceRow[];
  initialLog: LogEntry[];
  todayLabel: string;
  periodLabel: string;
  canLoad: boolean;
}) {
  const [sources, setSources] = useState(initial);
  const [log, setLog] = useState(initialLog);
  const [picked, setPicked] = useState<Record<string, { name: string; size: number } | undefined>>({});

  const finals = sources.filter((s) => s.status === "LOADED").length;

  function load(id: string) {
    const src = sources.find((s) => s.id === id);
    if (!src) return;
    const file = picked[id];
    if (src.kind === "FILE" && !file) return;
    const what = src.kind === "FILE" && file ? file.name : `${src.name} sync`;
    setSources((l) =>
      l.map((s) =>
        s.id === id
          ? {
              ...s,
              artifact: src.kind === "FILE" && file ? file.name : s.artifact,
              lastLoadedLabel: todayLabel,
              ageLabel: "today",
              lastLoadedBy: "You (mock)",
              status: "LOADED",
              rows: file ? Math.max(1, Math.round(file.size / 64)) : s.rows,
              note: undefined,
            }
          : s,
      ),
    );
    setLog((l) => [{ id: `new-${l.length + 1}-${id}`, when: todayLabel, source: src.name, what, by: "You (mock)" }, ...l]);
    setPicked((p) => ({ ...p, [id]: undefined }));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {periodLabel} data pack
            <Badge variant={finals === sources.length ? "ok" : "warn"}>
              {finals} of {sources.length} final
            </Badge>
            <MockNote>Mock: files are not uploaded or stored</MockNote>
          </CardTitle>
          <CardDescription>
            Each month the review numbers come from these five sources. Pick a file and press Load to see how an upload would update the source; the review page is not changed.
            {!canLoad && " You have read-only access, so the load controls are disabled."}
          </CardDescription>
        </CardHeader>
      </Card>

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sources.map((s) => {
          const meta = STATUS_META[s.status];
          const file = picked[s.id];
          return (
            <li key={s.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {s.name}
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <Badge variant="secondary">{s.kind === "SYNC" ? "Automatic sync" : "Monthly file"}</Badge>
                  </CardTitle>
                  <CardDescription className="break-words">{s.artifact}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <dt className="text-ink-faint">Last loaded</dt>
                      <dd className="tabular font-medium text-ink">
                        {s.lastLoadedLabel} <span className="font-normal text-ink-muted">({s.ageLabel})</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Loaded by</dt>
                      <dd className="font-medium text-ink">{s.lastLoadedBy}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Owner</dt>
                      <dd className="text-ink-muted">{s.owner}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Cadence</dt>
                      <dd className="text-ink-muted">{s.cadence}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">Rows</dt>
                      <dd className="tabular text-ink-muted">{fmtInt(s.rows)}</dd>
                    </div>
                  </dl>
                  <div>
                    <p className="mb-1 text-[11px] text-ink-faint">Feeds</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {s.feeds.map((f) => (
                        <li key={f}>
                          <Badge variant="outline">{f}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {s.note && <p className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-ink">{s.note}</p>}

                  <div className="mt-auto border-t border-border/70 pt-4">
                    {s.kind === "FILE" ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <Label className="flex min-w-0 flex-1 flex-col gap-1.5">
                          Next file
                          <Input
                            type="file"
                            disabled={!canLoad}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              setPicked((p) => ({ ...p, [s.id]: f ? { name: f.name, size: f.size } : undefined }));
                            }}
                          />
                        </Label>
                        <Button size="sm" disabled={!canLoad || !file} onClick={() => load(s.id)}>
                          <Upload size={12} aria-hidden /> Load
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <Button size="sm" variant="secondary" disabled={!canLoad} onClick={() => load(s.id)}>
                          <RefreshCw size={12} aria-hidden /> Sync now
                        </Button>
                        <p className="text-[11px] text-ink-faint">Pulled from the dbt semantic layer; no file to upload.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-ok" aria-hidden /> Load history
          </CardTitle>
          <CardDescription>Newest first. Loads you make on this page are added here (mock, not saved).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border">
            <Table className="min-w-[32rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>When</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>File or job</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular whitespace-nowrap">{e.when}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium text-ink">{e.source}</TableCell>
                    <TableCell className="whitespace-normal break-words text-ink-muted">{e.what}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink-muted">{e.by}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
