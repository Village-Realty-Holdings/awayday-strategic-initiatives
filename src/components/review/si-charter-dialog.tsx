"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowRight, X } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDay, type ReviewSi } from "@/lib/review-model";
import { SiStatusBadge } from "./status";

/** SI card on the review; opens a short charter with a link to the full record. */
export function SiCard({ si }: { si: ReviewSi }) {
  const [open, setOpen] = useState(false);
  const upcoming = si.milestones.filter((m) => !m.done && m.date).slice(0, 3);

  return (
    <>
      <article className="group flex flex-col gap-2 rounded-lg border border-border/70 bg-surface-2/30 px-3 py-3 transition-colors hover:border-navy/40 hover:bg-surface-2/60">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 text-left text-sm font-medium text-ink hover:text-navy-deep">
            <span className="tabular mr-2 text-micro text-ink-faint">{si.shortCode}</span>
            {si.name}
          </button>
          <SiStatusBadge status={si.status} />
        </div>
        <p className="text-xs text-ink-faint">
          Lead: {si.lead ?? "TBD"}
          {si.sponsor ? ` · Sponsor: ${si.sponsor}` : ""}
        </p>
        {si.goingFor && (
          <p className="text-xs text-ink-muted">
            <span className="font-semibold text-ink">Going for:</span> {si.goingFor}
          </p>
        )}
        {upcoming.length > 0 && (
          <ul className="grid gap-0.5 text-note text-ink-muted">
            {upcoming.map((m) => (
              <li key={m.id}>
                <span className="tabular text-ink-faint">{fmtDay(m.date)}</span> {m.title}
              </li>
            ))}
          </ul>
        )}
        <dl className="grid gap-1.5 text-xs">
          <div><dt className="font-semibold text-ink">Latest progress</dt><dd className="text-ink-muted">{si.latestProgress ?? "TBD"}</dd></div>
          <div><dt className="font-semibold text-ink">What next</dt><dd className="text-ink-muted">{si.whatNext ?? "TBD"}</dd></div>
        </dl>
        <Button type="button" variant="link" size="xs" onClick={() => setOpen(true)} className="mt-auto inline-flex w-fit gap-1 px-0 text-note font-medium text-navy">
          Open charter <ArrowRight size={12} aria-hidden />
        </Button>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(760px,90vh)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 pb-5 pt-5 pr-14">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular text-micro text-ink-faint">{si.shortCode}</span>
              <span className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">{si.areaName}</span>
              <SiStatusBadge status={si.status} />
            </div>
            <DialogTitle className="text-xl">{si.name}</DialogTitle>
            <DialogDescription>Lead: {si.lead ?? "TBD"} · Sponsor: {si.sponsor ?? "TBD"}</DialogDescription>
          </DialogHeader>
          <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 h-8 w-8" aria-label="Close charter"><X size={17} aria-hidden /></Button></DialogClose>
          <div className="grid gap-5 overflow-y-auto px-6 py-5 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">Objective</p><p className="mt-1 leading-6 text-ink">{si.objective ?? "Not on the charter yet."}</p></div>
              <div className="rounded-md bg-surface-2 p-3"><p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">KPI target</p><p className="mt-1 leading-6 text-ink">{si.kpi ?? "Not set yet."}</p></div>
            </div>
            <div className="grid gap-1.5">
              <p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">Latest update</p>
              <p className="leading-6 text-ink-muted">{si.latestProgress ?? "No update for this month yet."}</p>
              <p className="font-semibold text-ink">What next</p>
              <p className="leading-6 text-ink-muted">{si.whatNext ?? "No next step for this month yet."}</p>
            </div>
            {si.milestones.length > 0 && (
              <div>
                <p className="mb-2 text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">Milestones</p>
                <ol className="grid gap-2">
                  {si.milestones.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-xs">
                      <span className={`size-2 rounded-full ${m.done ? "bg-ok" : "bg-navy"}`} />
                      <span className="tabular text-ink-muted">{fmtDay(m.date)}</span>
                      <span className="text-ink">{m.title}</span>
                      {m.done && <Badge variant="ok">Done</Badge>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
          <DialogFooter className="border-t border-border bg-surface-2/50 px-6 py-3">
            <DialogClose asChild><Button type="button" variant="outline" size="sm">Back to review</Button></DialogClose>
            <Button asChild size="sm"><a href={`/initiatives/${si.id}`}>Open full charter <ArrowUpRight size={13} aria-hidden /></a></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
