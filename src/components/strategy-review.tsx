"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type DataColumn, type DataRow } from "@/app/(app)/v2/_components/data-table";
import { TONE_VARIANT } from "@/app/(app)/v2/_components/status";
import {
  type ReviewInitiative,
  type ReviewSnapshot,
  type ReviewTone,
} from "@/lib/strategy-review-data";

// Review tone -> shared status badge variant (good=ahead, warn=watch, risk=behind).
const toneVariant: Record<ReviewTone, "ok" | "default" | "warn" | "risk" | "outline"> = {
  good: TONE_VARIANT.ahead,
  warn: TONE_VARIANT.watch,
  risk: TONE_VARIANT.behind,
  neutral: "outline",
};

const toneLabel: Record<ReviewTone, string> = {
  good: "On track",
  warn: "Watch",
  risk: "Behind",
  neutral: "TBD",
};

// Compact card geometry shared by the review's panels (Card defaults are roomier).
const CARD = "gap-3 rounded-md py-4";
const PAD = "px-4";

function StatusBadge({ tone, children }: { tone: ReviewTone; children?: React.ReactNode }) {
  return (
    <Badge variant={toneVariant[tone]} shape="pill" className="gap-1.5 uppercase tracking-[0.08em]">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children ?? toneLabel[tone]}
    </Badge>
  );
}

function SectionHeader({ id, title, owner, tone }: { id: string; title: string; owner?: string; tone?: ReviewTone }) {
  return (
    <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <h2 id={id} className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      {owner && <span className="text-xs text-ink-muted">{owner}</span>}
      {tone && <StatusBadge tone={tone} />}
    </header>
  );
}

function cellTone(cell: string, index: number) {
  if (index > 0 && /[−-]/.test(cell)) return "text-risk";
  if (/[+]/.test(cell)) return "text-ok";
  return undefined;
}

// Review tables are arrays of strings; adapt them to the shared v2 DataTable.
function ReviewTable({ headers, rows, caption }: { headers: string[]; rows: readonly (readonly string[])[]; caption: string }) {
  const columns: DataColumn[] = headers.map((label, index) => ({ key: `c${index}`, label, numeric: index > 0 }));
  const dataRows: DataRow[] = rows.map((row) => ({
    id: row[0],
    cells: Object.fromEntries(row.map((cell, index) => [`c${index}`, <span key={index} className={cellTone(cell, index)}>{cell}</span>])),
  }));
  return <DataTable columns={columns} rows={dataRows} minWidth="620px" caption={caption} />;
}

function Gauge({ tone, value, target }: { tone: ReviewTone; value: number; target: number }) {
  const width = Math.max(8, Math.min(96, (value / 50) * 100));
  const targetLeft = Math.max(6, Math.min(94, (target / 50) * 100));
  return (
    <div className="relative h-12">
      <div className="absolute inset-x-0 top-5 h-2 rounded-full bg-surface-2" />
      <div className={`absolute left-0 top-5 h-2 rounded-full ${tone === "risk" ? "bg-risk" : tone === "warn" ? "bg-warn" : "bg-navy"}`} style={{ width: `${width}%` }} />
      <span className="absolute top-3 h-6 w-0.5 bg-ink" style={{ left: `${targetLeft}%` }} aria-hidden />
      <span className={`absolute top-3 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-surface ${tone === "risk" ? "bg-risk" : tone === "warn" ? "bg-warn" : "bg-navy"}`} style={{ left: `${width}%` }} aria-label={`Current value ${value}`} />
      <span className="absolute top-0 -translate-x-1/2 text-[10px] text-ink-muted" style={{ left: `${targetLeft}%` }}>goal</span>
      <span className="absolute bottom-0 left-0 text-[10px] text-ink-faint">0</span>
      <span className="absolute bottom-0 right-0 text-[10px] text-ink-faint">50</span>
    </div>
  );
}

