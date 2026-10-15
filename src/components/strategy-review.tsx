"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  Moon,
  Sun,
  X,
} from "lucide-react";
import {
  type ReviewInitiative,
  type ReviewSnapshot,
  type ReviewTone,
} from "@/lib/strategy-review-data";

const toneClasses: Record<ReviewTone, string> = {
  good: "border-ok/25 bg-ok-soft text-ok",
  warn: "border-warn/30 bg-warn-soft text-gold-deep",
  risk: "border-risk/25 bg-risk-soft text-risk",
  neutral: "border-border bg-surface-2 text-ink-muted",
};

const toneLabel: Record<ReviewTone, string> = {
  good: "On track",
  warn: "Watch",
  risk: "Behind",
  neutral: "TBD",
};

function StatusChip({ tone, children }: { tone: ReviewTone; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${toneClasses[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children ?? toneLabel[tone]}
    </span>
  );
}

function SectionHeader({ id, title, owner, tone }: { id: string; title: string; owner?: string; tone?: ReviewTone }) {
  return (
    <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <h2 id={id} className="scroll-mt-20 text-xl font-semibold tracking-tight text-ink">{title}</h2>
      {owner && <span className="text-xs text-ink-muted">{owner}</span>}
      {tone && <StatusChip tone={tone} />}
    </header>
  );
}

function DataTable({ headers, rows, firstColumn = true }: { headers: string[]; rows: readonly (readonly string[])[]; firstColumn?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="min-w-[620px] w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {headers.map((header, index) => <th key={`${header}-${index}`} className={`px-3 py-2 ${index > 0 && firstColumn ? "text-right" : ""}`}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-border/60 last:border-0">
              {row.map((cell, index) => (
                <td key={`${row[0]}-${index}`} className={`px-3 py-2.5 ${index === 0 && firstColumn ? "font-medium text-ink" : "tabular text-ink-muted"} ${index > 0 && firstColumn ? "text-right" : ""} ${/[+]/.test(cell) ? "text-ok" : ""} ${/[−-]/.test(cell) && index > 0 ? "text-risk" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  return (
    <button
      type="button"
      onClick={() => onOpen(initiative)}
      className="group grid gap-2 rounded-md border border-border border-l-4 border-l-navy bg-surface p-4 text-left transition hover:border-navy hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="tabular block text-[10px] text-ink-faint">{initiative.code}</span>
          <span className="mt-1 block font-semibold text-ink group-hover:text-navy-deep">{initiative.name}</span>
        </span>
        <StatusChip tone={initiative.status} />
      </span>
      <span className="text-xs leading-5 text-ink-muted">{initiative.what}</span>
      <span className="border-t border-dashed border-border pt-2 text-xs text-ink-muted"><b className="font-semibold text-ink">Goal:</b> {initiative.goal}</span>
      {initiative.latestUpdate && <span className="text-[11px] leading-4 text-ink-faint"><b className="font-semibold text-ink-muted">Latest update:</b> {initiative.latestUpdate}</span>}
      <span className="flex items-center justify-end gap-1 text-[11px] font-semibold text-navy-deep">Open charter <ArrowUpRight size={13} aria-hidden /></span>
    </button>
  );
}

export function StrategyReview({ snapshot }: { snapshot: ReviewSnapshot }) {
  const { meta, pillars, enablers, summaryTiles, financeRows, kpiRows, ebitdaTrend, initiativeLinks } = snapshot;
  const [dark, setDark] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("awayday-review-theme") === "dark");
  const [selected, setSelected] = useState<ReviewInitiative | null>(() => {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.replace("#si-", "");
    return pillars.flatMap((pillar) => pillar.initiatives).find((item) => item.code === hash) ?? null;
  });
  const linkMap = useMemo(() => new Map(initiativeLinks.map((item) => [item.code, item.id])), [initiativeLinks]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("awayday-review-theme", dark ? "dark" : "light");
  }, [dark]);

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
          <button type="button" onClick={() => setDark((value) => !value)} className="ml-auto shrink-0 rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={dark ? "Use light theme" : "Use dark theme"}>
            {dark ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
          </button>
        </div>
      </div>

      <header id="top" className="grid gap-2 py-7">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{meta.eyebrow}</span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{meta.title}</h1>
        <p className="max-w-4xl text-sm leading-6 text-ink-muted">Where each pillar stands against the 2026 goal and FY27 target, the so-whats from September, and the strategic initiatives that need the ELT&apos;s attention.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted"><span>Prepared by {meta.preparedBy}</span><span>{meta.asOf}</span><span>{meta.finance}</span></div>
      </header>

      <aside className="mb-5 grid gap-2 rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn-soft px-4 py-3 text-xs text-ink">
        <b className="text-[11px] uppercase tracking-[0.08em] text-gold-deep">Read this first · working MVP</b>
        <p>This is a top-level sheet with a status line for every SI. Owners fill in status and recent updates before the meeting; an initiative marked TBD is not a judgement.</p>
        <p className="text-ink-muted">Coming next: leader inboxes, below-the-line functional work and deeper charter data.</p>
      </aside>

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
              <StatusChip tone={pillar.status}>{pillar.status === "risk" ? "Behind" : pillar.status === "warn" ? "On goal / watch" : "Ahead"}</StatusChip>
            </a>
          ))}
        </div>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-5">
          {enablers.map(([name, owner, id]) => <a key={id} href={`#${id}`} className="bg-surface-2 px-3 py-2 text-xs font-semibold text-ink">{name}<span className="mt-0.5 block text-[10px] font-normal text-ink-muted">{owner}</span></a>)}
        </div>
        <div className="bg-navy px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-white">Servant Leadership · Ownership Mentality · Local · Excellence</div>
      </section>

      <section id="summary" className="border-t border-border py-7">
        <SectionHeader id="summary-heading" title="Summary" owner="Four things to take from September" />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryTiles.map(([label, value, delta, tone]) => <div key={label} className="rounded-md border border-border bg-surface p-3"><p className="text-xs text-ink-muted">{label}</p><p className="tabular mt-1 text-2xl font-semibold text-ink">{value}</p><p className={`mt-1 text-[11px] ${tone === "risk" ? "text-risk" : "text-ok"}`}>{delta}</p></div>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-surface p-4"><h3 className="mb-3 text-sm font-semibold text-ink">So what</h3><ul className="grid gap-3 text-xs leading-5 text-ink-muted"><li><b className="text-ink">Shops beat, centre spent it.</b> Shop NOI was $1.0M over budget; Support and BD took it all, so Adj. EBITDA missed by $30K.</li><li><b className="text-ink">M&A is the year&apos;s engine.</b> 20 deals and $34.5M closed, 50% over the goal.</li><li><b className="text-ink">Retention had its best month, still behind on the year.</b> September was 10.4% annualized versus 12.4% YTD.</li><li><b className="text-ink">CAC is the number nobody has explained.</b> September was $7,639, 55% over budget.</li></ul></div>
          <div className="rounded-md border border-border bg-surface p-4"><h3 className="mb-3 text-sm font-semibold text-ink">Where the pillars stand</h3><div className="grid gap-2">{pillars.map((pillar) => <a key={pillar.id} href={`#${pillar.id}`} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0"><span className="font-medium text-ink">{pillar.name}</span><span className="tabular text-ink-muted">{pillar.actual}</span><StatusChip tone={pillar.status} /></a>)}</div></div>
        </div>
      </section>

      <section id="financials" className="border-t border-border py-7">
        <SectionHeader id="financials-heading" title="September financials" owner="Base business · Finance Flash Results, vFinal 12 Oct" />
        <div className="grid gap-4 xl:grid-cols-2">
          <div><h3 className="mb-2 text-sm font-semibold text-ink">P&L · September MTD and YTD ($M)</h3><DataTable headers={["Line", "Sept", "vs Bud", "vs PY", "YTD", "vs Bud", "vs PY"]} rows={financeRows} /></div>
          <div><h3 className="mb-2 text-sm font-semibold text-ink">KPIs · September MTD and YTD</h3><DataTable headers={["KPI", "Sept", "Budget", "PY", "YTD", "Budget", "PY"]} rows={kpiRows} /></div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-surface p-4"><h3 className="text-sm font-semibold text-ink">LTM pro forma lender EBITDA</h3><div className="mt-4 flex h-32 items-end gap-2 border-b border-l border-border px-3 pb-0">{ebitdaTrend.map((point) => <div key={point.m} className="flex-1 rounded-t-sm bg-navy/80" style={{ height: `${Math.max(8, Math.min(100, (point.v / Math.max(...ebitdaTrend.map((item) => item.v))) * 100))}%` }} title={`${point.m}: $${point.v.toFixed(1)}M`} />)}</div><p className="mt-3 text-xs text-ink-muted">Live from the editable EBITDA build. Each bar is a reporting-period observation.</p></div>
          <div className="rounded-md border border-border bg-surface p-4"><h3 className="text-sm font-semibold text-ink">So what in the bridge</h3><ul className="mt-3 grid gap-3 text-xs leading-5 text-ink-muted"><li><b className="text-ink">Rent drove the beat.</b> Commission revenue was $1.3M over budget.</li><li><b className="text-ink">Maintenance is losing money faster than planned.</b> Margin was −33% versus −12% budget.</li><li><b className="text-ink">Support ate the beat.</b> Support labor and other costs were −$0.9M.</li></ul></div>
        </div>
      </section>

      {pillars.map((pillar) => (
        <section key={pillar.id} id={pillar.id} className="border-t border-border py-7">
          <SectionHeader id={`${pillar.id}-heading`} title={`Pillar ${pillar.number} · ${pillar.name}`} owner={pillar.owner} tone={pillar.status} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-border bg-surface p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">Measure · {pillar.measure}</h3>
              <div className="mt-3 flex flex-wrap items-baseline gap-3"><span className="tabular text-3xl font-semibold text-ink">{pillar.actual}</span><span className="text-xs text-ink-muted">{pillar.headline}</span></div>
              <Gauge tone={pillar.status} value={pillar.number === 3 ? 12.4 : pillar.number === 4 ? 4.4 : pillar.number === 5 ? 28 : pillar.number === 2 ? 46 : 34.5} target={pillar.number === 3 ? 12 : pillar.number === 4 ? 3.3 : pillar.number === 5 ? 25 : pillar.number === 2 ? 30 : 23} />
              <p className="text-xs text-ink-muted"><b className="text-ink">Target:</b> {pillar.target}</p>
            </div>
            <div className="rounded-md border border-border bg-surface p-4"><h3 className="text-sm font-semibold text-ink">So what</h3><ul className="mt-3 grid gap-3 text-xs leading-5 text-ink-muted">{pillar.soWhat.map((item) => <li key={item} className="relative pl-4 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-ink-faint">{item}</li>)}</ul></div>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-ink">Strategic initiatives <span className="font-normal text-ink-muted">· select a card to open its charter</span></h3>
          <div className="grid gap-3 md:grid-cols-2">{pillar.initiatives.map((initiative) => <InitiativeCard key={initiative.code} initiative={initiative} onOpen={setSelected} />)}</div>
        </section>
      ))}

      <section id="enablers" className="border-t border-border py-7">
        <SectionHeader id="enablers-heading" title="Enablers" owner="The capabilities that make the pillars executable" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{enablers.map(([name, owner, id]) => <article key={id} id={id} className="rounded-md border border-border bg-surface p-4"><h3 className="font-semibold text-ink">{name}</h3><p className="mt-1 text-xs text-ink-muted">{owner}</p><p className="mt-3 text-xs leading-5 text-ink-muted">Leader view and charter detail to be completed in the next dashboard iteration.</p><StatusChip tone="neutral">TBD</StatusChip></article>)}</div>
      </section>

      <section id="milestones" className="border-t border-border py-7">
        <SectionHeader id="milestones-heading" title="Upcoming milestones" owner="The next dates that change the conversation" />
        <div className="grid gap-2 rounded-md border border-border bg-surface">{pillars.flatMap((pillar) => pillar.initiatives.flatMap((initiative) => initiative.milestones.slice(0, 2).map((milestone) => ({ pillar, initiative, milestone })))).slice(0, 12).map(({ pillar, initiative, milestone }) => { const [title, date] = milestone.split(" · "); return <div key={`${initiative.code}-${milestone}`} className="grid gap-2 border-b border-border/60 px-4 py-3 last:border-0 sm:grid-cols-[110px_1fr_auto] sm:items-baseline"><span className="tabular text-xs text-ink-muted">{date ?? "TBD"}</span><span className="text-xs text-ink"><b className="font-semibold">{title}</b><span className="ml-2 text-ink-muted">{initiative.name}</span></span><span className="text-[10px] uppercase tracking-[0.08em] text-ink-faint">{pillar.name}</span></div>; })}</div>
      </section>

      <section id="asks" className="border-t border-border py-7">
        <SectionHeader id="asks-heading" title="Asks by leader" owner="Decisions and unblockers for the ELT meeting" />
        <div className="grid gap-3 md:grid-cols-2">{pillars.flatMap((pillar) => pillar.initiatives.filter((initiative) => initiative.ask).map((initiative) => <article key={initiative.code} className="rounded-md border border-navy/20 bg-navy/5 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-navy-deep">{initiative.sponsor}</p><h3 className="mt-1 font-semibold text-ink">{initiative.name}</h3><p className="mt-2 text-xs leading-5 text-ink-muted">{initiative.ask}</p></article>))}</div>
      </section>

      <footer className="border-t border-border py-7 text-xs text-ink-faint"><p>Sources: September Flash Results, AwayDNA operating pack, FY27 strategic initiative charters and the 13 Oct 2026 ELT working session.</p><p className="mt-1">Confidential · for Awayday leadership</p></footer>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/35 p-4 sm:place-items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <article className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="charter-title">
            <div className="flex items-start justify-between gap-4"><div><p className="tabular text-[10px] text-ink-faint">{selected.code}</p><h2 id="charter-title" className="mt-1 text-xl font-semibold text-ink">{selected.name}</h2><p className="mt-1 text-xs text-ink-muted">{selected.sponsor} · {selected.owner}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Close charter"><X size={17} aria-hidden /></button></div>
            <div className="mt-5 grid gap-4 text-sm"><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">What it is</p><p className="mt-1 leading-6 text-ink-muted">{selected.what}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">What it is going for</p><p className="mt-1 leading-6 text-ink-muted">{selected.goal}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Milestones</p><ul className="mt-2 grid gap-2">{selected.milestones.map((milestone) => <li key={milestone} className="flex gap-2 text-xs text-ink-muted"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" aria-hidden />{milestone}</li>)}</ul></div>{selected.ask && <div className="rounded-md bg-navy/5 p-3 text-xs text-navy-deep"><CircleHelp size={14} className="mr-1 inline" aria-hidden />{selected.ask}</div>} {linkMap.get(selected.code) && <a href={`/initiatives/${linkMap.get(selected.code)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-navy-deep">Open full initiative record <ArrowUpRight size={13} aria-hidden /></a>}</div>
            <button type="button" onClick={() => setSelected(null)} className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-2"><ArrowLeft size={14} aria-hidden /> Back to review</button>
          </article>
        </div>
      )}
    </div>
  );
}
