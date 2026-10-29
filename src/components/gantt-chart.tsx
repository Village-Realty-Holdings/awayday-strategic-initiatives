"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_META, QUADRANT_META, HEALTH_META, HEALTH_ORDER, type Health } from "@/lib/initiatives";
import type { InitiativeStatus, Quadrant } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/filter-select";
import { Eye } from "@/components/icons";

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
  const [milestoneNotice, setMilestoneNotice] = useState("");

  function scrollToMilestone(initiativeId: string, code: string) {
    const milestone = Array.from(document.querySelectorAll<HTMLElement>("[data-timeline-initiative]"))
      .find((element) => element.dataset.timelineInitiative === initiativeId);
    if (!milestone) {
      setMilestoneNotice(`No milestones for ${code} match the milestone filters below.`);
      return;
    }
    setMilestoneNotice("");
    milestone.focus({ preventScroll: true });
    milestone.scrollIntoView({ behavior: "instant", block: "center" });
  }

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
        <FilterSelect value={owner} onChange={setOwner} label="Owner" options={owners} />
        <FilterSelect value={cim} onChange={setCim} label="CIM driver" options={cims} />
        <FilterSelect value={status} onChange={setStatus} label="Status" options={STATUSES} render={(s) => STATUS_META[s as InitiativeStatus].label} />
        <FilterSelect value={quadrant} onChange={setQuadrant} label="Priority" options={QUADRANTS} render={(q) => QUADRANT_META[q as Quadrant].label} />
        {active && (
          <Button variant="outline" size="sm" onClick={reset} className="px-2.5">
            Reset
          </Button>
        )}
        <span className="text-xs text-ink-faint">{filtered.length} of {rows.length}</span>
      </div>

      {/* Legend — bar color = delivery health */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-note text-ink-muted">
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
          <span className="pl-4 text-note font-medium text-ink-faint">Initiative</span>
          <div className="relative h-5">
            {quarters.map((q) => (
              <span key={q.label} className="absolute top-0 text-micro text-ink-faint" style={{ left: `${q.left}%` }}>
                {q.label}
              </span>
            ))}
            {todayPct !== null && (
              <span
                className="absolute -top-0.5 z-20 -translate-x-1/2 rounded-sm bg-risk px-1 py-0.5 text-nano font-semibold leading-none text-white"
                style={{ left: `${todayPct}%` }}
              >
                Today
              </span>
            )}
          </div>
        </div>
        <div>
          {filtered.map((i) => (
            <div
              key={i.id}
              className="relative border-t border-border/50"
            >
            <button
              type="button"
              onClick={() => scrollToMilestone(i.id, i.code)}
              aria-label={`Jump to first listed milestone for ${i.code} ${i.name}`}
              title={`${i.code} · ${i.name}\nLead: ${i.teamLead ?? "Unassigned"}\nStatus: ${STATUS_META[i.status].label} (${Math.round(i.pct * 100)}%)\nHealth: ${HEALTH_META[i.health].label}${i.derived ? "\nDates from milestones (no start/target set)" : ""}`}
              className="grid w-full cursor-pointer grid-cols-[240px_1fr] items-center gap-3 py-2 pr-4 text-left transition-colors hover:bg-surface-2/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy"
            >
              <div className="min-w-0 pl-4 pr-9">
                <span className="flex items-baseline gap-1.5">
                  <span className="tabular shrink-0 text-micro text-ink-faint">{i.code}</span>
                  <span className="truncate text-xs text-ink">{i.name}</span>
                </span>
                {i.teamLead && <span className="truncate text-micro text-ink-faint">{i.teamLead}</span>}
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
            </button>
            <Link
              href={`/initiatives/${i.id}`}
              aria-label={`View details for ${i.code} ${i.name}`}
              title="View initiative details"
              className="absolute left-[208px] top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-navy"
            >
              <Eye size={14} aria-hidden />
            </Link>
            </div>
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

      <p role="status" className={milestoneNotice ? "mt-3 text-sm text-ink-muted" : "sr-only"}>
        {milestoneNotice}
      </p>

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
                  <span className="tabular mr-1.5 text-micro text-ink-faint">{u.code}</span>
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