function InitiativeCard({ initiative, onOpen }: { initiative: ReviewInitiative; onOpen: (initiative: ReviewInitiative) => void }) {
  // The "Open charter" button is the single tab stop; its ::after stretches
  // over the whole card so the entire card is clickable.
  return (
    <Card className={`${CARD} group relative gap-2 border-l-4 border-l-navy transition hover:border-navy hover:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold`}>
      <CardHeader className={`${PAD} grid-cols-[1fr_auto]`}>
        <div className="min-w-0">
          <span className="tabular block text-[10px] text-ink-faint">{initiative.code}</span>
          <CardTitle className="mt-1 text-base group-hover:text-navy-deep">{initiative.name}</CardTitle>
        </div>
        <StatusBadge tone={initiative.status} />
      </CardHeader>
      <CardContent className={`${PAD} grid gap-2`}>
        <span className="text-xs leading-5 text-ink-muted">{initiative.what}</span>
        <span className="border-t border-dashed border-border pt-2 text-xs text-ink-muted"><b className="font-semibold text-ink">Goal:</b> {initiative.goal}</span>
        {initiative.latestUpdate && <span className="text-[11px] leading-4 text-ink-faint"><b className="font-semibold text-ink-muted">Latest update:</b> {initiative.latestUpdate}</span>}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={() => onOpen(initiative)}
            className="font-semibold text-navy-deep after:absolute after:inset-0 after:content-[''] hover:no-underline"
          >
            Open charter <ArrowUpRight size={13} aria-hidden />
            <span className="sr-only"> for {initiative.name}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function StrategyReview({ snapshot }: { snapshot: ReviewSnapshot }) {
  const { meta, pillars, enablers, summaryTiles, financeRows, kpiRows, ebitdaTrend, initiativeLinks } = snapshot;
  // `selected` is kept after close so the dialog's exit animation still has
  // content; `charterOpen` alone drives visibility.
  const [selected, setSelected] = useState<ReviewInitiative | null>(null);
  const [charterOpen, setCharterOpen] = useState(false);
  const linkMap = useMemo(() => new Map(initiativeLinks.map((item) => [item.code, item.id])), [initiativeLinks]);

  // Opening a charter writes #si-CODE (replaceState: no scroll jump, no extra
  // history entry); closing clears it, so a re-render can never reopen it.
  const openCharter = useCallback((initiative: ReviewInitiative) => {
    setSelected(initiative);
    setCharterOpen(true);
    window.history.replaceState(null, "", `#si-${initiative.code}`);
  }, []);
  const closeCharter = useCallback(() => {
    setCharterOpen(false);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  // Deep link (#si-CODE) opens that initiative's charter. Runs on mount (read
  // after mount so the server and first client render agree) and on hashchange
  // (back/forward or a pasted link), never on ordinary re-renders.
  useEffect(() => {
    const initiatives = pillars.flatMap((pillar) => pillar.initiatives);
    const syncFromHash = () => {
      const { hash } = window.location;
      if (!hash.startsWith("#si-")) return;
      const match = initiatives.find((item) => item.code === hash.slice(4));
      if (match) {
        setSelected(match);
        setCharterOpen(true);
      }
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [pillars]);

  return (
    <div className="strategy-review mx-auto max-w-[1400px] text-sm">
      <div className="sticky top-0 z-20 -mx-6 border-b border-border bg-surface/95 px-6 py-2 backdrop-blur">
        <div className="flex items-center gap-3 overflow-x-auto">
          <a href="#top" className="shrink-0 font-semibold tracking-tight text-ink">AWAYDAY · STRATEGY REVIEW</a>
          <nav aria-label="Review sections" className="flex min-w-max gap-1">
            {["summary", "financials", ...pillars.map((pillar) => pillar.id), "enablers", "milestones", "asks"].map((id) => (
              <a key={id} href={`#${id}`} className="rounded px-2 py-1 text-[11px] capitalize text-ink-muted hover:bg-surface-2 hover:text-ink">{id}</a>
            ))}
          </nav>
        </div>
      </div>

      <header id="top" className="grid scroll-mt-28 gap-2 py-7">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{meta.eyebrow}</span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{meta.title}</h1>
        <p className="max-w-4xl text-sm leading-6 text-ink-muted">Where each pillar stands against the 2026 goal and FY27 target, the so-whats from September, and the strategic initiatives that need the ELT&apos;s attention.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted"><span>Prepared by {meta.preparedBy}</span><span>{meta.asOf}</span><span>{meta.finance}</span></div>
      </header>

      <Card className="mb-5 gap-2 rounded-md border-warn/40 border-l-4 border-l-warn bg-warn-soft px-4 py-3 text-xs text-ink">
        <b className="text-[11px] uppercase tracking-[0.08em] text-gold-deep">Read this first · working MVP</b>
        <p>This is a top-level sheet with a status line for every SI. Owners fill in status and recent updates before the meeting; an initiative marked TBD is not a judgement.</p>
        <p className="text-ink-muted">Coming next: leader inboxes, below-the-line functional work and deeper charter data.</p>
      </Card>

      <section aria-label="Strategy house" className="grid gap-1 pb-7">
        <div className="bg-navy px-5 pb-3 pt-8 text-center text-white [clip-path:polygon(0_100%,50%_0,100%_100%)]">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Mission · To Perfect the Vacation Rental Experience</p>
          <p className="mt-1 text-lg font-semibold">$300M EBITDA by 12/31/28 · FY27 budget $180M, BHAG $200M</p>
        </div>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-5">
          {pillars.map((pillar) => (
            <a key={pillar.id} href={`#${pillar.id}`} className={`grid gap-1 border-t-4 bg-surface p-3 transition hover:bg-surface-2 ${pillar.status === "risk" ? "border-t-risk" : pillar.status === "warn" ? "border-t-warn" : "border-t-ok"}`}>
              <span className="text-sm font-semibold text-ink">{pillar.number} · {pillar.name}</span>
              <span className="text-[11px] text-ink-muted">{pillar.owner}</span>
              <span className="mt-1 text-[11px] text-ink-muted">{pillar.measure}</span>
              <span className="tabular text-lg font-semibold text-ink">{pillar.actual}</span>
              <span className="text-[10px] text-ink-faint">{pillar.target}</span>
              <StatusBadge tone={pillar.status}>{pillar.status === "risk" ? "Behind" : pillar.status === "warn" ? "On goal / watch" : "Ahead"}</StatusBadge>
            </a>
          ))}
        </div>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-5">
          {enablers.map(([name, owner, id]) => <a key={id} href={`#${id}`} className="bg-surface-2 px-3 py-2 text-xs font-semibold text-ink">{name}<span className="mt-0.5 block text-[10px] font-normal text-ink-muted">{owner}</span></a>)}
        </div>
        <div className="bg-navy px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-white">Servant Leadership · Ownership Mentality · Local · Excellence</div>
      </section>

      <section id="summary" className="scroll-mt-28 border-t border-border py-7">
        <SectionHeader id="summary-heading" title="Summary" owner="Four things to take from September" />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryTiles.map(([label, value, delta, tone]) => <Card key={label} className="gap-0 rounded-md py-3"><CardContent className="px-3"><p className="text-xs text-ink-muted">{label}</p><p className="tabular mt-1 text-2xl font-semibold text-ink">{value}</p><p className={`mt-1 text-[11px] ${tone === "risk" ? "text-risk" : "text-ok"}`}>{delta}</p></CardContent></Card>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>So what</CardTitle></CardHeader><CardContent className={PAD}><ul className="grid gap-3 text-xs leading-5 text-ink-muted"><li><b className="text-ink">Shops beat, centre spent it.</b> Shop NOI was $1.0M over budget; Support and BD took it all, so Adj. EBITDA missed by $30K.</li><li><b className="text-ink">M&A is the year&apos;s engine.</b> 20 deals and $34.5M closed, 50% over the goal.</li><li><b className="text-ink">Retention had its best month, still behind on the year.</b> September was 10.4% annualized versus 12.4% YTD.</li><li><b className="text-ink">CAC is the number nobody has explained.</b> September was $7,639, 55% over budget.</li></ul></CardContent></Card>
          <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>Where the pillars stand</CardTitle></CardHeader><CardContent className={PAD}><div className="grid gap-2">{pillars.map((pillar) => <a key={pillar.id} href={`#${pillar.id}`} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0"><span className="font-medium text-ink">{pillar.name}</span><span className="tabular text-ink-muted">{pillar.actual}</span><StatusBadge tone={pillar.status} /></a>)}</div></CardContent></Card>
        </div>
      </section>

      <section id="financials" className="scroll-mt-28 border-t border-border py-7">
        <SectionHeader id="financials-heading" title="September financials" owner="Base business · Finance Flash Results, vFinal 12 Oct" />
        <div className="grid gap-4 xl:grid-cols-2">
          <div><h3 className="mb-2 text-sm font-semibold text-ink">P&L · September MTD and YTD ($M)</h3><ReviewTable caption="P&L, September MTD and YTD" headers={["Line", "Sept", "vs Bud", "vs PY", "YTD", "vs Bud", "vs PY"]} rows={financeRows} /></div>
          <div><h3 className="mb-2 text-sm font-semibold text-ink">KPIs · September MTD and YTD</h3><ReviewTable caption="KPIs, September MTD and YTD" headers={["KPI", "Sept", "Budget", "PY", "YTD", "Budget", "PY"]} rows={kpiRows} /></div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>LTM pro forma lender EBITDA</CardTitle></CardHeader><CardContent className={PAD}><div className="flex h-32 items-end gap-2 border-b border-l border-border px-3 pb-0">{ebitdaTrend.map((point) => <div key={point.m} className="flex-1 rounded-t-sm bg-navy/80" style={{ height: `${Math.max(8, Math.min(100, (point.v / Math.max(...ebitdaTrend.map((item) => item.v))) * 100))}%` }} title={`${point.m}: $${point.v.toFixed(1)}M`} />)}</div><p className="mt-3 text-xs text-ink-muted">Live from the editable EBITDA build. Each bar is a reporting-period observation.</p></CardContent></Card>
          <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>So what in the bridge</CardTitle></CardHeader><CardContent className={PAD}><ul className="grid gap-3 text-xs leading-5 text-ink-muted"><li><b className="text-ink">Rent drove the beat.</b> Commission revenue was $1.3M over budget.</li><li><b className="text-ink">Maintenance is losing money faster than planned.</b> Margin was −33% versus −12% budget.</li><li><b className="text-ink">Support ate the beat.</b> Support labor and other costs were −$0.9M.</li></ul></CardContent></Card>
        </div>
      </section>

      {pillars.map((pillar) => (
        <section key={pillar.id} id={pillar.id} className="scroll-mt-28 border-t border-border py-7">
          <SectionHeader id={`${pillar.id}-heading`} title={`Pillar ${pillar.number} · ${pillar.name}`} owner={pillar.owner} tone={pillar.status} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className={CARD}>
              <CardHeader className={PAD}><CardTitle role="heading" aria-level={3} className="text-xs uppercase tracking-[0.08em] text-ink-faint">Measure · {pillar.measure}</CardTitle></CardHeader>
              <CardContent className={PAD}>
              <div className="flex flex-wrap items-baseline gap-3"><span className="tabular text-3xl font-semibold text-ink">{pillar.actual}</span><span className="text-xs text-ink-muted">{pillar.headline}</span></div>
              <Gauge tone={pillar.status} value={pillar.number === 3 ? 12.4 : pillar.number === 4 ? 4.4 : pillar.number === 5 ? 28 : pillar.number === 2 ? 46 : 34.5} target={pillar.number === 3 ? 12 : pillar.number === 4 ? 3.3 : pillar.number === 5 ? 25 : pillar.number === 2 ? 30 : 23} />
              <p className="text-xs text-ink-muted"><b className="text-ink">Target:</b> {pillar.target}</p>
              </CardContent>
            </Card>
            <Card className={CARD}><CardHeader className={PAD}><CardTitle role="heading" aria-level={3}>So what</CardTitle></CardHeader><CardContent className={PAD}><ul className="grid gap-3 text-xs leading-5 text-ink-muted">{pillar.soWhat.map((item) => <li key={item} className="relative pl-4 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-ink-faint">{item}</li>)}</ul></CardContent></Card>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-ink">Strategic initiatives <span className="font-normal text-ink-muted">· select a card to open its charter</span></h3>
          <div className="grid gap-3 md:grid-cols-2">{pillar.initiatives.map((initiative) => <InitiativeCard key={initiative.code} initiative={initiative} onOpen={openCharter} />)}</div>
        </section>
      ))}

      <section id="enablers" className="scroll-mt-28 border-t border-border py-7">
        <SectionHeader id="enablers-heading" title="Enablers" owner="The capabilities that make the pillars executable" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{enablers.map(([name, owner, id]) => <Card key={id} id={id} className={`${CARD} scroll-mt-28 items-start`}><CardHeader className={`${PAD} self-stretch`}><CardTitle role="heading" aria-level={3} className="text-base">{name}</CardTitle><p className="text-xs text-ink-muted">{owner}</p></CardHeader><CardContent className={`${PAD} grid justify-items-start gap-3`}><p className="text-xs leading-5 text-ink-muted">Leader view and charter detail to be completed in the next dashboard iteration.</p><StatusBadge tone="neutral">TBD</StatusBadge></CardContent></Card>)}</div>
      </section>

      <section id="milestones" className="scroll-mt-28 border-t border-border py-7">
        <SectionHeader id="milestones-heading" title="Upcoming milestones" owner="The next dates that change the conversation" />
        <Card className="gap-0 rounded-md py-0">{pillars.flatMap((pillar) => pillar.initiatives.flatMap((initiative) => initiative.milestones.slice(0, 2).map((milestone) => ({ pillar, initiative, milestone })))).slice(0, 12).map(({ pillar, initiative, milestone }) => { const [title, date] = milestone.split(" · "); return <div key={`${initiative.code}-${milestone}`} className="grid gap-2 border-b border-border/60 px-4 py-3 last:border-0 sm:grid-cols-[110px_1fr_auto] sm:items-baseline"><span className="tabular text-xs text-ink-muted">{date ?? "TBD"}</span><span className="text-xs text-ink"><b className="font-semibold">{title}</b><span className="ml-2 text-ink-muted">{initiative.name}</span></span><span className="text-[10px] uppercase tracking-[0.08em] text-ink-faint">{pillar.name}</span></div>; })}</Card>
      </section>

      <section id="asks" className="scroll-mt-28 border-t border-border py-7">
        <SectionHeader id="asks-heading" title="Asks by leader" owner="Decisions and unblockers for the ELT meeting" />
        <div className="grid gap-3 md:grid-cols-2">{pillars.flatMap((pillar) => pillar.initiatives.filter((initiative) => initiative.ask).map((initiative) => <Card key={initiative.code} className={`${CARD} gap-0 border-navy/20 bg-navy/5`}><CardContent className={PAD}><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-navy-deep">{initiative.sponsor}</p><h3 className="mt-1 font-semibold text-ink">{initiative.name}</h3><p className="mt-2 text-xs leading-5 text-ink-muted">{initiative.ask}</p></CardContent></Card>))}</div>
      </section>

      <footer className="border-t border-border py-7 text-xs text-ink-faint"><p>Sources: September Flash Results, AwayDNA operating pack, FY27 strategic initiative charters and the 13 Oct 2026 ELT working session.</p><p className="mt-1">Confidential · for Awayday leadership</p></footer>

      <Dialog open={charterOpen} onOpenChange={(open) => { if (!open) closeCharter(); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-5">
          {selected && (
            <>
              <DialogHeader className="pr-10">
                <p className="tabular text-[10px] text-ink-faint">{selected.code}</p>
                <DialogTitle className="text-xl">{selected.name}</DialogTitle>
                <DialogDescription className="text-xs">{selected.sponsor} · {selected.owner}</DialogDescription>
              </DialogHeader>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 h-8 w-8 p-0" aria-label="Close charter"><X size={17} aria-hidden /></Button>
              </DialogClose>
              <div className="grid gap-4 text-sm"><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">What it is</p><p className="mt-1 leading-6 text-ink-muted">{selected.what}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">What it is going for</p><p className="mt-1 leading-6 text-ink-muted">{selected.goal}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Milestones</p><ul className="mt-2 grid gap-2">{selected.milestones.map((milestone) => <li key={milestone} className="flex gap-2 text-xs text-ink-muted"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" aria-hidden />{milestone}</li>)}</ul></div>{selected.ask && <div className="rounded-md bg-navy/5 p-3 text-xs text-navy-deep"><CircleHelp size={14} className="mr-1 inline" aria-hidden />{selected.ask}</div>} {linkMap.get(selected.code) && <Button asChild variant="link" size="xs" className="justify-self-start font-semibold text-navy-deep"><a href={`/initiatives/${linkMap.get(selected.code)}`}>Open full initiative record <ArrowUpRight size={13} aria-hidden /></a></Button>}</div>
              <DialogFooter className="sm:justify-start">
                <DialogClose asChild>
                  <Button type="button" variant="outline" size="sm"><ArrowLeft size={14} aria-hidden /> Back to review</Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
