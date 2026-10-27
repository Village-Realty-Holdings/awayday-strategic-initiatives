import type { CSSProperties } from "react";
import Link from "next/link";
import { Pencil } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { planHeader } from "@/lib/plan-headers";
import type { ReviewPeriod, ReviewPlan } from "@/lib/review-data";
import type { FinanceTable } from "@/lib/review-kpi";
import { addDaysIso, fmtLong, ragLabel, ragTone, type ReviewArea, type ReviewMilestone, type SoWhat } from "@/lib/review-model";
import { AsksByLeaderToggle } from "./asks-by-leader";
import { DataTable } from "./data-table";
import { PeriodSwitcher } from "./period-switcher";
import { NoDataNote, SectionTitle } from "./preview";
import { PageHeader } from "@/components/shell/page-header";
import { SiCard } from "./si-charter-dialog";
import { SoWhatList } from "./so-whats";
import { PeriodStatusBadge, PillarLabelBadge } from "./status";
import { SummaryGantt } from "./summary-gantt";

function anchor(area: ReviewArea): string {
  return `${area.kind === "ENABLER" ? "enabler" : "pillar"}-${area.code.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function MeasureStatus({ area, className }: { area: ReviewArea; className?: string }) {
  const tone = area.measure ? ragTone(area.measure.rag) : null;
  return tone ? <PillarLabelBadge label={ragLabel(area.measure!.rag)} tone={tone} className={className} /> : <span className={`text-note text-ink-faint ${className ?? ""}`}>No data yet</span>;
}

function AreaSection({ area, soWhats }: { area: ReviewArea; soWhats: SoWhat[] }) {
  const isPillar = area.kind === "VALUE_DRIVER";
  return (
    <Card id={anchor(area)} className="scroll-mt-20 gap-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">
            {isPillar ? `Pillar ${area.number}` : "Enabler"} · {area.name}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{area.name}</h3>
          {area.ownerLine && <p className="mt-1 text-xs text-ink-muted">{area.ownerLine}</p>}
        </div>
        <MeasureStatus area={area} />
      </div>

      {(area.measure || area.goal) && (
        <div className="mt-4 grid gap-4 border-y border-border/70 py-4 md:grid-cols-[minmax(0,16rem)_1fr]">
          <div>
            <p className="text-note text-ink-faint">Measure · {area.measure?.name || "not set"}</p>
            <p className="tabular text-3xl font-semibold tracking-tight text-ink">{area.measure?.value ?? "—"}</p>
            {!area.measure?.value && <p className="mt-1 text-xs text-ink-faint">No value loaded for this month.</p>}
          </div>
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
        </div>
      )}

      {soWhats.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-ink">So what</p>
          <SoWhatList items={soWhats} />
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold text-ink">Strategic initiatives · click a card to open its charter</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {area.sis.map((si) => (
            <SiCard key={si.id} si={si} />
          ))}
          {area.sis.length === 0 && <p className="text-xs text-ink-faint">No strategic initiatives in this area.</p>}
        </div>
      </div>
    </Card>
  );
}

export function ReviewView({
  plan,
  period,
  periods,
  home,
  finance,
  today,
  canAuthor = false,
}: {
  plan: ReviewPlan;
  period: ReviewPeriod;
  periods: string[];
  /** The month `/` shows; the switcher links it to `/`. */
  home: string;
  finance: FinanceTable;
  today: string;
  /** Admins (Strategy) get the Edit review link. */
  canAuthor?: boolean;
}) {
  const header = planHeader(plan.code);
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
  const jump: [string, string][] = [
    ["#summary", "Summary"],
    ["#financials", "Financials"],
    ...pillars.map((a): [string, string] => [`#${anchor(a)}`, a.name]),
    ...(enablers.length ? [["#enablers", "Enablers"] as [string, string]] : []),
    ["#milestones", "Milestones"],
    ["#asks", "Asks"],
    ["#sources", "Sources"],
  ];

  return (
    <div className="mx-auto flex max-w-page flex-col gap-8">
      <PageHeader
        eyebrow="Awayday · Monthly Strategy Review"
        title={`${period.label} Strategy Review`}
        description="Where each pillar stands, the SIs behind it, and what the ELT needs to decide next."
        actions={
          <>
            <PeriodStatusBadge status={period.status} />
            <PeriodSwitcher periods={periods} current={period.id} home={home} />
            {canAuthor && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/review/${period.id}/edit`}>
                  <Pencil size={12} aria-hidden /> Edit review
                </Link>
              </Button>
            )}
          </>
        }
      />

      <p className="-mt-4 text-xs text-ink-muted">
        {plan.title ?? "No active plan"}
        {period.preparedBy ? ` · Prepared by ${period.preparedBy}` : ""}
        {period.meetingDate ? ` · ELT meeting ${fmtLong(period.meetingDate)}` : ""}
        {period.dataAsOf ? ` · Data as of ${fmtLong(period.dataAsOf)}` : " · No figures loaded for this month"}
        {period.sources.length > 0 ? ` · Finance figures: ${period.sources.join(", ")}` : ""}
        {" · Highly confidential"}
      </p>

      <nav aria-label="On this page" className="sticky top-0 z-10 -mx-2 flex gap-1 overflow-x-auto border-y border-border bg-bg/95 px-2 py-2 text-xs backdrop-blur">
        {jump.map(([href, label]) => (
          <a key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      {statusTbd && <p className="-mt-4 text-xs text-ink-faint">SI status is TBD until owners enter it on My SIs.</p>}

      <section className="strategy-house" aria-label="Strategy house">
        <div className="strategy-house__roof">
          <p>Mission · {header.mission}</p>
          {header.goal && <p>{header.goal}</p>}
        </div>
        <div className="strategy-house__pillars" style={{ "--house-cols": Math.max(1, pillars.length) } as CSSProperties}>
          {pillars.map((a) => {
            const tone = a.measure ? ragTone(a.measure.rag) : null;
            return (
              <a key={a.code} href={`#${anchor(a)}`} className={`strategy-house__pillar ${tone ? `strategy-house__pillar--${tone}` : ""}`}>
                <span className="text-xs font-semibold text-ink">{a.number} · {a.name}</span>
                {a.ownerLine && <span className="mt-0.5 text-note text-ink-faint">{a.ownerLine}</span>}
                <span className="mt-1 text-note text-ink-muted">{a.measure?.name || "Measure not set"}</span>
                <span className="tabular mt-1 text-xl font-semibold text-ink">{a.measure?.value ?? "—"}</span>
                {a.measure?.target && <span className="mt-1 text-note leading-4 text-ink-muted">Target {a.measure.target}</span>}
                <MeasureStatus area={a} className="mt-2 w-fit" />
                <span className="strategy-house__si-list">
                  {a.sis.map((si) => <span key={si.id}>{si.name}</span>)}
                </span>
              </a>
            );
          })}
        </div>
        {enablers.length > 0 && (
          <div className="strategy-house__enablers" style={{ "--house-cols": enablers.length } as CSSProperties}>
            {enablers.map((a) => (
              <a key={a.code} href={`#${anchor(a)}`}>
                <span className="font-semibold text-ink">{a.name}</span>
                {a.ownerLine && <span className="block text-note text-ink-muted">{a.ownerLine}</span>}
                <span className="strategy-house__si-list">
                  {a.sis.map((si) => <span key={si.id}>{si.name}</span>)}
                </span>
              </a>
            ))}
          </div>
        )}
        <div className="strategy-house__values">{header.values.join(" · ")}</div>
      </section>

      <section id="summary" className="scroll-mt-20">
        <SectionTitle>Where the pillars stand · {period.monthName}</SectionTitle>
        {period.summary.length > 0 ? (
          <Card className="mb-4 gap-0 p-5">
            <p className="mb-3 text-xs font-semibold text-ink">So what</p>
            <SoWhatList items={period.summary} />
          </Card>
        ) : (
          <div className="mb-4">
            <NoDataNote>Strategy hasn&apos;t written the so-whats for {period.label} yet.</NoDataNote>
          </div>
        )}
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
                  measure: a.measure!.name || "Not set",
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
          <NoDataNote>No Finance figures have been loaded for {period.label}.</NoDataNote>
        )}
      </section>

      <section id="pillars" className="flex scroll-mt-20 flex-col gap-4">
        <SectionTitle>Value creation pillars</SectionTitle>
        {pillars.map((a) => (
          <AreaSection key={a.code} area={a} soWhats={period.areaSoWhats[a.code] ?? []} />
        ))}
        {pillars.length === 0 && <NoDataNote>The active plan has no value drivers.</NoDataNote>}
      </section>

      {enablers.length > 0 && (
        <section id="enablers" className="flex scroll-mt-20 flex-col gap-4">
          <SectionTitle>Enablers</SectionTitle>
          {enablers.map((a) => (
            <AreaSection key={a.code} area={a} soWhats={period.areaSoWhats[a.code] ?? []} />
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
}
