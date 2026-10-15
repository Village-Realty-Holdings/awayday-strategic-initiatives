import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AREAS, personName } from "../_mock/data";
import { MOCK_HEADER } from "../_mock/review-content";
import {
  financialsFor,
  fmtLong,
  names,
  pillarsFor,
  sisForArea,
  soWhatsFor,
  upcomingMilestones,
} from "../_mock/selectors";
import type { FinanceTable, MockArea, ReviewPeriod, ReviewPillar, ReviewSoWhat } from "../_mock/types";
import { AsksByLeader } from "./asks-by-leader";
import { PeriodSwitcher } from "./period-switcher";
import { MockNote, SectionTitle, V2Header } from "./preview";
import { PublishBar } from "./publish-bar";
import { SiCard } from "./si-card";
import { PillarLabelBadge } from "./status";
import { TimelineGroups } from "./timeline-groups";

function SoWhatList({ items }: { items: ReviewSoWhat[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((s) => (
        <li key={s.id} className="text-sm leading-5 text-ink-muted">
          <span className="font-semibold text-ink">{s.headline}</span> {s.body}
        </li>
      ))}
    </ul>
  );
}

function ownersLine(area: MockArea): string {
  const elt = names(area.eltOwnerIds);
  const leads = names(area.siLeadIds);
  return elt === leads ? `ELT and SI leads: ${elt}` : `ELT: ${elt} · SI lead${area.siLeadIds.length > 1 ? "s" : ""}: ${leads}`;
}

