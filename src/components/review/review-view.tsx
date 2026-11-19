import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ReviewPeriod, ReviewPlan } from "@/lib/review-data";
import type { FinanceTable } from "@/lib/review-kpi";
import type { ReviewedReport } from "@/lib/review-report-data";
import { addDaysIso, FINANCIALS_SCOPE, fmtLong, NOT_CONFIGURED_LABEL, ragLabel, ragTone, STATUS_GAP_TEXT, SUMMARY_SCOPE, type Rag, type ReviewArea, type ReviewMilestone, type SoWhat } from "@/lib/review-model";
import { AsksByLeaderToggle } from "./asks-by-leader";
import { DataTable } from "./data-table";
import { AreaEditor, MeasureValueEditor, PlanHeaderEditor, ReviewDetailsEditor, SiUpdateEditor, SoWhatsEditor } from "./edit-dialogs";
import { Editable, EditModeBar, EditModeProvider, EditModeToggle, EditOnly } from "./edit-mode";
import { PeriodSwitcher } from "./period-switcher";
import { NoDataNote, SectionTitle } from "./preview";
import { PageHeader } from "@/components/shell/page-header";
import { SiCard } from "./si-charter-dialog";
import { SoWhatList, soWhatItems, toneForRag, toneForStatuses } from "./so-whats";
import { ExecSummary, PopulationCard, ReportSectionTable } from "./report-sections";
import { PillarScorecardDetails } from "./pillar-scorecard";
import { TrendChartCard } from "./trend-chart";
import { BrandChurnTable } from "./brand-churn-table";
import { PeriodStatusBadge } from "./status";
import { KpiGauge } from "./kpi-gauge";
import { KpiStatusBadge, MixedPerformanceChip } from "./kpi-status-badge";
import { inferGaugeFormat, looksLikeDifferentQuantity, suggestDomain, type GaugeSpec } from "@/lib/kpi-gauge";
import { resolveDirection, ragToStatus, summarizeStatuses, KPI_STATUS_META, type KpiStatus, type StatusTone } from "@/lib/kpi-status";
import { parseNumber, parseTargetMarkers, targetMarkerLabel } from "@/lib/review-format";
import { SummaryGantt } from "./summary-gantt";

