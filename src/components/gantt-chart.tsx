"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_META, QUADRANT_META, HEALTH_META, HEALTH_ORDER, type Health } from "@/lib/initiatives";
import type { InitiativeStatus, Quadrant } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

export type GanttRow = {
  id: string;
  code: string;
  name: string;
  teamLead: string | null;
  cimDriver: string | null;
  quadrant: Quadrant;
  status: InitiativeStatus;
  health: Health;
  leftPct: number;
  widthPct: number;
  pct: number;
  /** Dates borrowed from milestones because start/target aren't set. */
  derived: boolean;
};

export type UnscheduledInitiative = { id: string; code: string; name: string; teamLead: string | null };

const STATUSES = Object.keys(STATUS_META) as InitiativeStatus[];
const QUADRANTS = Object.keys(QUADRANT_META) as Quadrant[];

export function GanttChart({
  rows,
  quarters,
  todayPct,
  owners,
  cims,
  unscheduled,
}: {
  rows: GanttRow[];
  quarters: { left: number; label: string }[];
  todayPct: number | null;
  owners: string[];
  cims: string[];
  unscheduled: UnscheduledInitiative[];
}) {
  const [owner, setOwner] = useState("");
  const [cim, setCim] = useState("");
  const [status, setStatus] = useState("");
  const [quadrant, setQuadrant] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!owner || r.teamLead === owner) &&
          (!cim || r.cimDriver === cim) &&
          (!status || r.status === status) &&
          (!quadrant || r.quadrant === quadrant),
      ),
    [rows, owner, cim, status, quadrant],
  );

  const active = owner || cim || status || quadrant;
  const reset = () => { setOwner(""); setCim(""); setStatus(""); setQuadrant(""); };
  const anyDerived = rows.some((r) => r.derived);

  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <Sel value={owner} onChange={setOwner} label="Owner" options={owners} />
        <Sel value={cim} onChange={setCim} label="CIM driver" options={cims} />
        <Sel value={status} onChange={setStatus} label="Status" options={STATUSES} render={(s) => STATUS_META[s as InitiativeStatus].label} />
        <Sel value={quadrant} onChange={setQuadrant} label="Priority" options={QUADRANTS} render={(q) => QUADRANT_META[q as Quadrant].label} />
        {active && (
          <Button variant="outline" size="sm" onClick={reset} className="px-2.5">
            Reset
          </Button>
        )}
        <span className="text-xs text-ink-faint">{filtered.length} of {rows.length}</span>
      </div>

      {/* Legend — bar color = delivery health */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-ink-muted">
        {HEALTH_ORDER.map((h) => (
          <span key={h} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-3 rounded-sm ${HEALTH_META[h].bar}`} aria-hidden /> {HEALTH_META[h].label}
          </span>
        ))}
        {todayPct !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px border-l border-dashed border-risk" aria-hidden /> Today
          </span>
        )}
        {anyDerived && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm border border-dashed border-ink-faint" aria-hidden /> Dates from milestones
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <div className="min-w-[900px]">
        <div className="grid grid-cols-[240px_1fr] items-center border-b border-border bg-surface-2/40 py-1.5 pr-4">
          <span className="pl-4 text-[11px] font-medium text-ink-faint">Initiative</span>
          <div className="relative h-5">
            {quarters.map((q) => (
              <span key={q.label} className="absolute top-0 text-[10px] text-ink-faint" style={{ left: `${q.left}%` }}>
                {q.label}
              </span>
            ))}
            {todayPct !== null && (
              <span
                className="absolute -top-0.5 z-20 -translate-x-1/2 rounded-sm bg-risk px-1 py-0.5 text-[9px] font-semibold leading-none text-white"
                style={{ left: `${todayPct}%` }}
              >
                Today
              </span>
            )}
          </div>
        </div>
        <div>
          {filtered.map((i) => (
            <Link
              key={i.id}
              href={`/initiatives/${i.id}`}
              title={`${i.code} · ${i.name}\nLead: ${i.teamLead ?? "Unassigned"}\nStatus: ${STATUS_META[i.status].label} (${Math.round(i.pct * 100)}%)\nHealth: ${HEALTH_META[i.health].label}${i.derived ? "\nDates from milestones (no start/target set)" : ""}`}
              className="grid grid-cols-[240px_1fr] items-center gap-3 border-t border-border/50 py-2 pr-4 transition-colors hover:bg-surface-2/50"
            >
              <div className="min-w-0 pl-4">
                <span className="flex items-baseline gap-1.5">
                  <span className="tabular shrink-0 text-[10px] text-ink-faint">{i.code}</span>
                  <span className="truncate text-xs text-ink">{i.name}</span>
                </span>
                {i.teamLead && <span className="truncate text-[10px] text-ink-faint">{i.teamLead}</span>}
              </div>
              <div className="relative h-6">
                {quarters.map((q) => (
                  <span key={q.label} className="absolute top-0 bottom-0 w-px bg-border/70" style={{ left: `${q.left}%` }} aria-hidden />
                ))}
                {todayPct !== null && (
                  <span className="absolute top-0 bottom-0 z-10 border-l border-dashed border-risk" style={{ left: `${todayPct}%` }} aria-hidden />
                )}
<div className={`absolute top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full ${HEALTH_META[i.health].bar} opacity-25`} style={{ left: `${i.leftPct}%`, width: `${i.widthPct}%` }} />
                {i.derived && (
                  <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full border border-dashed border-ink-muted" style={{ left: `${i.leftPct}%`, width: `${i.widthPct}%` }} aria-hidden />
                )}
                <div className={`absolute top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full ${HEALTH_META[i.health].bar}`} style={{ left: `${i.leftPct}%`, width: `${i.widthPct * i.pct}%` }} />
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">
              {rows.length === 0 ? (
                "No initiatives have dates or dated milestones yet. Add them on each charter to see the timeline."
              ) : (
                <>
                  No initiatives match these filters.{" "}
                  <Button type="button" variant="link" size="sm" onClick={reset}>Reset filters</Button>
                </>
              )}
            </p>
          )}
        </div>
        </div>
      </div>

      {unscheduled.length > 0 && (
        <section className="mt-4 rounded-md border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">
              Unscheduled <span className="tabular font-normal text-ink-faint">({unscheduled.length})</span>
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">No start/target date and no dated milestones, so these can&apos;t be placed on the timeline.</p>
          </div>
          <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
            {unscheduled.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:border-b sm:border-border/60">
                <Link href={`/initiatives/${u.id}`} className="min-w-0 text-xs hover:text-navy-deep">
                  <span className="tabular mr-1.5 text-[10px] text-ink-faint">{u.code}</span>
                  <span className="text-ink">{u.name}</span>
                  {u.teamLead && <span className="text-ink-faint"> · {u.teamLead}</span>}
                </Link>
                <Button asChild variant="link" size="xs" className="no-print shrink-0">
                  <Link href={`/admin/initiatives/${u.id}/edit`}>Set dates</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Sel({
  value,
  onChange,
  label,
  options,
  render,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
  render?: (v: string) => string;
}) {
  return (
    <NativeSelect size="sm" value={value} onChange={(e) => onChange(e.target.value)} className="px-2.5">
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>{render ? render(o) : o}</option>
      ))}
    </NativeSelect>
  );
}
