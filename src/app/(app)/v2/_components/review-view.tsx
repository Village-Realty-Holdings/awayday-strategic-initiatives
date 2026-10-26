import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { AREAS, personName, SIS } from "../_mock/data";
import { MOCK_HEADER } from "../_mock/review-content";
import { LTM_CAPTION, LTM_SO_WHAT } from "../_mock/review-detail";
import {
  hasDetail,
  financialsFor,
  fmtLong,
  names,
  pillarsFor,
  sisForArea,
  soWhatsFor,
  upcomingMilestones,
} from "../_mock/selectors";
import type { FinanceTable, MockArea, ReviewPeriod, ReviewPillar, ReviewSoWhat } from "../_mock/types";
import { AsksByLeaderToggle } from "./asks-by-leader";
import { DataTable } from "./data-table";
import { EnablerMeasureCard } from "./enabler-measure";
import { PeriodSwitcher } from "./period-switcher";
import { PillarDetail } from "./pillar-detail";
import { MockNote, SectionTitle, V2Header } from "./preview";
import { PublishBar } from "./publish-bar";
import { ReadFirstBanner } from "./read-first-banner";
import { RegionCard } from "./region-card";
import { LtmEbitdaChart } from "./review-charts";
import { SiCard } from "./si-card";
import { SubHeading } from "./stat";
import { PillarLabelBadge } from "./status";
import { SummaryGantt } from "./summary-gantt";