function anchor(area: ReviewArea): string {
  return `${area.kind === "ENABLER" ? "enabler" : "pillar"}-${area.code.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/** The review's pillar RAG as badge tones: green ahead, amber on track, red behind. */
const PILLAR_TONE: Record<Rag, StatusTone> = { GREEN: "good", AMBER: "warn", RED: "crit", GREY: "neutral" };

export function MeasureStatus({ area, className }: { area: ReviewArea; className?: string }) {
  // The measure's own status (a hand-set owner status wins over the calculated
  // one) expressed in the shared KPI vocabulary, so the house, the tables and
  // the scorecards all say the same words.
  const measure = area.measure;
  const status = measure ? ragToStatus(measure.rag) : "no_data";
  // The pillar RAG is green / amber / red, and "on track" is the amber one: the
  // badge follows the same colour as the pillar's own house card.
  const tone = measure ? PILLAR_TONE[measure.rag] : "neutral";
  // October is judged against the 2026 goal. When that goal (or the measure's
  // direction or reporting basis) is not configured, the pillar says so instead
  // of showing a status borrowed from an FY27 figure. A status set by hand is
  // an explicit approval and is shown as such.
  const gap = measure?.statusGap ?? null;
  if (measure && gap && !measure.statusOverride) {
    return <KpiStatusBadge status={status} tone={tone} label={NOT_CONFIGURED_LABEL} title={STATUS_GAP_TEXT[gap]} className={className} />;
  }
  // An approved status may carry the reviewer's own wording ("Ahead · CAC off
  // track"). The status word still sets the colour; the wording is shown as it
  // was approved so the combined statement survives instead of collapsing into
  // its first half.
  const wording = measure?.statusWording ?? null;
  if (measure && wording && measure.statusOverride) {
    return <KpiStatusBadge status={status} tone={tone} label={wording} title={`${wording} — ${KPI_STATUS_META[status].meaning}`} className={className} />;
  }
  return <KpiStatusBadge status={status} tone={tone} className={className} />;
}

/** The measure's status in the shared vocabulary, for tones and so-whats. */
function measureStatus(area: ReviewArea): KpiStatus {
  return area.measure ? ragToStatus(area.measure.rag) : "no_data";
}

/**
 * A gauge from an area's own measure, or null when there is nothing numeric to
 * plot. The domain is derived from the value and its target; the status is the
 * area's approved status, never a fresh judgement.
 */
function measureGauge(area: ReviewArea): GaugeSpec | null {
  const value = parseNumber(area.measure?.value ?? null);
  // The definitions state their own targets, sometimes several ("23% budget;
  // 28% stretch"). Every labelled figure the definition supplies becomes a
  // marker; nothing is added that the definition does not say.
  const markers = parseTargetMarkers(area.measure?.target);
  if (value == null || markers.length === 0) return null;
  // A level plotted against growth percentages is not a comparison: no gauge is
  // better than one whose axis mixes two quantities.
  if (
    looksLikeDifferentQuantity({
      actual: value,
      targets: markers.map((m) => m.value),
      actualText: area.measure?.value,
      targetText: area.measure?.target,
    })
  ) {
    return null;
  }
  // The approved mapping's own direction wins; the name is only a fallback for
  // a measure with no mapping.
  const reading = resolveDirection(area.measure?.higherIsBetter, area.measure?.name);
  const domain = suggestDomain([value, ...markers.map((m) => m.value)]);
  return {
    min: domain.min,
    max: domain.max,
    actual: value,
    targets: markers.map((m) => ({ id: m.id, label: targetMarkerLabel(m), value: m.value, style: m.style })),
    // An explicit "<" on a target always wins. Otherwise the declared direction
    // decides; when nothing states one, the gauge says so and stays neutral
    // instead of implying that higher is good.
    direction: markers.some((m) => m.lowerIsBetter) ? "lower" : reading.known ? reading.direction : "unknown",
    format: inferGaugeFormat(area.measure?.value, area.measure?.target),
  };
}

/** Count-based mixed-performance chip for an area, from its detailed scorecard. */
function areaStatusSummary(scorecard: ReviewedReport["scorecards"][string] | undefined) {
  if (!scorecard) return null;
  const statuses = scorecard.rows
    .filter((row) => !row.expectedOnly)
    .map((row): KpiStatus => ragToStatus(row.status === "ahead" ? "GREEN" : row.status === "on_track" ? "AMBER" : row.status === "behind" ? "RED" : "GREY"));
  if (statuses.length === 0) return null;
  return summarizeStatuses(statuses);
}

function eyebrow(area: ReviewArea): string {
  return area.kind === "VALUE_DRIVER" ? `Pillar ${area.number}` : "Enabler";
}

/** The area's own fields in Edit Mode; areas synthesised from a plan without StrategicArea rows have none to edit. */
function EditableArea({ area, periodId, periodLabel, className, children }: { area: ReviewArea; periodId: string; periodLabel: string; className?: string; children: ReactNode }) {
  if (!area.id) return <div className={className}>{children}</div>;
  return (
    <Editable
      label={area.name}
      className={className}
      editor={<AreaEditor areaId={area.id} eyebrow={eyebrow(area)} name={area.name} goal={area.goal} owner={area.owner} measure={area.measure} periodId={periodId} periodLabel={periodLabel} isPillar={area.kind === "VALUE_DRIVER"} />}
    >
      {children}
    </Editable>
  );
}

/** The month's measure value in Edit Mode, when the area has a KPI definition to hold it. */
function EditableMeasure({ area, periodId, periodLabel, children }: { area: ReviewArea; periodId: string; periodLabel: string; children: ReactNode }) {
  const measure = area.measure;
  if (!area.id || !measure?.kpiId) return <div>{children}</div>;
  return (
    <Editable
      label={`${area.name} measure`}
      periodLocked
      editor={<MeasureValueEditor areaId={area.id} periodId={periodId} periodLabel={periodLabel} name={measure.name} target={measure.target} value={measure.value} source={measure.source} origin={measure.origin} isPillar={area.kind === "VALUE_DRIVER"} statusOverride={measure.statusOverride ?? null} approvedStatus={measure.approvedStatus ?? null} />}
    >
      {children}
    </Editable>
  );
}

function AreaSection({
  area,
  soWhats,
  periodId,
  periodLabel,
  monthName,
  scorecard,
}: {
  area: ReviewArea;
  soWhats: SoWhat[];
  periodId: string;
  periodLabel: string;
  monthName: string;
  scorecard: ReviewedReport["scorecards"][string] | undefined;
}) {
  const isPillar = area.kind === "VALUE_DRIVER";
  const gauge = measureGauge(area);
  const summary = areaStatusSummary(scorecard);
  return (
    <Card id={anchor(area)} className="scroll-mt-20 gap-0 p-5">
      <EditableArea area={area} periodId={periodId} periodLabel={periodLabel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">
              {isPillar ? `Pillar ${area.number}` : "Enabler"} · {area.name}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-ink">{area.name}</h3>
            {area.ownerLine && <p className="mt-1 text-xs text-ink-muted">{area.ownerLine}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <MeasureStatus area={area} />
            {summary && <MixedPerformanceChip summary={summary} />}
          </div>
        </div>
      </EditableArea>

      {(area.measure || area.goal) && (
        <div className="mt-4 grid gap-4 border-y border-border/70 py-4 md:grid-cols-[minmax(0,16rem)_1fr]">
          <EditableMeasure area={area} periodId={periodId} periodLabel={periodLabel}>
            <p className="text-note text-ink-faint">Measure · {area.measure?.name || "not set"}</p>
            <p className="tabular text-3xl font-semibold tracking-tight text-ink">{area.measure?.value ?? "—"}</p>
            {area.measure?.value && area.measure.source === "manual" && <p className="mt-1 text-xs text-ink-faint">Entered by hand.</p>}
            {area.measure?.value && area.measure.source === "derived" && <p className="mt-1 text-xs text-ink-faint">Calculated from {area.measure.inputs?.join(" and ")}.</p>}
            {!area.measure?.value && <p className="mt-1 text-xs text-ink-faint">No value loaded for this month.</p>}
            {area.measure?.statusOverride && <p className="mt-1 text-xs text-ink-faint">Status set by hand. Calculated: {ragLabel(area.measure.calculatedRag ?? "GREY")}.</p>}
            {area.measure?.statusGap && !area.measure.statusOverride && (
              <p className="mt-1 text-xs text-ink-faint">{STATUS_GAP_TEXT[area.measure.statusGap]}</p>
            )}
            {area.measure?.primary === "missing" && (
              <p className="mt-1 text-xs text-ink-faint">Primary measure not configured. Choose one on Admin › Measure mappings; no status is claimed until then.</p>
            )}
            {area.measure?.primary === "ambiguous" && (
              <p className="mt-1 text-xs text-ink-faint">
                More than one measure is mapped, so no primary is shown: {area.measure.ambiguousKpis?.join(", ")}. Leave one mapping active.
              </p>
            )}
          </EditableMeasure>
          <EditableArea area={area} periodId={periodId} periodLabel={periodLabel}>
            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-ink">Target</dt>
                <dd className="mt-0.5 text-ink-muted">{area.measure?.target || "Not set"}</dd>
              </div>
              {area.goal && (
                <div>
                  <dt className="font-semibold text-ink">Objective</dt>
                  <dd className="mt-0.5 text-ink-muted">{area.goal}</dd>
                </div>
              )}
            </dl>
          </EditableArea>
          {gauge && (
            <div className="md:col-span-2">
              <KpiGauge
                spec={gauge}
                status={measureStatus(area)}
                caption={`${area.measure?.name ?? area.name}, ${monthName}. Markers are the targets the definition states; the value and its status come from the approved observation for this period.`}
              />
              <p className="mt-1 text-note text-ink-faint">
                {monthName} actual against the targets the definition states
                {area.measure?.origin?.status.basis ? ` · ${area.measure.origin.status.basis}` : ""}. The range is derived from those values, not stored.
              </p>
            </div>
          )}
        </div>
      )}

      <PillarScorecardDetails scorecard={scorecard} monthName={monthName} />

      <AreaSoWhats area={area} soWhats={soWhats} periodId={periodId} />

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold text-ink">Strategic initiatives · click a card to open its charter</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {area.sis.map((si) => (
            <Editable key={si.id} label={`${si.shortCode} update`} periodLocked className="flex flex-col" editor={<SiUpdateEditor periodId={periodId} periodLabel={periodLabel} si={si} />}>
              <SiCard si={si} />
            </Editable>
          ))}
          {area.sis.length === 0 && <p className="text-xs text-ink-faint">No strategic initiatives in this area.</p>}
        </div>
      </div>
    </Card>
  );
}

function AreaSoWhats({ area, soWhats, periodId }: { area: ReviewArea; soWhats: SoWhat[]; periodId: string }) {
  const editor = <SoWhatsEditor periodId={periodId} scope={area.code} scopeLabel={area.name} items={soWhats} />;
  if (soWhats.length === 0) {
    return (
      <EditOnly>
        <Editable label={`${area.name} so-whats`} periodLocked wide className="mt-4" editor={editor}>
          <p className="rounded-lg border border-dashed border-border px-3 py-2 pr-20 text-xs text-ink-faint">No so-whats for this section. Click to add some.</p>
        </Editable>
      </EditOnly>
    );
  }
  return (
    <Editable label={`${area.name} so-whats`} periodLocked wide className="mt-4" editor={editor}>
      <p className="mb-2 text-xs font-semibold text-ink">So what</p>
      <SoWhatList items={soWhatItems(soWhats)} tone={toneForRag(area.measure?.rag)} />
    </Editable>
  );
}

/**
 * The commentary under the financial tables — the reviewed report's "so what in
 * the bridge" items. Its own scope, so it is never confused with a pillar's
 * commentary. Tones come from the stored value, item by item; nothing is
 * inferred from the wording.
 */
function FinancialSoWhats({ items, periodId }: { items: SoWhat[]; periodId: string }) {
  const editor = <SoWhatsEditor periodId={periodId} scope={FINANCIALS_SCOPE} scopeLabel="financial bridge" items={items} />;
  if (items.length === 0) {
    return (
      <EditOnly>
        <Editable label="financial bridge so-whats" periodLocked wide className="mt-4" editor={editor}>
          <p className="rounded-lg border border-dashed border-border px-3 py-2 pr-20 text-xs text-ink-faint">
            No finance so-whats for this month. Click to add some.
          </p>
        </Editable>
      </EditOnly>
    );
  }
  return (
    <Editable label="financial bridge so-whats" periodLocked wide className="mt-4" editor={editor}>
      <p className="mb-2 text-xs font-semibold text-ink">So what in the bridge (October vs budget)</p>
      <SoWhatList items={soWhatItems(items)} />
    </Editable>
  );
}

export function ReviewView({
  plan,
  period,
  periods,
  home,
  finance,
  report,
  today,
  canAuthor = false,
  canEdit = false,
}: {
  plan: ReviewPlan;
  period: ReviewPeriod;
  periods: string[];
  /** The month `/` shows; the switcher links it to `/`. */
  home: string;
  finance: FinanceTable;
  report: ReviewedReport;
  today: string;
  /** Admins (Strategy) get the full editor, where months are published. */
  canAuthor?: boolean;
  /** Admins and editors get Edit Mode. */
  canEdit?: boolean;
}) {
  const pillars = plan.areas.filter((a) => a.kind === "VALUE_DRIVER");
  const enablers = plan.areas.filter((a) => a.kind === "ENABLER");
  const sis = plan.areas.flatMap((a) => a.sis);
  const windowStart = addDaysIso(today, -30);
  const windowEnd = addDaysIso(today, 60);
  const milestones: ReviewMilestone[] = sis
    .flatMap((s) => s.milestones)
    .filter((m) => !m.done && m.date && m.date >= windowStart && m.date <= windowEnd)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const withMeasure = plan.areas.filter((a) => a.measure);
  const statusTbd = sis.every((s) => !s.status);
  const hasTrend = report.charts.some((chart) => chart.series.some((series) => series.points.length > 0));
  const jump: [string, string][] = [
    ["#exec", "Executive summary"],
    ["#summary", "Summary"],
    ["#financials", "Financials"],
    ...(hasTrend ? [["#trends", "Trends"] as [string, string]] : []),
    ...pillars.map((a): [string, string] => [`#${anchor(a)}`, a.name]),
    ...(report.brandChurn.rows.length > 0 ? [["#churn", "Brand churn"] as [string, string]] : []),
    ...(enablers.length ? [["#enablers", "Enablers"] as [string, string]] : []),
    ["#milestones", "Milestones"],
    ["#asks", "Asks"],
    ["#sources", "Sources"],
  ];

  const locked = period.status === "PUBLISHED";
  const houseEditor = plan.id ? <PlanHeaderEditor planId={plan.id} mission={plan.mission} goal={plan.goal} values={plan.values} /> : null;
  const roof = (
    <div className="strategy-house__roof">
      {plan.mission && <p>Mission · {plan.mission}</p>}
      {plan.goal && <p>{plan.goal}</p>}
    </div>
  );
  const values = plan.values.length > 0 && <div className="strategy-house__values">{plan.values.join(" · ")}</div>;

  const page = (
    <div className="mx-auto flex max-w-page flex-col gap-8">
      <PageHeader
        eyebrow="Awayday · Monthly Strategy Review"
        title={`${period.label} Strategy Review`}
        description="Where each pillar stands, the SIs behind it, and what the ELT needs to decide next."
        actions={
          <>
            <PeriodStatusBadge status={period.status} />
            <PeriodSwitcher periods={periods} current={period.id} home={home} />
            {canEdit && <EditModeToggle />}
          </>
        }
      />

      <section aria-labelledby="where-to-go-title" className="-mt-4 grid gap-3 border-y border-border py-4 sm:grid-cols-[minmax(8rem,0.7fr)_1fr_1fr] sm:items-center sm:gap-6">
        <h2 id="where-to-go-title" className="text-sm font-semibold text-ink">Where to go</h2>
        <Link href="/" aria-current="page" className="group rounded-md p-2 -mx-2 hover:bg-surface-2">
          <span className="block text-sm font-semibold text-navy-deep">Strategy Review</span>
          <span className="mt-0.5 block text-xs text-ink-muted">See overall progress, pillar health, milestones and asks.</span>
        </Link>
        <Link href="/inbox" className="group rounded-md p-2 -mx-2 hover:bg-surface-2">
          <span className="block text-sm font-semibold text-navy-deep">Inbox</span>
          <span className="mt-0.5 block text-xs text-ink-muted">Update your initiatives and submit monthly progress.</span>
        </Link>
      </section>

      <Editable
        label="review details"
        periodLocked
        className="-mt-4"
        editor={
          <ReviewDetailsEditor
            periodId={period.id}
            periodLabel={period.label}
            preparedBy={period.preparedBy}
            meetingDate={period.meetingDate}
            updatesDueDate={period.updatesDueDate}
            dataAsOf={period.dataAsOfOverride}
            observedAsOf={period.observedAsOf}
          />
        }
      >
        <p className="pr-20 text-xs text-ink-muted">
          {plan.title ?? "No active plan"}
          {period.preparedBy ? ` · Prepared by ${period.preparedBy}` : ""}
          {period.meetingDate ? ` · ELT meeting ${fmtLong(period.meetingDate)}` : ""}
          {period.dataAsOf ? ` · Data as of ${fmtLong(period.dataAsOf)}` : " · No figures loaded for this month"}
          {period.sources.length > 0 ? ` · Finance figures: ${period.sources.join(", ")}` : ""}
          {" · Highly confidential"}
        </p>
      </Editable>

      <nav aria-label="On this page" className="sticky top-0 z-10 -mx-2 flex gap-1 overflow-x-auto border-y border-border bg-bg/95 px-2 py-2 text-xs backdrop-blur">
        {jump.map(([href, label]) => (
          <a key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      {statusTbd && <p className="-mt-4 text-xs text-ink-faint">No SI has a status yet. Owners set it in Inbox.</p>}

      <section id="exec" className="scroll-mt-20">
        <SectionTitle>Executive summary · {period.monthName}</SectionTitle>
        <ExecSummary cards={report.execCards} monthName={period.monthName} />
        <p className="mt-2 text-note text-ink-faint">
          {report.counts.metricsWithValues > 0
            ? `${report.counts.metricsWithValues} reviewed metrics have a value for ${period.label}, across ${report.counts.populations} reporting ${report.counts.populations === 1 ? "population" : "populations"}. Each card names the population it belongs to; values are never carried across populations.`
            : `No reviewed-report observations are loaded for ${period.label}. The cards show the identity each one needs.`}
          {report.counts.unlinkedMetrics > 0
            ? ` ${report.counts.unlinkedMetrics} reviewed ${report.counts.unlinkedMetrics === 1 ? "metric is" : "metrics are"} not linked to a pillar yet, so they appear in the report tables but not in a scorecard.`
            : ""}
        </p>
      </section>

      <section className="strategy-house" aria-label="Strategy house">
        {houseEditor ? <Editable label="strategy house" editor={houseEditor}>{roof}</Editable> : roof}
        <div className="strategy-house__pillars" style={{ "--house-cols": Math.max(1, pillars.length) } as CSSProperties}>
          {pillars.map((a) => {
            const tone = a.measure ? ragTone(a.measure.rag) : null;
            const houseSummary = areaStatusSummary(report.scorecards[a.code]);
            return (
              <EditableArea key={a.code} area={a} periodId={period.id} periodLabel={period.label} className="flex flex-col">
                <a
                  href={`#${anchor(a)}`}
                  className={`strategy-house__pillar flex-1 ${tone ? `strategy-house__pillar--${tone}` : ""}`}
                  data-house-pillar={a.code}
                  data-house-tone={tone ?? undefined}
                >
                  <span className="text-sm font-semibold text-ink">{a.number} · {a.name}</span>
                  {a.ownerLine && <span className="mt-0.5 text-note text-ink-faint">{a.ownerLine}</span>}
                  <span className="mt-1.5 text-note leading-4 text-ink-muted">{a.measure?.name || "Measure not set"}</span>
                  {a.measure?.primary === "ambiguous" && <span className="text-nano text-ink-faint">Primary measure ambiguous</span>}
                  {a.measure?.primary === "missing" && <span className="text-nano text-ink-faint">Primary measure not selected</span>}
                  <span className="flex flex-wrap items-baseline gap-1.5">
                    <span
                      className="tabular text-2xl font-semibold leading-tight text-ink"
                      title={a.measure?.origin?.status.basis}
                      data-pillar-value={a.measure?.value ?? ""}
                    >
                      {a.measure?.value ?? "—"}
                    </span>
                    <span className="text-nano text-ink-faint">{period.monthName}</span>
                  </span>
                  {a.measure?.target && <span className="text-note leading-4 text-ink-muted">Target {a.measure.target}</span>}
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <MeasureStatus area={a} />
                    {houseSummary && <MixedPerformanceChip summary={houseSummary} />}
                  </span>
                  <span className="strategy-house__si-list">
                    {a.sis.map((si) => <span key={si.id}>{si.name}</span>)}
                  </span>
                </a>
              </EditableArea>
            );
          })}
        </div>
        {enablers.length > 0 && (
          <div className="strategy-house__enablers" style={{ "--house-cols": enablers.length } as CSSProperties}>
            {enablers.map((a) => (
              <EditableArea key={a.code} area={a} periodId={period.id} periodLabel={period.label} className="flex flex-col">
                <a href={`#${anchor(a)}`} className="flex-1">
                  <span className="font-semibold text-ink">{a.name}</span>
                  {a.ownerLine && <span className="block text-note text-ink-muted">{a.ownerLine}</span>}
                  <span className="strategy-house__si-list">
                    {a.sis.map((si) => <span key={si.id}>{si.name}</span>)}
                  </span>
                </a>
              </EditableArea>
            ))}
          </div>
        )}
        {values && (houseEditor ? <Editable label="strategy house values" editor={houseEditor}>{values}</Editable> : values)}
      </section>

      <section id="summary" className="scroll-mt-20">
        <SectionTitle>Where the pillars stand · {period.monthName}</SectionTitle>
        <Editable label="summary so-whats" periodLocked wide className="mb-4" editor={<SoWhatsEditor periodId={period.id} scope={SUMMARY_SCOPE} scopeLabel="summary" items={period.summary} />}>
          {period.summary.length > 0 ? (
            <Card className="gap-0 p-5">
              <p className="mb-3 text-xs font-semibold text-ink">So what</p>
              <SoWhatList items={soWhatItems(period.summary)} tone={toneForStatuses(pillars.map(measureStatus))} />
            </Card>
          ) : (
            <NoDataNote>Strategy hasn&apos;t written the so-whats for {period.label} yet.</NoDataNote>
          )}
        </Editable>
        {withMeasure.length > 0 ? (
          <Card className="gap-0 p-5">
            <DataTable
              minWidth="40rem"
              columns={[
                { key: "area", label: "Pillar / enabler" },
                { key: "measure", label: "Measure", align: "left" },
                { key: "value", label: period.monthName, numeric: true },
                { key: "target", label: "Target", align: "left" },
                { key: "status", label: "Status", align: "left" },
              ]}
              rows={withMeasure.map((a) => ({
                id: a.code,
                cells: {
                  area: a.name,
                  measure: `${a.measure!.name || "Not set"}${a.measure!.primary && a.measure!.primary !== "selected" ? " · no primary selected" : ""}`,
                  value: a.measure!.value ?? "—",
                  target: a.measure!.target || "Not set",
                  status: <MeasureStatus area={a} />,
                },
              }))}
            />
            <p className="mt-2 text-note text-ink-faint">Status compares this month&apos;s value with the target. SI status comes from owner updates; TBD means nothing entered.</p>
          </Card>
        ) : (
          <NoDataNote>This plan has no leading measures per area yet.</NoDataNote>
        )}
      </section>

      <section id="financials" className="scroll-mt-20">
        <SectionTitle>{period.monthName} financials</SectionTitle>
        {finance.rows.length > 0 ? (
          <Card className="gap-0 p-5">
            <DataTable
              minWidth="40rem"
              columns={[{ key: "line", label: "Line" }, ...finance.columns.map((c) => ({ key: c.key, label: c.label, numeric: true }))]}
              rows={finance.rows.map((r) => ({ id: r.id, cells: { line: r.label, ...Object.fromEntries(finance.columns.map((c) => [c.key, r.cells[c.key] ?? "—"])) } }))}
            />
            <p className="mt-2 text-note text-ink-faint">Approved, consolidated values loaded for {period.label}.</p>
          </Card>
        ) : (
          <NoDataNote>No Awayday consolidated Finance figures have been loaded for {period.label}. The reviewed report tables below use their own populations and are not a substitute for consolidated accounts.</NoDataNote>
        )}
        {report.sections.map((section) => (
          <PopulationCard
            key={section.id}
            title={section.kind === "base-business" ? "Base Business P&L" : "Operating, unit economics and other reviewed KPIs"}
            scopeLabel={section.scopeLabel}
            description={
              section.kind === "base-business"
                ? "User-reviewed strategy report, Base Business only. Not directly comparable with Awayday consolidated totals."
                : "User-reviewed strategy report. Source definitions and reporting populations vary by metric; each metric keeps its own identity."
            }
          >
            <ReportSectionTable section={section} monthName={period.monthName} />
          </PopulationCard>
        ))}
        {report.sections.length === 0 && (
          <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-3 text-xs text-ink-muted">
            No user-reviewed report tables are loaded for {period.label}.
          </p>
        )}
        <FinancialSoWhats items={period.financials} periodId={period.id} />

        {!hasTrend && (
          <p className="mt-3 text-note text-ink-faint">
            Historical series are not loaded for {period.label}. Expected identity: one approved actual per month — LTM for the LTM Pro Forma Lender EBITDA, year
            to date for Base Business Adjusted EBITDA, and monthly for AwayDNA TRevPAR. They appear here once those observations exist.
          </p>
        )}
        {report.brandChurn.rows.length === 0 && (
          <p className="mt-1 text-note text-ink-faint">
            Brand-level churn is not loaded: no reviewed churn observation carries a brand in its entityId for {period.label}.
          </p>
        )}
      </section>

      {hasTrend && (
        <section id="trends" className="scroll-mt-20">
          <SectionTitle>Where the trend is going</SectionTitle>
          <div className="grid gap-4 xl:grid-cols-2">
            {report.charts.map((chart) => (
              <TrendChartCard key={chart.id} chart={chart} />
            ))}
          </div>
        </section>
      )}

      {report.brandChurn.rows.length > 0 && (
        <section id="churn" className="scroll-mt-20">
          <SectionTitle>Brand-level owner churn · {period.monthName}</SectionTitle>
          <Card className="gap-0 p-5">
            <BrandChurnTable churn={report.brandChurn} monthName={period.monthName} />
          </Card>
        </section>
      )}

      <section id="pillars" className="flex scroll-mt-20 flex-col gap-4">
        <SectionTitle>Value creation pillars</SectionTitle>
        {pillars.map((a) => (
          <AreaSection
            key={a.code}
            area={a}
            soWhats={period.areaSoWhats[a.code] ?? []}
            periodId={period.id}
            periodLabel={period.label}
            monthName={period.monthName}
            scorecard={report.scorecards[a.code]}
          />
        ))}
        {pillars.length === 0 && <NoDataNote>The active plan has no value drivers.</NoDataNote>}
      </section>

      {enablers.length > 0 && (
        <section id="enablers" className="flex scroll-mt-20 flex-col gap-4">
          <SectionTitle>Enablers</SectionTitle>
          {enablers.map((a) => (
            <AreaSection
              key={a.code}
              area={a}
              soWhats={period.areaSoWhats[a.code] ?? []}
              periodId={period.id}
              periodLabel={period.label}
              monthName={period.monthName}
              scorecard={report.scorecards[a.code]}
            />
          ))}
        </section>
      )}

      <section id="milestones" className="scroll-mt-20">
        <SectionTitle aside={<Link href="/timeline" className="text-navy hover:underline">Open full timeline</Link>}>Next 60 days</SectionTitle>
        <p className="mb-3 text-xs text-ink-muted">Milestones the ELT should hold. Amber dates have passed and need a status.</p>
        <SummaryGantt milestones={milestones} today={today} />
      </section>

      <section id="asks" className="scroll-mt-20">
        <SectionTitle aside={<Link href="/asks" className="text-navy hover:underline">Open full view</Link>}>Asks by leader</SectionTitle>
        <p className="mb-3 text-xs text-ink-muted">The same two asks for every SI: latest progress, what next. Click an SI to open its charter.</p>
        <AsksByLeaderToggle sis={sis} today={today} compact />
      </section>

      <Card id="sources" className="scroll-mt-20 gap-0 p-5">
        <SectionTitle
          aside={
            <Button asChild variant="secondary" size="sm">
              <Link href="/definitions">Metric definitions</Link>
            </Button>
          }
        >
          Sources
        </SectionTitle>
        <ul className="list-disc space-y-1.5 pl-4 text-xs text-ink-muted">
          {plan.sourceFileName && <li>{plan.sourceFileName} · pillars, targets, SIs and milestones</li>}
          {period.sources.map((s) => (
            <li key={s}>{s} · Finance figures for {period.label}</li>
          ))}
          {!plan.sourceFileName && period.sources.length === 0 && <li>No source documents recorded.</li>}
        </ul>
        <p className="mt-4 border-t border-border/70 pt-3 text-note text-ink-faint">Prepared by {period.preparedBy ? `Strategy (${period.preparedBy})` : "Strategy"} for ELT discussion. Highly confidential.</p>
      </Card>
    </div>
  );

  if (!canEdit) return page;
  return (
    <EditModeProvider locked={locked}>
      {page}
      <EditModeBar periodId={period.id} periodLabel={period.label} canPublish={canAuthor} />
    </EditModeProvider>
  );
}