function FinanceTableView({ table }: { table: FinanceTable }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-ink">{table.title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[34rem] text-xs">
          <thead className="bg-surface-2 text-ink-muted">
            <tr>
              {table.columns.map((c, i) => (
                <th key={i} className={`px-3 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {table.rows.map((r) => (
              <tr key={r.line} className={r.bold ? "font-semibold text-ink" : "text-ink-muted"}>
                <th scope="row" className="px-3 py-1.5 text-left font-medium">
                  {r.line}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className="tabular px-3 py-1.5 text-right">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PillarCard({ area, pillar }: { area: MockArea; pillar: ReviewPillar }) {
  return (
    <a href={`#pillar-${area.code}`} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-navy/40">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
          {area.number} · {area.name}
        </p>
        <PillarLabelBadge label={pillar.label} tone={pillar.tone} />
      </div>
      <p className="text-[11px] text-ink-muted">
        {names(area.eltOwnerIds)} · {names(area.siLeadIds)}
      </p>
      <div>
        <p className="text-[11px] text-ink-faint">{pillar.measure}</p>
        <p className="tabular text-2xl font-semibold tracking-tight text-ink">{pillar.headline}</p>
      </div>
      <p className="text-[11px] leading-4 text-ink-muted">{pillar.cardSub}</p>
    </a>
  );
}

function PillarSection({ area, pillar, period, canEdit }: { area: MockArea; pillar: ReviewPillar; period: ReviewPeriod; canEdit: boolean }) {
  const sis = sisForArea(area.code);
  const soWhats = soWhatsFor(period.id, area.code);
  return (
    <section id={`pillar-${area.code}`} className="scroll-mt-20 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
            {area.number ? `Pillar ${area.number}` : "Value driver"} · {area.name}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{area.name}</h3>
          <p className="mt-1 text-xs text-ink-muted">{ownersLine(area)}</p>
        </div>
        <PillarLabelBadge label={pillar.label} tone={pillar.tone} />
      </div>

      <div className="mt-4 grid gap-4 border-y border-border/70 py-4 md:grid-cols-[minmax(0,16rem)_1fr]">
        <div>
          <p className="text-[11px] text-ink-faint">Measure · {pillar.measure}</p>
          <p className="tabular text-3xl font-semibold tracking-tight text-ink">{pillar.headline}</p>
          <p className="mt-1 text-xs text-ink-muted">{pillar.headlineNote}</p>
        </div>
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">2026</dt>
            <dd className="mt-0.5 text-ink-muted">{pillar.goal2026Note || "n/a"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">FY27</dt>
            <dd className="mt-0.5 text-ink-muted">{pillar.fy27Note || "n/a"}</dd>
          </div>
        </dl>
      </div>

      {pillar.commentary && (
        <p className="mt-3 text-xs text-ink-muted">
          <span className="font-semibold text-ink">Status note:</span> {pillar.commentary}
          {canEdit && period.status === "DRAFT" && (
            <>
              {" "}
              <Link href={`/v2/review/${period.id}/edit`} className="text-navy hover:underline">
                Edit
              </Link>
            </>
          )}
        </p>
      )}

      {soWhats.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-deep">So what</p>
          <SoWhatList items={soWhats} />
        </div>
      )}

      {pillar.extra && (
        <div className="mt-4 rounded-lg bg-surface-2/60 px-3 py-2.5 text-xs text-ink-muted">
          <p className="font-semibold text-ink">{pillar.extra.title}</p>
          {pillar.extra.items.map((t) => (
            <p key={t} className="mt-1">{t}</p>
          ))}
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold text-ink">Strategic initiatives · click a card to open its charter</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sis.map((si) => (
            <SiCard key={si.code} si={si} periodId={period.id} />
          ))}
          {sis.length === 0 && <p className="text-xs text-ink-faint">No strategic initiatives in this area for FY27.</p>}
        </div>
      </div>
    </section>
  );
}

export function ReviewView({ period, canEdit }: { period: ReviewPeriod; canEdit: boolean }) {
  const pillars = pillarsFor(period.id);
  const byCode = new Map(pillars.map((p) => [p.areaCode, p]));
  const fivePillars = AREAS.filter((a) => a.number).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const guest = AREAS.find((a) => a.code === "GUEST")!;
  const enablers = AREAS.filter((a) => a.kind === "ENABLER" && a.code !== "GUEST");
  const summarySoWhats = soWhatsFor(period.id, "SUMMARY");
  const fin = financialsFor(period.id);
  const milestones = upcomingMilestones(60);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
      <V2Header
        eyebrow="Awayday · Monthly Strategy Review"
        title={`${period.label} Strategy Review`}
        description="Where each pillar stands against the 2026 goal and the FY27 target, the so-whats from the month, and one card per SI: what it is, what it is going for, the upcoming milestones, and the two things each owner brings to the meeting: latest progress and what next."
        actions={<PeriodSwitcher current={period.id} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <p className="text-xs text-ink-muted">
          Prepared by {period.preparedBy} · Data as of {period.dataAsOf} · Finance figures: {period.financeSource}
          {period.publishedAt ? ` · Published ${period.publishedAt}` : ""}
        </p>
        <PublishBar initialStatus={period.status} canEdit={canEdit} editHref={`/v2/review/${period.id}/edit`} />
      </div>

      <nav aria-label="On this page" className="-mt-4 flex gap-1 overflow-x-auto pb-1 text-xs">
        {[
          ["#summary", "Summary"],
          ["#pillars", "Pillars"],
          ["#enablers", "Enablers"],
          ["#milestones", "Next 60 days"],
          ["#asks", "Asks by leader"],
          ["#sources", "Sources"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      <section className="rounded-xl border border-navy/20 bg-navy px-6 py-5 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">Mission</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{MOCK_HEADER.mission}</h2>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/80">
          <span>{MOCK_HEADER.target}</span>
          <span>FY27 budget {MOCK_HEADER.fy27Budget}</span>
          <span>BHAG {MOCK_HEADER.bhag}</span>
        </div>
        <p className="mt-3 text-xs text-white/60">{MOCK_HEADER.values.join(" · ")}</p>
      </section>

      <section aria-label="Pillar scorecard">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {fivePillars.map((a) => {
            const p = byCode.get(a.code);
            return p ? <PillarCard key={a.code} area={a} pillar={p} /> : null;
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...enablers, guest].map((a) => (
            <a key={a.code} href={`#${a.code === "GUEST" ? `pillar-${a.code}` : `enabler-${a.code}`}`} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink-muted hover:border-navy/40">
              <span className="font-semibold text-ink">{a.name}</span> {names(a.eltOwnerIds)} · {names(a.siLeadIds)}
            </a>
          ))}
        </div>
      </section>

      <section id="summary" className="scroll-mt-20">
        <SectionTitle>Four things to take from {period.monthName}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {period.tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-[11px] text-ink-faint">{t.label}</p>
                <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">{t.value}</p>
                <p className="mt-1 text-[11px] leading-4 text-ink-muted">{t.sub}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-deep">So what</p>
            <SoWhatList items={summarySoWhats} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-2 text-sm font-semibold text-ink">Where the pillars stand</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-xs">
              <thead className="text-ink-muted">
                <tr className="border-b border-border">
                  {["Pillar", "Measure", period.monthName.slice(0, 4), "YTD", "2026 goal", "FY27 (budget / stretch)", "Status"].map((c, i) => (
                    <th key={c} className={`px-2 py-2 font-medium ${i < 2 || i === 6 ? "text-left" : "text-right"}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {[...fivePillars, guest].map((a) => {
                  const p = byCode.get(a.code);
                  if (!p) return null;
                  return (
                    <tr key={a.code}>
                      <th scope="row" className="px-2 py-2 text-left font-medium text-ink">{a.name}</th>
                      <td className="px-2 py-2 text-ink-muted">{p.measure}</td>
                      <td className="tabular px-2 py-2 text-right">{p.monthValue}</td>
                      <td className="tabular px-2 py-2 text-right">{p.ytdValue}</td>
                      <td className="tabular px-2 py-2 text-right">{p.goal2026}</td>
                      <td className="tabular px-2 py-2 text-right">{p.fy27}</td>
                      <td className="px-2 py-2"><PillarLabelBadge label={p.label} tone={p.tone} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Pillar status is judged against the 2026 goal from Finance data; FY27 shows budget / stretch. SI status comes from owner updates; TBD means nothing submitted.
          </p>
        </div>
      </section>

      {fin && (
        <details className="rounded-xl border border-border bg-surface p-5">
          <summary className="cursor-pointer text-sm font-semibold text-ink">{period.monthName} financials · base business</summary>
          <div className="mt-4 grid gap-6 xl:grid-cols-2">
            <FinanceTableView table={fin.pnl} />
            <FinanceTableView table={fin.kpis} />
          </div>
        </details>
      )}

      <section id="pillars" className="flex scroll-mt-20 flex-col gap-4">
        <SectionTitle>Value creation pillars</SectionTitle>
        {[...fivePillars, guest].map((a) => {
          const p = byCode.get(a.code);
          return p ? <PillarSection key={a.code} area={a} pillar={p} period={period} canEdit={canEdit} /> : null;
        })}
      </section>

      <section id="enablers" className="scroll-mt-20">
        <SectionTitle aside="No leading measure yet for Tech, Talent or Finance. Click a card to open its charter.">Enablers</SectionTitle>
        <div className="flex flex-col gap-4">
          {enablers.map((a) => {
            const p = byCode.get(a.code);
            if (!p) return null;
            const sis = sisForArea(a.code);
            return (
              <article key={a.code} id={`enabler-${a.code}`} className="scroll-mt-20 rounded-xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink">{a.name}</h3>
                  <PillarLabelBadge label={p.label} tone={p.tone} />
                </div>
                <p className="mt-1 text-xs text-ink-muted">{p.enablerNote ?? ownersLine(a)}</p>
                {p.extra && (
                  <div className="mt-3 rounded-lg bg-surface-2/60 px-3 py-2.5 text-xs text-ink-muted">
                    <p className="font-semibold text-ink">{p.extra.title}</p>
                    {p.extra.items.map((t) => (
                      <p key={t} className="mt-1">{t}</p>
                    ))}
                  </div>
                )}
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {sis.map((si) => (
                    <SiCard key={si.code} si={si} periodId={period.id} />
                  ))}
                  {sis.length === 0 && (
                    <p className="text-xs text-ink-faint">No FY27 SIs in the plan for {a.name} yet.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="milestones" className="scroll-mt-20">
        <SectionTitle aside={<Link href="/v2/timeline" className="text-navy hover:underline">Open full timeline</Link>}>Next 60 days</SectionTitle>
        <p className="mb-3 text-xs text-ink-muted">Milestones the ELT should hold. Amber dates have passed and need a status.</p>
        <TimelineGroups milestones={milestones} />
      </section>

      <section id="asks" className="scroll-mt-20">
        <SectionTitle aside={<Link href="/v2/asks" className="text-navy hover:underline">Open full view</Link>}>Asks by leader</SectionTitle>
        <p className="mb-3 text-xs text-ink-muted">The same two asks for every SI: latest progress, what next. Click an SI to open its charter.</p>
        <AsksByLeader periodId={period.id} compact />
      </section>

      <section id="sources" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5">
        <SectionTitle>Sources and data notes</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-ink">Sources</h3>
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-ink-muted">
              {period.sources.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-ink">Definitions and gaps to close before November</h3>
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-ink-muted">
              {period.dataNotes.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </div>
        <p className="mt-4 border-t border-border/70 pt-3 text-[11px] text-ink-faint">{period.sourcesFooter}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
          <Badge variant="outline">{period.status === "PUBLISHED" ? "Published" : "Draft"}</Badge>
          ELT review {fmtLong(period.meetingDate)} · SI updates due {fmtLong(period.updatesDueDate)} · Lead contact {personName("alex-bevington")}
          <MockNote />
        </p>
      </section>
    </div>
  );
}

