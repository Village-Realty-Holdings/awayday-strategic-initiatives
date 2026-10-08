"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_META, QUADRANT_META, HEALTH_META, HEALTH_ORDER, type Health } from "@/lib/initiatives";
import type { InitiativeStatus, Quadrant } from "@/generated/prisma/client";

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
};

const STATUSES = Object.keys(STATUS_META) as InitiativeStatus[];
const QUADRANTS = Object.keys(QUADRANT_META) as Quadrant[];

export function GanttChart({
  rows,
  quarters,
  todayPct,
  owners,
  cims,
}: {
  rows: GanttRow[];
  quarters: { left: number; label: string }[];
  todayPct: number | null;
  owners: string[];
  cims: string[];
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

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Sel value={owner} onChange={setOwner} label="Owner" options={owners} />
        <Sel value={cim} onChange={setCim} label="CIM driver" options={cims} />
        <Sel value={status} onChange={setStatus} label="Status" options={STATUSES} render={(s) => STATUS_META[s as InitiativeStatus].label} />
        <Sel value={quadrant} onChange={setQuadrant} label="Priority" options={QUADRANTS} render={(q) => QUADRANT_META[q as Quadrant].label} />
        {active && (
          <button
            onClick={() => { setOwner(""); setCim(""); setStatus(""); setQuadrant(""); }}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2"
          >
            Reset
          </button>
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
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
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
              title={`${i.code} · ${i.name}\nLead: ${i.teamLead ?? "Unassigned"}\nStatus: ${STATUS_META[i.status].label} (${Math.round(i.pct * 100)}%)\nHealth: ${HEALTH_META[i.health].label}`}
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
                <div className={`absolute top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full ${HEALTH_META[i.health].bar}`} style={{ left: `${i.leftPct}%`, width: `${i.widthPct * i.pct}%` }} />
              </div>
            </Link>
          ))}
          {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-muted">No initiatives match these filters.</p>}
        </div>
      </div>
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-navy"
    >
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>{render ? render(o) : o}</option>
      ))}
    </select>
  );
}
