"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Clock } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SiStatus, UpdateState } from "../_mock/types";
import { MockNote } from "./preview";
import { SiStatusPicker, UpdateStateBadge } from "./status";

export type MyItem = { id: string; text: string; due: string; dueLabel: string; done: boolean; pastDue: boolean };
export type MySiRow = {
  code: string;
  shortCode: string;
  name: string;
  areaName: string;
  state: UpdateState;
  status: SiStatus | null;
  latestProgress: string;
  whatNext: string;
  milestones: MyItem[];
  actions: MyItem[];
};

export function ItemChecklist({ title, items }: { title: string; items: MyItem[] }) {
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.id, i.done])));
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-ink">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <Label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 font-normal text-ink-muted transition-colors hover:bg-surface-2/60">
              <Checkbox
                className="mt-px"
                checked={!!done[i.id]}
                onCheckedChange={(c) => setDone((d) => ({ ...d, [i.id]: c === true }))}
              />
              <span className={`transition-[color,opacity] duration-200 ${done[i.id] ? "text-ink-faint line-through opacity-70" : ""}`}>
                {i.text} <span className="text-ink-faint">· {i.dueLabel}</span>
                {i.pastDue && !done[i.id] && <Badge variant="warn" className="ml-1.5">Needs a status</Badge>}
              </span>
            </Label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiUpdateCard({ row, locked }: { row: MySiRow; locked: boolean }) {
  const [state, setState] = useState<UpdateState>(row.state);
  const [status, setStatus] = useState<SiStatus | null>(row.status);
  const [progress, setProgress] = useState(row.latestProgress);
  const [next, setNext] = useState(row.whatNext);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const started = state !== "NOT_SUBMITTED" || progress !== "" || next !== "" || status !== null;
  const readOnly = locked;

  function save(submit: boolean) {
    if (submit && (!status || !progress.trim() || !next.trim())) {
      setError("Pick a status and fill in both latest progress and what next before submitting.");
      return;
    }
    setError(null);
    setState(submit ? "SUBMITTED" : "DRAFT");
    setFlash(submit ? "Submitted (mock)" : "Draft saved (mock)");
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">{row.areaName}</p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">
            <Link href={`/v2/si/${row.code}`} className="hover:text-navy-deep">
              <span className="tabular mr-2 text-xs text-ink-faint">{row.shortCode}</span>
              {row.name}
            </Link>
          </h3>
        </div>
        {state === "NOT_SUBMITTED" && !started ? <Badge variant="outline">Not started</Badge> : <UpdateStateBadge state={state} />}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[3fr_2fr]">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
        >
          <fieldset disabled={readOnly} className="flex flex-col gap-3 disabled:opacity-70">
            <legend className="mb-1 text-xs font-medium text-ink-muted">Status</legend>
            <SiStatusPicker label={`Status for ${row.name}`} value={status} onChange={setStatus} disabled={readOnly} />
            <Label className="flex flex-col gap-1.5">
              Latest progress
              <Textarea rows={3} value={progress} onChange={(e) => setProgress(e.target.value)} placeholder="What moved since last month?" />
            </Label>
            <Label className="flex flex-col gap-1.5">
              What next
              <Textarea rows={2} value={next} onChange={(e) => setNext(e.target.value)} placeholder="What happens before the next review?" />
            </Label>
          </fieldset>
          {error && <p role="alert" className="text-xs text-risk">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {readOnly ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <Lock size={12} aria-hidden /> Locked: this month&apos;s review is published.
              </span>
            ) : (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={() => save(false)}>Save draft</Button>
                <Button type="submit" size="sm">{state === "SUBMITTED" ? "Resubmit" : "Submit"}</Button>
                <MockNote />
                {flash && <span role="status" className="text-xs text-ok">{flash}</span>}
              </>
            )}
          </div>
        </form>
        <div className="flex flex-col gap-4 lg:border-l lg:border-border/70 lg:pl-5">
          <ItemChecklist title="Milestones" items={row.milestones} />
          <ItemChecklist title="Action items" items={row.actions} />
          {row.milestones.length === 0 && row.actions.length === 0 && <p className="text-xs text-ink-faint">No open milestones or action items.</p>}
        </div>
      </div>
    </article>
  );
}

export function MyUpdates({
  rows,
  locked,
  periodLabel,
  dueLabel,
  daysLeft,
}: {
  rows: MySiRow[];
  locked: boolean;
  periodLabel: string;
  dueLabel: string;
  daysLeft: number;
}) {
  const notDone = rows.filter((r) => r.state !== "SUBMITTED").length;
  const urgent = !locked && daysLeft <= 3;
  return (
    <div className="flex flex-col gap-5">
      {locked ? (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink-muted">
          <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>The {periodLabel} review is published, so updates are locked. Milestone and action item tick-offs are still open.</p>
        </div>
      ) : (
        <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${urgent ? "border-warn/50 bg-warn-soft text-ink" : "border-border bg-surface text-ink-muted"}`}>
          <Clock size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold text-ink">{periodLabel} updates are due {dueLabel}</span>{" "}
            ({daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : daysLeft === 0 ? "due today" : `${-daysLeft} day${daysLeft === -1 ? "" : "s"} overdue`}).{" "}
            {notDone === 0 ? "Everything is submitted." : `${notDone} of ${rows.length} still need to be submitted.`} Submitted updates feed straight into the review page.
          </p>
        </div>
      )}
      {rows.map((r) => (
        <SiUpdateCard key={r.code} row={r} locked={locked} />
      ))}
    </div>
  );
}
