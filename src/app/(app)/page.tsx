import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireApp } from "@/lib/session";
import { FY27_PLAN, type Fy27Area } from "@/lib/fy27-plan";
import { STATUS_META } from "@/lib/initiatives";
import type { InitiativeStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type InitiativeSummary = {
  id: string;
  code: string;
  name: string;
  status: InitiativeStatus;
  owner: string | null;
  update: string | null;
  pathForward: string | null;
  nextMilestone: string | null;
  milestoneDueAt: Date | null;
};

export default async function OverviewPage() {
  await requireApp("initiatives");

  const active = await prisma.planVersion.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
    include: {
      strategicAreas: {
        orderBy: [{ kind: "asc" }, { order: "asc" }],
        include: {
          initiatives: {
            orderBy: { code: "asc" },
            include: { updates: { orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
      },
    },
  });

  const areas = active?.strategicAreas ?? FY27_PLAN.areas;
  const sourceInitiatives = active
    ? active.strategicAreas.flatMap((area) =>
        area.initiatives.map((initiative) => ({
          id: initiative.id,
          code: initiative.code,
          name: initiative.name,
          status: initiative.status,
          owner: initiative.teamLead,
          update: initiative.updates[0]?.update ?? null,
          pathForward: initiative.updates[0]?.pathForward ?? null,
          nextMilestone: initiative.updates[0]?.nextMilestone ?? null,
          milestoneDueAt: initiative.updates[0]?.milestoneDueAt ?? null,
        })),
      )
    : await prisma.initiative.findMany({
        where: { code: { in: FY27_PLAN.initiatives.map((initiative) => initiative.code) } },
        select: { id: true, code: true, name: true, status: true, teamLead: true },
        orderBy: { code: "asc" },
      }).then((rows) =>
        rows.map((initiative) => ({
          id: initiative.id,
          code: initiative.code,
          name: initiative.name,
          status: initiative.status,
          owner: initiative.teamLead,
          update: null,
          pathForward: null,
          nextMilestone: null,
          milestoneDueAt: null,
        })),
      );

  const byArea = new Map<string, InitiativeSummary[]>();
  for (const initiative of sourceInitiatives) {
    const source = FY27_PLAN.initiatives.find((item) => item.code === initiative.code);
    const areaCode = source?.areaCode ?? active?.strategicAreas.find((area) => area.initiatives.some((item) => item.id === initiative.id))?.code;
    if (areaCode) byArea.set(areaCode, [...(byArea.get(areaCode) ?? []), initiative]);
  }

  const drivers = areas.filter((area) => area.kind === "VALUE_DRIVER");
  const enablers = areas.filter((area) => area.kind === "ENABLER");

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-deep">Active plan · {active?.code ?? FY27_PLAN.code}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{active?.title ?? FY27_PLAN.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          $200M FY27 BHAG / $180M budget context, aligned to the $300M EBITDA north star by 12/31/28.
        </p>
      </header>

      <section className="rounded-xl border border-navy/20 bg-navy px-6 py-5 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">North star</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">$300M EBITDA</h2>
            <p className="mt-1 text-sm text-white/70">Goal by 12/31/28 · FY27 plan contribution tracked below</p>
          </div>
          <Link href="/initiatives" className="rounded-md border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20">
            View all FY27 initiatives
          </Link>
        </div>
      </section>

      <AreaGrid title="Value creation pillars" areas={drivers} initiativesByArea={byArea} />
      <AreaGrid title="Enablers" areas={enablers} initiativesByArea={byArea} />
    </div>
  );
}

function AreaGrid({ title, areas, initiativesByArea }: { title: string; areas: (Fy27Area | { code: string; kind: string; name: string; goal: string | null; kpiName: string | null; kpiTarget: string | null; owner: string | null })[]; initiativesByArea: Map<string, InitiativeSummary[]> }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {areas.map((area) => {
          const initiatives = initiativesByArea.get(area.code) ?? [];
          return (
            <article key={area.code} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">{area.code}</p>
                  <h3 className="mt-1 text-base font-semibold text-ink">{area.name}</h3>
                </div>
                <span className="rounded bg-surface-2 px-2 py-1 text-[11px] text-ink-muted">{area.owner ?? "Owner: TBD"}</span>
              </div>
              <p className="mt-3 text-sm leading-5 text-ink-muted">{area.goal ?? "Goal: TBD"}</p>
              <div className="mt-3 grid gap-2 border-y border-border/70 py-3 text-xs sm:grid-cols-2">
                <div><span className="font-semibold text-ink">Leading measure:</span> {area.kpiName ?? "TBD"}</div>
                <div><span className="font-semibold text-ink">Target:</span> {area.kpiTarget ?? "TBD"}</div>
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {initiatives.length === 0 && <li className="text-xs text-ink-faint">No imported initiatives yet.</li>}
                {initiatives.map((initiative) => {
                  const status = STATUS_META[initiative.status];
                  return (
                    <li key={initiative.id} className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2.5">
                      <Link href={`/initiatives/${initiative.id}`} className="group block">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink group-hover:text-navy-deep">
                            <span className="mr-2 tabular text-[10px] text-ink-faint">{initiative.code}</span>{initiative.name}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium ${status.fg}`}>
                            <span aria-hidden>{status.glyph}</span>{status.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-muted">{initiative.update ?? "Recent update: TBD"}</p>
                        <p className="mt-1 text-[11px] text-ink-faint">
                          Path forward: {initiative.pathForward ?? "TBD"} · Next milestone: {initiative.nextMilestone ?? "TBD"}
                          {initiative.milestoneDueAt ? ` (${initiative.milestoneDueAt.toLocaleDateString()})` : ""}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
