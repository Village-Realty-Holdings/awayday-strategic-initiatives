"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowRight, X } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { personName } from "../_mock/data";
import { fmtDay, milestonesBySi, siShortCode, snapshotFor } from "../_mock/selectors";
import type { MockSi } from "../_mock/types";
import { SiStatusBadge, UpdateStateBadge } from "./status";

export function SiCharterDialog({ si, periodId, recordId }: { si: MockSi; periodId: string; recordId?: string }) {
  const [open, setOpen] = useState(false);
  const snapshot = snapshotFor(si.code, periodId);
  const milestones = milestonesBySi(si.code);

  return (
    <>
      <article className="group flex flex-col gap-2 rounded-lg border border-border/70 bg-surface-2/30 px-3 py-3 transition-colors hover:border-navy/40 hover:bg-surface-2/60">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 text-left text-sm font-medium text-ink hover:text-navy-deep">
            <span className="tabular mr-2 text-[10px] text-ink-faint">{siShortCode(si.code)}</span>
            {si.name}
          </button>
          <span className="flex flex-wrap items-center gap-1.5">
            <SiStatusBadge status={snapshot.status} />
            {snapshot.state !== "SUBMITTED" && <UpdateStateBadge state={snapshot.state} />}
          </span>
        </div>
        <p className="text-xs text-ink-faint">Lead: {personName(si.ownerId)}</p>
        <dl className="grid gap-1.5 text-xs">
          <div><dt className="font-semibold text-ink">Latest progress</dt><dd className="text-ink-muted">{snapshot.latestProgress ?? "TBD"}</dd></div>
          <div><dt className="font-semibold text-ink">What next</dt><dd className="text-ink-muted">{snapshot.whatNext ?? "TBD"}</dd></div>
        </dl>
        <Button type="button" variant="link" size="xs" onClick={() => setOpen(true)} className="mt-auto inline-flex w-fit gap-1 px-0 text-[11px] font-medium text-navy">
          Open charter <ArrowRight size={12} aria-hidden />
        </Button>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(760px,90vh)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 pb-5 pt-5 pr-14">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular text-[10px] text-ink-faint">{siShortCode(si.code)}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{si.areaCode}</span>
              <SiStatusBadge status={snapshot.status} />
            </div>
            <DialogTitle className="text-xl">{si.name}</DialogTitle>
            <DialogDescription>Lead: {personName(si.ownerId)} · Sponsor: {si.sponsorLabel}</DialogDescription>
          </DialogHeader>
          <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 h-8 w-8" aria-label="Close charter"><X size={17} aria-hidden /></Button></DialogClose>
          <div className="grid gap-5 overflow-y-auto px-6 py-5 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">What it is</p><p className="mt-1 leading-6 text-ink">{si.objective}</p></div>
              <div className="rounded-md bg-surface-2 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">What it is going for</p><p className="mt-1 leading-6 text-ink">{si.goingFor}</p></div>
            </div>
            <div className="grid gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Latest update</p>
              <p className="leading-6 text-ink-muted">{snapshot.latestProgress ?? "No update submitted yet."}</p>
              <p className="font-semibold text-ink">What next</p>
              <p className="leading-6 text-ink-muted">{snapshot.whatNext ?? "No next step submitted yet."}</p>
            </div>
            {milestones.length > 0 && <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Milestones</p><ol className="grid gap-2">{milestones.map((m) => <li key={m.id} className="flex items-center gap-2 text-xs"><span className={`size-2 rounded-full ${m.done ? "bg-ok" : "bg-navy"}`} /><span className="tabular text-ink-muted">{fmtDay(m.date)}</span><span className="text-ink">{m.title}</span>{m.done && <Badge variant="ok">Done</Badge>}</li>)}</ol></div>}
          </div>
          <DialogFooter className="border-t border-border bg-surface-2/50 px-6 py-3">
            <DialogClose asChild><Button type="button" variant="outline" size="sm">Back to review</Button></DialogClose>
            {recordId && <Button asChild size="sm"><a href={`/initiatives/${recordId}`}>Open record <ArrowUpRight size={13} aria-hidden /></a></Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
