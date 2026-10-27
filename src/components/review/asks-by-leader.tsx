import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDay, splitNames, type ReviewSi } from "@/lib/review-model";
import { SiStatusBadge, UpdatedBadge } from "./status";

type Grouping = "elt" | "lead";
type LeaderGroup = { leader: string; sis: ReviewSi[] };

/** Group SIs by ELT sponsor (an SI with two sponsors appears under both) or by SI lead. */
export function leaderGroups(sis: readonly ReviewSi[], by: Grouping): LeaderGroup[] {
  const groups = new Map<string, ReviewSi[]>();
  for (const si of sis) {
    const names = splitNames(by === "elt" ? si.sponsor : si.lead);
    for (const name of names.length ? names : ["Not assigned"]) groups.set(name, [...(groups.get(name) ?? []), si]);
  }
  return [...groups.entries()]
    .map(([leader, list]) => ({ leader, sis: list }))
    .sort((a, b) => (a.leader === "Not assigned" ? 1 : b.leader === "Not assigned" ? -1 : a.leader.localeCompare(b.leader)));
}

function AsksByLeader({ sis, compact, groupBy, today }: { sis: ReviewSi[]; compact: boolean; groupBy: Grouping; today: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {leaderGroups(sis, groupBy).map((g) => {
        const updated = g.sis.filter((s) => s.updatedThisPeriod).length;
        const openMilestones = g.sis.reduce((n, s) => n + s.milestones.filter((m) => !m.done).length, 0);
        const openActions = g.sis.reduce((n, s) => n + s.actions.filter((a) => !a.done).length, 0);
        const openAsks = g.sis.reduce((n, s) => n + s.asks.filter((a) => a.status === "REQUESTED").length, 0);
        return (
          <Card key={g.leader} className="gap-0 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-ink">{g.leader}</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {g.sis.length} SI{g.sis.length === 1 ? "" : "s"} · {updated} of {g.sis.length} updated this month
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{openMilestones} open milestones</Badge>
                {openActions > 0 && <Badge variant="secondary">{openActions} action items</Badge>}
                {openAsks > 0 && <Badge variant="default">{openAsks} ELT asks</Badge>}
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {g.sis.map((si) => {
                const next = si.milestones.find((m) => !m.done && m.date && m.date >= today);
                return (
                  <li key={si.code} className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/initiatives/${si.id}`} className="text-sm font-medium text-ink hover:text-navy-deep">
                        <span className="tabular mr-2 text-micro text-ink-faint">{si.shortCode}</span>
                        {si.name}
                      </Link>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <SiStatusBadge status={si.status} />
                        <UpdatedBadge updated={si.updatedThisPeriod} />
                      </span>
                    </div>
                    <p className="mt-1 text-note text-ink-faint">{si.areaName}</p>
                    <dl className="mt-2 grid gap-1 text-xs">
                      <div><dt className="inline font-medium text-ink">Latest progress? </dt><dd className="inline text-ink-muted">{si.latestProgress ?? "TBD"}</dd></div>
                      <div><dt className="inline font-medium text-ink">What next? </dt><dd className="inline text-ink-muted">{si.whatNext ?? "TBD"}</dd></div>
                    </dl>
                    {!compact && (
                      <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
                        {next && (
                          <li>
                            <span className="font-medium text-ink">Next milestone:</span> {next.title} ({fmtDay(next.date)})
                          </li>
                        )}
                        {si.actions.filter((a) => !a.done).map((a) => (
                          <li key={a.id}>
                            <span className="font-medium text-ink">{a.kind === "DEPENDENCY" ? "Dependency" : "Action"}:</span> {a.title}
                            {a.date ? ` (due ${fmtDay(a.date)})` : ""}
                          </li>
                        ))}
                        {si.asks.filter((a) => a.status === "REQUESTED").map((a) => (
                          <li key={a.id}>
                            <span className="font-medium text-ink">ELT ask:</span> {a.request}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

/** Switch between grouping by ELT sponsor (default, as in the MVP) and by SI lead. */
export function AsksByLeaderToggle({ sis, today, compact = false }: { sis: ReviewSi[]; today: string; compact?: boolean }) {
  if (sis.length === 0) return <p className="text-xs text-ink-faint">No strategic initiatives in the active plan.</p>;
  return (
    <Tabs defaultValue="elt" className="gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <TabsList aria-label="Group asks by">
          <TabsTrigger value="elt">By ELT sponsor</TabsTrigger>
          <TabsTrigger value="lead">By SI lead</TabsTrigger>
        </TabsList>
        <p className="text-note text-ink-faint">An SI with two ELT sponsors appears under both.</p>
      </div>
      <TabsContent value="elt">
        <AsksByLeader sis={sis} compact={compact} groupBy="elt" today={today} />
      </TabsContent>
      <TabsContent value="lead">
        <AsksByLeader sis={sis} compact={compact} groupBy="lead" today={today} />
      </TabsContent>
    </Tabs>
  );
}
