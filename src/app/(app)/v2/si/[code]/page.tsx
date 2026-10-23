import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { requireApp } from "@/lib/session";
import { MockNote, SectionTitle, V2Header } from "../../_components/preview";
import { SiStatusBadge, UpdateStateBadge } from "../../_components/status";
import { ACTION_ITEMS, ELT_ASKS, personName, updatesForSi } from "../../_mock/data";
import {
  areaByCode,
  fmtDay,
  getPeriod,
  isPastDue,
  milestoneDateLabel,
  milestonesBySi,
  names,
  siByCode,
  siShortCode,
} from "../../_mock/selectors";

export default async function SiCharterPage({ params }: { params: Promise<{ code: string }> }) {
  await requireApp("initiatives");
  const { code } = await params;
  const si = siByCode(code);
  if (!si) notFound();
  const area = areaByCode(si.areaCode);
  const milestones = milestonesBySi(si.code);
  const updates = updatesForSi(si.code);
  const actions = ACTION_ITEMS.filter((a) => a.siCode === si.code);
  const asks = ELT_ASKS.filter((a) => a.siCode === si.code);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
      <Link href="/v2/review" className="inline-flex w-fit items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft size={12} aria-hidden /> Back to Strategy Review
      </Link>
      <V2Header
        tabs={false}
        eyebrow={`${siShortCode(si.code)} · ${area?.name ?? si.areaCode}`}
        title={si.name}
        description={<>Charter (mock). Lead: <span className="font-medium text-ink">{personName(si.ownerId)}</span> · Sponsor: {si.sponsorLabel}</>}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-deep">What it is</p>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{si.objective}</p>
          {area && (
            <p className="mt-3 border-t border-border/70 pt-3 text-xs text-ink-muted">
              <span className="font-semibold text-ink">Pillar goal:</span> {area.goal}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-deep">What it is going for</p>
          <p className="mt-2 text-sm leading-6 text-ink">{si.goingFor}</p>
          {area?.kpiName && (
            <p className="mt-3 border-t border-border/70 pt-3 text-xs text-ink-muted">
              <span className="font-semibold text-ink">Pillar measure:</span> {area.kpiName}
              {area.kpiTarget ? ` · ${area.kpiTarget}` : ""}
            </p>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Milestones</SectionTitle>
        {milestones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-ink-muted">No dated milestones on this charter yet.</p>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface">
            {milestones.map((m) => (
              <li key={m.id} className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${isPastDue(m) ? "bg-warn-soft/60" : ""}`}>
                <span className="tabular w-20 shrink-0 text-sm font-semibold text-ink">{milestoneDateLabel(m)}</span>
                <span className="min-w-0 flex-1 text-sm text-ink">{m.title}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  {names(m.ownerIds)}
                  {isPastDue(m) && <Badge variant="warn">Needs a status</Badge>}
                  {m.done && <Badge variant="ok">Done</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <SectionTitle>Risks</SectionTitle>
          <div className="rounded-xl border border-border bg-surface p-5">
            {si.risks.length === 0 ? (
              <p className="text-sm text-ink-muted">No risks recorded yet.</p>
            ) : (
              <ul className="list-disc space-y-2 pl-4 text-sm text-ink-muted">
                {si.risks.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
          </div>
        </div>
        <div>
          <SectionTitle>Dependencies</SectionTitle>
          <div className="rounded-xl border border-border bg-surface p-5">
            {si.dependencies.length === 0 ? (
              <p className="text-sm text-ink-muted">No dependencies recorded yet.</p>
            ) : (
              <ul className="list-disc space-y-2 pl-4 text-sm text-ink-muted">
                {si.dependencies.map((d) => (
                  <li key={d.text}>
                    {d.siCode && (
                      <Link href={`/v2/si/${d.siCode}`} className="mr-1 font-medium text-navy hover:underline">
                        {siShortCode(d.siCode)} {siByCode(d.siCode)?.name}:
                      </Link>
                    )}
                    {d.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {(actions.length > 0 || asks.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <SectionTitle>Action items</SectionTitle>
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface">
              {actions.length === 0 && <li className="px-4 py-3 text-sm text-ink-muted">None.</li>}
              {actions.map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <p className={a.done ? "text-ink-muted line-through" : "text-ink"}>{a.text}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{personName(a.ownerId)} · due {fmtDay(a.due)}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionTitle>ELT asks</SectionTitle>
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface">
              {asks.length === 0 && <li className="px-4 py-3 text-sm text-ink-muted">None.</li>}
              {asks.map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <p className="text-ink">{a.text}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{personName(a.fromId)} · {a.open ? "open" : "answered"}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section>
        <SectionTitle aside={<MockNote />}>Monthly update history</SectionTitle>
        {updates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-ink-muted">No monthly updates yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {updates.map((u) => (
              <li key={u.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{getPeriod(u.period)?.label ?? u.period}</h3>
                  <span className="flex items-center gap-1.5">
                    <SiStatusBadge status={u.status} />
                    <UpdateStateBadge state={u.state} />
                  </span>
                </div>
                <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-ink">Latest progress</dt>
                    <dd className="mt-0.5 text-ink-muted">{u.latestProgress}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">What next</dt>
                    <dd className="mt-0.5 text-ink-muted">{u.whatNext}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-ink-faint">
                  {personName(u.authorId)}
                  {u.submittedAt ? ` · submitted ${fmtDay(u.submittedAt)}` : u.updatedAt ? ` · last edited ${fmtDay(u.updatedAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
