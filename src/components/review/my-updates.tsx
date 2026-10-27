"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveInitiativeUpdate, toggleActionItem, toggleMilestone } from "@/app/(app)/review-actions";
import type { SiReviewStatus } from "@/lib/review-model";
import { SiStatusPicker, UpdatedBadge } from "./status";

export type MyItem = { id: string; kind: "milestone" | "action"; text: string; dueLabel: string; done: boolean; pastDue: boolean };
export type MySiRow = {
  id: string;
  shortCode: string;
  name: string;
  areaName: string;
  updated: boolean;
  status: SiReviewStatus | null;
  latestProgress: string;
  whatNext: string;
  milestones: MyItem[];
  actions: MyItem[];
};

/** Tick-off list; each change is saved straight away. */
export function ItemChecklist({ title, items }: { title: string; items: MyItem[] }) {
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.id, i.done])));
  const [pending, startTransition] = useTransition();
  if (items.length === 0) return null;

  function toggle(item: MyItem, checked: boolean) {
    setDone((d) => ({ ...d, [item.id]: checked }));
    const fd = new FormData();
    fd.set("id", item.id);
    startTransition(() => (item.kind === "milestone" ? toggleMilestone(fd) : toggleActionItem(fd)));
  }

  return (
    <div aria-busy={pending}>
      <p className="mb-1.5 text-xs font-semibold text-ink">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <Label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 font-normal text-ink-muted transition-colors hover:bg-surface-2/60">
              <Checkbox className="mt-px" checked={!!done[i.id]} onCheckedChange={(c) => toggle(i, c === true)} />
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

function SiUpdateCard({ row, period }: { row: MySiRow; period: string }) {
  const [status, setStatus] = useState<SiReviewStatus | null>(row.status);
  const [error, setError] = useState<string | null>(null);

  return (
    <article id={`si-${row.id}`} className="scroll-mt-20 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">{row.areaName}</p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">
            <Link href={`/initiatives/${row.id}`} className="hover:text-navy-deep">
              <span className="tabular mr-2 text-xs text-ink-faint">{row.shortCode}</span>
              {row.name}
            </Link>
          </h3>
        </div>
        <UpdatedBadge updated={row.updated} />
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[3fr_2fr]">
        <form
          action={saveInitiativeUpdate}
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            const fd = new FormData(e.currentTarget);
            if (!status || !String(fd.get("update") ?? "").trim() || !String(fd.get("pathForward") ?? "").trim()) {
              e.preventDefault();
              setError("Pick a status and fill in both latest progress and what next.");
            } else setError(null);
          }}
        >
          <input type="hidden" name="initiativeId" value={row.id} />
          <input type="hidden" name="reportingPeriod" value={period} />
          <input type="hidden" name="reviewStatus" value={status ?? ""} />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-xs font-medium text-ink-muted">Status</legend>
            <SiStatusPicker label={`Status for ${row.name}`} value={status} onChange={setStatus} />
            <Label className="flex flex-col gap-1.5">
              Latest progress
              <Textarea name="update" rows={3} defaultValue={row.latestProgress} placeholder="What moved since last month?" />
            </Label>
            <Label className="flex flex-col gap-1.5">
              What next
              <Textarea name="pathForward" rows={2} defaultValue={row.whatNext} placeholder="What happens before the next review?" />
            </Label>
          </fieldset>
          {error && <p role="alert" className="text-xs text-risk">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">{row.updated ? "Save a new update" : "Save update"}</Button>
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

export function MyUpdates({ rows, period, periodLabel }: { rows: MySiRow[]; period: string; periodLabel: string }) {
  const notDone = rows.filter((r) => !r.updated).length;
  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
        <span className="font-semibold text-ink">{periodLabel} updates.</span>{" "}
        {notDone === 0 ? "Every SI has an update." : `${notDone} of ${rows.length} still need an update.`} Saved updates appear on the review straight away.
      </p>
      {rows.map((r) => (
        <SiUpdateCard key={r.id} row={r} period={period} />
      ))}
    </div>
  );
}
