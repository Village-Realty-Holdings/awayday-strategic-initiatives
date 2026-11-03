"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addInitiativeMeasureReading } from "@/app/(app)/initiatives/actions";
import { saveInitiativeUpdate, toggleActionItem, toggleMilestone } from "@/app/(app)/review-actions";
import { ProgressBar } from "@/components/badges";
import { DatePicker } from "@/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import type { InitiativeStatus } from "@/generated/prisma/client";
import { periodLabel as periodLabelFor } from "@/lib/review-model";
import { SiStatusPicker, UpdatedBadge } from "./status";

export type MyItem = { id: string; kind: "milestone" | "action"; text: string; dueLabel: string; done: boolean; pastDue: boolean };
export type MySiRow = {
  id: string;
  shortCode: string;
  name: string;
  areaName: string;
  updated: boolean;
  status: InitiativeStatus | null;
  latestProgress: string;
  whatNext: string;
  measures: MyMeasure[];
};
export type MyMeasure = {
  id: string;
  name: string;
  kindLabel: string;
  latestLabel: string;
  latestAsOf: string | null;
  targetLabel: string;
  progress: number | null;
  updated: boolean;
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

/** An SI's status, latest progress and what next, for one month. */
export function SiUpdateForm({
  initiativeId,
  name,
  status: initialStatus,
  latestProgress = "",
  whatNext = "",
  period,
  months,
  locked = false,
  returnTo,
  submitLabel = "Save update",
}: {
  initiativeId: string;
  name: string;
  status: InitiativeStatus | null;
  latestProgress?: string;
  whatNext?: string;
  period: string;
  /** Offered as a month picker; without it the form saves to `period`. */
  months?: { value: string; label: string }[];
  locked?: boolean;
  returnTo?: "initiative";
  submitLabel?: string;
}) {
  const [status, setStatus] = useState<InitiativeStatus | null>(initialStatus);
  const [error, setError] = useState<string | null>(null);

  return (
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
      <input type="hidden" name="initiativeId" value={initiativeId} />
      {!months && <input type="hidden" name="reportingPeriod" value={period} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <input type="hidden" name="status" value={status ?? ""} />
      <fieldset className="flex flex-col gap-3" disabled={locked}>
        <legend className="mb-1 text-xs font-medium text-ink-muted">Status</legend>
        <SiStatusPicker label={`Status for ${name}`} value={status} onChange={setStatus} disabled={locked} />
        {months && (
          <Label className="flex flex-col gap-1.5">
            Month
            <NativeSelect name="reportingPeriod" defaultValue={period} className="w-fit">
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </NativeSelect>
          </Label>
        )}
        <Label className="flex flex-col gap-1.5">
          Latest progress
          <Textarea name="update" rows={3} defaultValue={latestProgress} placeholder="What moved since last month?" />
        </Label>
        <Label className="flex flex-col gap-1.5">
          What next
          <Textarea name="pathForward" rows={2} defaultValue={whatNext} placeholder="What happens before the next review?" />
        </Label>
      </fieldset>
      {error && <p role="alert" className="text-xs text-risk">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {locked ? (
          <p className="text-xs text-ink-faint">The {periodLabelFor(period)} review is published, so its updates are final.</p>
        ) : (
          <Button type="submit" size="sm">{submitLabel}</Button>
        )}
      </div>
    </form>
  );
}

/** Latest value against target for each measure, with a quick way to enter this month's. */
function MeasureUpdates({ row, period, asOf, locked }: { row: MySiRow; period: string; asOf: string; locked: boolean }) {
  return (
    <section className="mt-5 border-t border-border/70 pt-4" aria-label={`KPIs and leading measures for ${row.name}`}>
      <p className="mb-2 text-xs font-semibold text-ink">KPIs &amp; leading measures</p>
      {row.measures.length === 0 ? (
        <p className="text-xs text-ink-faint">
          None yet.{" "}
          <Link href={`/initiatives/${row.id}`} className="text-navy hover:underline">Add one on the SI page</Link>.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {row.measures.map((m) => (
            <li key={m.id} className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 text-sm font-medium text-ink">{m.name}</p>
                <Badge variant="secondary">{m.kindLabel}</Badge>
                <Badge variant={m.updated ? "ok" : "outline"} className="ml-auto">{m.updated ? "Updated" : "No value this month"}</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Latest <span className="tabular font-semibold text-ink">{m.latestLabel}</span>
                {m.latestAsOf ? ` · ${m.latestAsOf}` : ""} · Target <span className="tabular text-ink">{m.targetLabel}</span>
              </p>
              {m.progress !== null && <div className="mt-2 max-w-sm"><ProgressBar value={m.progress} /></div>}
              {!locked && (
                <form action={addInitiativeMeasureReading} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="measureId" value={m.id} />
                  <input type="hidden" name="returnTo" value="inbox" />
                  <input type="hidden" name="period" value={period} />
                  <Input size="sm" name="value" required inputMode="decimal" aria-label={`Latest value of ${m.name}`} placeholder="Latest value" className="tabular w-32" />
                  <div className="w-44"><DatePicker name="asOf" label="As of" defaultValue={asOf} align="start" /></div>
                  <SubmitButton variant="secondary" size="sm">Save value</SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SiUpdateCard({ row, period, asOf, locked }: { row: MySiRow; period: string; asOf: string; locked: boolean }) {
  return (
    <article id={`si-${row.id}`} className="scroll-mt-20 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">{row.areaName}</p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">
            <Link href={`/initiatives/${row.id}`} className="hover:text-navy-deep">
              <span className="tabular mr-2 text-xs text-ink-faint">{row.shortCode}</span>
              {row.name}
            </Link>
          </h3>
        </div>
        <UpdatedBadge updated={row.updated} />
      </div>
      <div className="mt-4">
        <SiUpdateForm
          initiativeId={row.id}
          name={row.name}
          status={row.status}
          latestProgress={row.latestProgress}
          whatNext={row.whatNext}
          period={period}
          locked={locked}
          submitLabel={row.updated ? "Save a new update" : "Save update"}
        />
      </div>
      <MeasureUpdates row={row} period={period} asOf={asOf} locked={locked} />
    </article>
  );
}

export function MyUpdates({ rows, period, asOf, locked = false }: { rows: MySiRow[]; period: string; asOf: string; locked?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      {rows.map((r) => (
        <SiUpdateCard key={r.id} row={r} period={period} asOf={asOf} locked={locked} />
      ))}
    </div>
  );
}