function areaAnchor(code: string): string {
  return `pillar-${code.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
import { getActiveV2Plan } from "@/lib/v2-data";

type LivePlan = NonNullable<Awaited<ReturnType<typeof getActiveV2Plan>>>;

function liveTone(rag: string): "ahead" | "on_track" | "watch" | "behind" {
  if (rag === "GREEN") return "ahead";
  if (rag === "RED") return "behind";
  if (rag === "AMBER") return "watch";
  return "on_track";
}

function liveLabel(rag: string): string {
  if (rag === "GREEN") return "On track";
  if (rag === "RED") return "Behind";
  if (rag === "AMBER") return "Watch";
  return "No data";
}

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
      <DataTable
        minWidth="34rem"
        columns={table.columns.map((c, i) => ({ key: String(i), label: c, numeric: i > 0 }))}
        rows={table.rows.map((r) => ({
          id: r.line,
          bold: r.bold,
          cells: Object.fromEntries([r.line, ...r.cells].map((c, i) => [String(i), c])),
        }))}
      />
    </div>
  );
}

function PillarSection({ area, pillar, period, canEdit, detail, recordIds }: { area: MockArea; pillar: ReviewPillar; period: ReviewPeriod; canEdit: boolean; detail: boolean; recordIds: Map<string, string> }) {
  const sis = sisForArea(area.code);
  const soWhats = soWhatsFor(period.id, area.code);
  return (
    <Card id={areaAnchor(area.code)} className="scroll-mt-20 gap-0 p-5">
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

      {pillar.extra && !detail && (
        <div className="mt-4 rounded-lg bg-surface-2/60 px-3 py-2.5 text-xs text-ink-muted">
          <p className="font-semibold text-ink">{pillar.extra.title}</p>
          {pillar.extra.items.map((t) => (
            <p key={t} className="mt-1">{t}</p>
          ))}
        </div>
      )}

      {detail && (
        <div className="mt-5">
          <PillarDetail areaCode={area.code} />
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold text-ink">Strategic initiatives · click a card to open its charter</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sis.map((si) => (
            <SiCard key={si.code} si={si} periodId={period.id} recordId={recordIds.get(si.code)} />
          ))}
          {sis.length === 0 && <p className="text-xs text-ink-faint">No strategic initiatives in this area for FY27.</p>}
        </div>
      </div>
    </Card>
  );
}

export async function ReviewView({ period, canEdit, livePlan }: { period: ReviewPeriod; canEdit: boolean; livePlan?: LivePlan | null }) {
  const records = await prisma.initiative.findMany({
    where: { code: { in: SIS.map((si) => si.code) } },
    select: { id: true, code: true },
  });
  const recordIds = new Map(records.map((record) => [record.code, record.id]));
  const pillars = pillarsFor(period.id);
  const byCode = new Map(pillars.map((p) => [p.areaCode, p]));
  const fivePillars = AREAS.filter((a) => a.number).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const guest = AREAS.find((a) => a.code === "GUEST")!;
  const enablers = AREAS.filter((a) => a.kind === "ENABLER" && a.code !== "GUEST");
  const summarySoWhats = soWhatsFor(period.id, "SUMMARY");
  const fin = financialsFor(period.id);
  const milestones = upcomingMilestones(60);
  const detail = hasDetail(period.id);
  const liveValueDrivers = livePlan?.strategicAreas.filter((area) => area.kind === "VALUE_DRIVER").slice(0, 5) ?? [];
  const liveEnablers = livePlan?.strategicAreas.filter((area) => area.kind === "ENABLER").slice(0, 5) ?? [];
  const housePillars = liveValueDrivers.length > 0
    ? liveValueDrivers.map((area, index) => {
        const kpi = area.kpis[0];
        const value = kpi ? kpi.overrides[0]?.value ?? kpi.observations[0]?.value ?? null : null;
        const rag = kpi ? (kpi.observations[0]?.quality === "STALE" ? "AMBER" : value ? "GREEN" : "GREY") : "GREY";
        return {
          code: area.code,
          name: area.name,
          number: index + 1,
          measure: kpi?.name ?? "KPI not configured",
          headline: value ?? "—",
          cardSub: `Target ${kpi?.target ?? area.goal ?? "not set"}`,
          label: liveLabel(rag),
          tone: liveTone(rag),
          href: `#${areaAnchor(area.code)}`,
          initiatives: area.initiatives.map((initiative) => ({ id: initiative.id, name: initiative.name })),
        };
      })
    : fivePillars.flatMap((area) => {
        const pillar = byCode.get(area.code);
        return pillar
          ? [{ code: area.code, name: area.name, number: area.number ?? 0, measure: pillar.measure, headline: pillar.headline, cardSub: pillar.cardSub, label: pillar.label, tone: pillar.tone, href: `#${areaAnchor(area.code)}`, initiatives: sisForArea(area.code).map((si) => ({ id: si.code, name: si.name })) }]
          : [];
      });
  const houseEnablers = liveEnablers.length > 0
    ? liveEnablers.map((area) => ({
        code: area.code,
        name: area.name,
        owner: area.owner ?? "Owner not assigned",
        href: `#${area.code === "GUEST" ? areaAnchor(area.code) : `enabler-${area.code}`}`,
        initiatives: area.initiatives.map((initiative) => ({ id: initiative.id, name: initiative.name })),
      }))
    : [guest, ...enablers].flatMap((area) => {
        const pillar = byCode.get(area.code);
        return pillar ? [{ code: area.code, name: area.name, owner: `${names(area.eltOwnerIds)} · ${names(area.siLeadIds)}`, href: `#${area.code === "GUEST" ? areaAnchor(area.code) : `enabler-${area.code}`}`, initiatives: sisForArea(area.code).map((si) => ({ id: si.code, name: si.name })) }] : [];
      });

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
      <V2Header
        eyebrow="Awayday · Monthly Strategy Review"
        title={`${period.label} Strategy Review`}
        description="The few things ELT needs to know now: where the house stands, which SIs need attention, and what decisions or updates are next."
        actions={<PeriodSwitcher current={period.id} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <p className="text-xs text-ink-muted">
          Prepared by {period.preparedBy} · Data as of {period.dataAsOf} · Finance figures: {period.financeSource}
          {period.publishedAt ? ` · Published ${period.publishedAt}` : ""}
        </p>
        <PublishBar initialStatus={period.status} canEdit={canEdit} editHref={`/v2/review/${period.id}/edit`} />
      </div>

      <nav aria-label="On this page" className="sticky top-0 z-10 -mx-2 flex gap-1 overflow-x-auto border-y border-border bg-bg/95 px-2 py-2 text-xs backdrop-blur">
        {[
          ["#summary", "At a glance"],
          ["#pillars", "SIs by pillar"],
          ["#milestones", "Next 60 days"],
          ["#asks", "Owner asks"],
          ["#sources", "Sources"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      <ReadFirstBanner />

      <section className="strategy-house">
        <div className="strategy-house__roof">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">Mission · {MOCK_HEADER.mission}</p>
          <p className="mt-1 text-lg font-semibold">{MOCK_HEADER.target} · FY27 budget {MOCK_HEADER.fy27Budget} · BHAG {MOCK_HEADER.bhag}</p>
        </div>
        <div className="strategy-house__pillars">
          {housePillars.map((a) => (
            <a key={a.code} href={a.href} className={`strategy-house__pillar strategy-house__pillar--${a.tone}`}>
              <span className="text-xs font-semibold text-ink">{a.number} · {a.name}</span>
              <span className="mt-1 text-[11px] text-ink-muted">{a.measure}</span>
              <span className="tabular mt-1 text-xl font-semibold text-ink">{a.headline}</span>
              <span className="mt-1 text-[11px] leading-4 text-ink-muted">{a.cardSub}</span>
              <PillarLabelBadge label={a.label} tone={a.tone} className="mt-2 w-fit" />
              <span className="strategy-house__si-list">
                {a.initiatives.map((si) => <span key={si.id}>{si.name}</span>)}
              </span>
            </a>
          ))}
        </div>
        <div className="strategy-house__enablers">
          {houseEnablers.map((a) => (
            <a key={a.code} href={a.href}>
              <span className="font-semibold text-ink">{a.name}</span>
              <span className="block text-[11px] text-ink-muted">{a.owner}</span>
              <span className="strategy-house__si-list">
                {a.initiatives.map((si) => <span key={si.id}>{si.name}</span>)}
              </span>
            </a>
          ))}
        </div>
        <div className="strategy-house__values">{MOCK_HEADER.values.join(" · ")}</div>
      </section>

      <section id="summary" className="scroll-mt-20">
        <SectionTitle>Four things to take from {period.monthName}</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {period.tiles.map((t) => (
              <Card key={t.label} className="gap-0 p-4">
                <p className="text-[11px] text-ink-faint">{t.label}</p>
                <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">{t.value}</p>
                <p className="mt-1 text-[11px] leading-4 text-ink-muted">{t.sub}</p>
              </Card>
            ))}
          </div>
          <Card className="gap-0 p-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-deep">So what</p>
            <SoWhatList items={summarySoWhats} />
          </Card>
        </div>

        <Card className="mt-4 gap-0 p-5">
          <h3 className="mb-2 text-sm font-semibold text-ink">Where the pillars stand</h3>
          <DataTable
            minWidth="44rem"
            columns={[
              { key: "pillar", label: "Pillar" },
              { key: "measure", label: "Measure", align: "left" },
              { key: "month", label: period.monthName.slice(0, 4), numeric: true },
              { key: "ytd", label: "YTD", numeric: true },
              { key: "goal", label: "2026 goal", numeric: true },
              { key: "fy27", label: "FY27 (budget / stretch)", numeric: true },
              { key: "status", label: "Status", align: "left" },
            ]}
            rows={[...fivePillars, guest].flatMap((a) => {
              const p = byCode.get(a.code);
              if (!p) return [];
              return [
                {
                  id: a.code,
                  cells: {
                    pillar: a.name,
                    measure: p.measure,
                    month: p.monthValue,
                    ytd: p.ytdValue,
                    goal: p.goal2026,
                    fy27: p.fy27,
                    status: <PillarLabelBadge label={p.label} tone={p.tone} />,
                  },
                },
              ];
            })}
          />
          <p className="mt-2 text-[11px] text-ink-faint">
            Pillar status is judged against the 2026 goal from Finance data; FY27 shows budget / stretch. SI status comes from owner updates; TBD means nothing submitted.
          </p>
        </Card>
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

      {detail ? (
        <section id="bridge" className="flex scroll-mt-20 flex-col gap-4">
          <SectionTitle>LTM lender EBITDA and regions</SectionTitle>
          <Card>
            <CardHeader>
              <CardTitle>LTM pro forma lender EBITDA ($M)</CardTitle>
              <CardDescription>{LTM_CAPTION}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <LtmEbitdaChart />
              <p className="text-[11px] text-ink-faint">
                Dec-25, Aug-26 and Sep-26 LTM and the base business endpoints come from the MVP; the months between them are invented for the mock. The split of the +$38.6M between acquired EBITDA, executed PI and new-unit run rate is not in the MVP.
              </p>
              <div>
                <SubHeading>So what in the bridge</SubHeading>
                <ul className="mt-2 flex flex-col gap-2 text-sm leading-5 text-ink-muted">
                  {LTM_SO_WHAT.map((x) => (
                    <li key={x.headline}>
                      <span className="font-semibold text-ink">{x.headline}</span> {x.body}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          <RegionCard />
        </section>
      ) : (
        <p className="text-xs text-ink-faint">
          Charts, M&amp;A detail and brand lists are mocked for September only. <MockNote>Mock month: no detail</MockNote>
        </p>
      )}

      <section id="pillars" className="flex scroll-mt-20 flex-col gap-4">
        <SectionTitle>Value creation pillars</SectionTitle>
        {[...fivePillars, guest].map((a) => {
          const p = byCode.get(a.code);
          return p ? <PillarSection key={a.code} area={a} pillar={p} period={period} canEdit={canEdit} detail={detail} recordIds={recordIds} /> : null;
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
              <Card key={a.code} id={`enabler-${a.code}`} className="scroll-mt-20 gap-0 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink">{a.name}</h3>
                  <PillarLabelBadge label={p.label} tone={p.tone} />
                </div>
                <p className="mt-1 text-xs text-ink-muted">{p.enablerNote ?? ownersLine(a)}</p>
                {soWhatsFor(period.id, a.code).length > 0 && (
                  <div className="mt-4">
                    <SubHeading>So what</SubHeading>
                    <div className="mt-2">
                      <SoWhatList items={soWhatsFor(period.id, a.code)} />
                    </div>
                  </div>
                )}
                {detail && <EnablerMeasureCard areaCode={a.code} />}
                {p.extra && !detail && (
                  <div className="mt-3 rounded-lg bg-surface-2/60 px-3 py-2.5 text-xs text-ink-muted">
                    <p className="font-semibold text-ink">{p.extra.title}</p>
                    {p.extra.items.map((t) => (
                      <p key={t} className="mt-1">{t}</p>
                    ))}
                  </div>
                )}
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {sis.map((si) => (
                    <SiCard key={si.code} si={si} periodId={period.id} recordId={recordIds.get(si.code)} />
                  ))}
                  {sis.length === 0 && (
                    <p className="text-xs text-ink-faint">No FY27 SIs in the plan for {a.name} yet.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="milestones" className="scroll-mt-20">
        <SectionTitle aside={<Link href="/v2/timeline" className="text-navy hover:underline">Open full timeline</Link>}>Next 60 days</SectionTitle>
        <p className="mb-3 text-xs text-ink-muted">Milestones the ELT should hold. Amber dates have passed and need a status.</p>
        <SummaryGantt milestones={milestones} />
      </section>

      <section id="asks" className="scroll-mt-20">
        <SectionTitle aside={<Link href="/v2/asks" className="text-navy hover:underline">Open full view</Link>}>Asks by leader</SectionTitle>
        <p className="mb-3 text-xs text-ink-muted">The same two asks for every SI: latest progress, what next. Click an SI to open its charter.</p>
        <AsksByLeaderToggle periodId={period.id} compact />
      </section>

      <Card id="sources" className="scroll-mt-20 gap-0 p-5">
        <SectionTitle
          aside={
            <Button asChild variant="secondary" size="sm">
              <Link href="/v2/definitions">Metric definitions register</Link>
            </Button>
          }
        >
          Sources and data notes
        </SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-ink">Sources</h3>
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-ink-muted">
              {period.sources.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-ink">
              Definitions and gaps to close before November ·{" "}
              <Link href="/v2/definitions" className="font-normal text-navy hover:underline">
                full register
              </Link>
            </h3>
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
      </Card>
    </div>
  );
}
