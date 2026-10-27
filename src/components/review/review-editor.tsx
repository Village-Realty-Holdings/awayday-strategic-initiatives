"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveReview, unpublishReview } from "@/app/(app)/review-actions";
import { fmtLong, SUMMARY_SCOPE, type ReviewPeriodStatus, type SoWhat } from "@/lib/review-model";
import { type EditorSoWhat, SoWhatEditor } from "./so-what-editor";
import { PeriodStatusBadge } from "./status";

export type EditorArea = { code: string; name: string; eyebrow: string; soWhats: SoWhat[] };

const toEditor = (items: SoWhat[]): EditorSoWhat[] => items.map((s) => ({ key: s.id, headline: s.headline, body: s.body ?? "" }));

export function ReviewEditor({
  periodId,
  periodLabel,
  status,
  stored,
  preparedBy,
  meetingDate,
  updatesDueDate,
  dataAsOf,
  observedAsOf,
  summary: initialSummary,
  areas,
  updated,
}: {
  periodId: string;
  periodLabel: string;
  status: ReviewPeriodStatus;
  stored: boolean;
  preparedBy: string;
  meetingDate: string | null;
  updatesDueDate: string | null;
  /** The stored data-as-of override, if any. */
  dataAsOf: string | null;
  /** Data-as-of derived from the month's KPI values. */
  observedAsOf: string | null;
  summary: SoWhat[];
  areas: EditorArea[];
  /** SIs with an update for the month, out of all SIs. */
  updated: { done: number; total: number };
}) {
  const [summary, setSummary] = useState(() => toEditor(initialSummary));
  const [byArea, setByArea] = useState<Record<string, EditorSoWhat[]>>(() => Object.fromEntries(areas.map((a) => [a.code, toEditor(a.soWhats)])));
  const [confirming, setConfirming] = useState(false);
  const locked = status === "PUBLISHED";

  const payload = JSON.stringify([
    ...summary.map((s) => ({ scope: SUMMARY_SCOPE, headline: s.headline, body: s.body })),
    ...areas.flatMap((a) => (byArea[a.code] ?? []).map((s) => ({ scope: a.code, headline: s.headline, body: s.body }))),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {locked && (
        <form action={unpublishReview} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <input type="hidden" name="periodId" value={periodId} />
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-ink">{periodLabel} is published.</span> The review and its SI updates are locked. Unpublish to make changes.
          </p>
          <SubmitButton size="sm" variant="outline">Unpublish</SubmitButton>
        </form>
      )}

      <form action={saveReview} className="flex flex-col gap-8">
        <input type="hidden" name="periodId" value={periodId} />
        <input type="hidden" name="soWhats" value={payload} />

        <fieldset disabled={locked} className="flex flex-col gap-8">
          <Card className="gap-0 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Review details</h2>
              <div className="flex items-center gap-2">
                <PeriodStatusBadge status={status} />
                {!stored && <span className="text-[11px] text-ink-faint">Not saved yet</span>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Label className="flex flex-col gap-1.5">
                Prepared by
                <Input name="preparedBy" defaultValue={preparedBy} maxLength={120} />
              </Label>
              <Label className="flex flex-col gap-1.5">
                ELT meeting
                <Input name="meetingDate" type="date" defaultValue={meetingDate ?? ""} />
              </Label>
              <Label className="flex flex-col gap-1.5">
                SI updates due
                <Input name="updatesDueDate" type="date" defaultValue={updatesDueDate ?? ""} />
              </Label>
              <Label className="flex flex-col gap-1.5">
                Data as of
                <Input name="dataAsOf" type="date" defaultValue={dataAsOf ?? ""} />
                <span className="text-[11px] font-normal text-ink-faint">
                  {observedAsOf ? `Blank uses the KPI data: ${fmtLong(observedAsOf)}.` : "No KPI data loaded for this month."}
                </span>
              </Label>
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              {updated.done} of {updated.total} SIs have an update for {periodLabel}. Publishing locks updates for the month on My SIs.
            </p>
          </Card>

          <section>
            <h2 className="mb-1 text-sm font-semibold text-ink">Summary so-whats</h2>
            <p className="mb-3 text-xs text-ink-muted">What the ELT should take from {periodLabel}, shown above “Where the pillars stand”.</p>
            <SoWhatEditor scopeLabel="summary" items={summary} onChange={setSummary} locked={locked} />
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold text-ink">Pillar and enabler so-whats</h2>
            <p className="mb-3 text-xs text-ink-muted">Shown in each section of the review, above its SIs. Leave a section empty to show none.</p>
            <ul className="flex flex-col gap-3">
              {areas.map((a) => (
                <li key={a.code}>
                  <Card className="gap-0 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">{a.eyebrow}</p>
                    <h3 className="mb-3 mt-0.5 text-sm font-semibold text-ink">{a.name}</h3>
                    <SoWhatEditor compact scopeLabel={a.name} items={byArea[a.code] ?? []} onChange={(next) => setByArea((m) => ({ ...m, [a.code]: next }))} locked={locked} />
                  </Card>
                </li>
              ))}
              {areas.length === 0 && <li className="text-xs text-ink-faint">The active plan has no pillars or enablers.</li>}
            </ul>
          </section>
        </fieldset>

        {!locked && (
          <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-bg/95 px-2 py-3 backdrop-blur">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/review/${periodId}`}>Preview review</Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {confirming ? (
                <>
                  <span className="text-xs text-ink-muted">Publish {periodLabel}? SI leads can no longer update this month.</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                  <SubmitButton size="sm" name="intent" value="publish">
                    <Send size={12} aria-hidden /> Save and publish
                  </SubmitButton>
                </>
              ) : (
                <>
                  <SubmitButton size="sm" variant="secondary" name="intent" value="save">
                    Save draft
                  </SubmitButton>
                  <Button type="button" size="sm" onClick={() => setConfirming(true)}>
                    <Send size={12} aria-hidden /> Publish
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
