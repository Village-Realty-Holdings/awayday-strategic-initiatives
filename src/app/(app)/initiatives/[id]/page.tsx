import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InitiativeStatus } from "@/generated/prisma/enums";
import { ProgressForm, ProgressSummary } from "@/components/progress-editor";
import {
  formatDateDay,
  QUADRANT_META,
  STATUS_META,
  pace,
  formatMoney,
  effortBadge,
  durationDays,
  formatTeam,
} from "@/lib/initiatives";
import { canEdit, requireSession } from "@/lib/session";
import { DeleteInitiativeButton } from "@/components/delete-initiative-button";
import {
  addInitiativeUpdate,
  addInitiativeMilestone,
  toggleInitiativeMilestone,
  removeInitiativeMilestone,
  addInitiativeActionItem,
  toggleInitiativeActionItem,
  removeInitiativeActionItem,
  addInitiativeEltRequest,
  updateInitiativeEltRequest,
  removeInitiativeEltRequest,
} from "@/app/(app)/initiatives/actions";
import { CharterAssistButton } from "@/components/charter-assist";
import { CompletionToggle } from "@/components/completion-toggle";
import { DatePicker } from "@/components/date-picker";
import { StatusBadge, QuadrantBadge } from "@/components/badges";
import { DetailList, DetailSection, RemoveButton } from "@/components/initiative-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import {
  Pencil,
  CalendarCheck,
  UserCheck,
  HandCoins,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
} from "@/components/icons";
import { BreadcrumbTitle } from "@/components/shell/breadcrumbs";
import { PAGE_FRAME, PageHeader } from "@/components/shell/page-header";

const STATUSES = Object.values(InitiativeStatus);

export const dynamic = "force-dynamic";

export default async function InitiativeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  // Everyone can read a charter; editors and admins can manage it.
  const isAdmin = session.user.role === "admin";
  const editable = canEdit(session.user.role);
  const i = await prisma.initiative.findUnique({
    where: { id },
    include: {
      riskLog: { orderBy: { order: "asc" } },
      milestones: { orderBy: [{ dueAt: "asc" }, { order: "asc" }] },
      actionItems: { orderBy: { order: "asc" } },
      eltRequests: { orderBy: { order: "asc" } },
      strategicArea: true,
      planVersion: { select: { code: true } },
      updates: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!i) notFound();

  // People directory, for the owner fields (Jakob: "pull from People").
  const roster = await prisma.rosterMember.findMany({ select: { name: true }, orderBy: { name: "asc" } });
  const people = [...new Set(roster.map((r) => r.name).filter(Boolean))] as string[];

  const now = new Date();
  const p = pace(i.startDate, i.endDate, i.pctComplete, now);
  const behind = i.status !== "DONE" && p && p.lag < -0.15;
  const days = durationDays(i.startDate, i.endDate);
  const isValue = i.valueType === "VALUE";
  const nextMilestone = i.milestones.find((m) => !m.completedAt && m.dueAt);
  // The area often carries the driver's own name ("M&A"); only show it when it adds something.
  const area = i.strategicArea && i.strategicArea.name !== i.cimDriver ? i.strategicArea.name : null;

  const objectiveLine =
    i.quantMetric || i.quantTarget
      ? `${i.quantMetric ?? ""}${i.quantTarget ? ` → ${i.quantTarget}` : ""}`
      : null;

  const editHref = `/admin/initiatives/${i.id}/edit`;

  return (
    <div className={PAGE_FRAME}>
      <BreadcrumbTitle path={`/initiatives/${i.id}`} title={`${i.code} ${i.name}`} />

      <PageHeader sticky
        back={isAdmin ? { href: "/admin/initiatives", label: "Initiatives" } : { href: "/", label: "Strategy Review" }}
        eyebrow={
          <>
            <span className="tabular">{i.code}</span>
            {[i.cimDriver, area].filter(Boolean).map((x) => ` · ${x}`)}
          </>
        }
        title={i.name}
        badges={
          <>
            <Badge variant="outline" className="bg-surface">
              <StatusBadge status={i.status} />
            </Badge>
            {isValue ? <QuadrantBadge quadrant={i.quadrant} /> : <Badge variant="secondary">Non-value</Badge>}
            {behind && <Badge variant="warn">Behind pace</Badge>}
            {i.cimItemCode && <Badge variant="outline" className="tabular">{i.cimItemCode}</Badge>}
          </>
        }
        actions={
          editable && (
            <>
              <Button asChild variant="secondary" size="sm">
                <Link href={editHref}>
                  <Pencil size={13} aria-hidden /> Edit
                </Link>
              </Button>
              {isAdmin && <DeleteInitiativeButton id={i.id} name={i.name} />}
            </>
          )
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Side rail: the facts you check at a glance. First on phones, right on desktop. */}
        <aside className="grid gap-4 lg:sticky lg:top-20 lg:order-2" aria-label="Initiative summary">
          <div className="rounded-md border border-border bg-surface">
            <RailGroup title="Progress">
              {isValue ? (
                <ProgressSummary
                  pct={i.pctComplete}
                  paceNote={p ? { behind: Boolean(behind), text: behind ? `Behind pace. Expected ~${Math.round(p.expected * 100)}% by today.` : `On pace. Expected ~${Math.round(p.expected * 100)}% by today.` } : null}
                  kpiLine={objectiveLine}
                />
              ) : (
                <div className="grid gap-1">
                  <StatusBadge status={i.status} />
                  <p className="text-note text-ink-faint">Non-value initiative. Completion is tracked by status, not dollars.</p>
                  {objectiveLine && <p className="mt-1 text-xs text-ink-muted">KPI: <span className="text-ink">{objectiveLine}</span></p>}
                </div>
              )}
            </RailGroup>

            <RailGroup title="People">
              <dl className="grid gap-2">
                <RailRow label="SI lead" value={i.teamLead ?? "Unassigned"} muted={!i.teamLead} />
                <RailRow label="ELT sponsor" value={i.secondaryLead ?? "Unassigned"} muted={!i.secondaryLead} />
                <RailRow label="Working team" value={formatTeam(i.supports) || "None yet"} muted={!formatTeam(i.supports)} />
              </dl>
            </RailGroup>

            <RailGroup title="Timeline">
              <dl className="grid gap-2">
                {days !== null ? (
                  <>
                    <RailRow label="Start" value={formatDateDay(i.startDate)} />
                    <RailRow label="Target" value={`${formatDateDay(i.endDate)} · ${days} days`} />
                  </>
                ) : (
                  <RailRow
                    label="Dates"
                    value="Not scheduled"
                    muted
                  />
                )}
                <RailRow
                  label="Next milestone"
                  value={nextMilestone ? `${nextMilestone.title} · ${formatDateDay(nextMilestone.dueAt)}` : "None open"}
                  muted={!nextMilestone}
                />
              </dl>
            </RailGroup>

            {isValue && (
              <RailGroup title="Value">
                <dl className="grid gap-2">
                  <RailRow label="Targeted value" value={formatMoney(i.progressTarget)} tabular />
                  <RailRow label="Value realized" value={formatMoney(i.progressActual)} tabular />
                  <RailRow label="Effort" value={effortBadge(i.lift)} />
                  <RailRow label="Priority" value={QUADRANT_META[i.quadrant].label} />
                </dl>
              </RailGroup>
            )}

          </div>
        </aside>

        {/* Main column: the charter, then the working lists. */}
        <div className="grid min-w-0 gap-4 lg:order-1">
          <Block
            title="Objective"
            body={i.valueWhenComplete}
            assist={editable && <CharterAssistButton initiativeId={i.id} kind="objective" label="Sharpen with Claude" />}
          />
          <section className="rounded-md border border-border bg-surface px-4 py-4 sm:px-5">
            <h2 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">Value</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <ValueRow label="Metric" value={i.quantMetric} wide />
              <ValueRow label="Baseline" value={i.baseline} />
              <ValueRow label="FY27 target + stretch" value={i.quantTarget} />
              <ValueRow label="EBITDA value ($)" value={i.ebitdaValue} wide />
              <ValueRow label="Investment cost ($)" value={i.investmentCost} wide />
            </dl>
          </section>
          <Block
            title="Deliverables"
            body={i.workRequired}
            assist={editable && <CharterAssistButton initiativeId={i.id} kind="deliverables" label="Suggest outputs" />}
          />

          {isValue && (
            <DetailSection
              icon={TrendingUp}
              title="Value & progress"
              count={`${Math.round(i.pctComplete * 100)}% complete`}
              isEmpty={i.progressTarget == null && i.progressActual == null}
              emptyText="No value figures yet."
              addLabel={editable ? "Update value" : undefined}
              addForm={editable && <ProgressForm initiativeId={i.id} pct={i.pctComplete} actual={i.progressActual} target={i.progressTarget} />}
            >
              <p className="text-sm text-ink">
                <span className="tabular font-semibold">{formatMoney(i.progressActual)}</span>
                <span className="text-ink-muted"> created of </span>
                <span className="tabular font-semibold">{formatMoney(i.progressTarget)}</span>
                <span className="text-ink-muted"> to create</span>
              </p>
            </DetailSection>
          )}

          <DetailSection
            icon={TriangleAlert}
            title="Risks and mitigations"
            count={i.riskLog.length > 0 && String(i.riskLog.length)}
            isEmpty={i.riskLog.length === 0}
            emptyText={editable ? "No risks logged. Add them in Edit." : "No risks logged."}
          >
            <DetailList>
              {i.riskLog.map((r) => (
                <li key={r.id} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem] sm:gap-4">
                  <p className="text-sm text-ink">{r.risk}</p>
                  <p className="text-sm text-ink-muted">{r.mitigation ?? "No mitigation yet"}</p>
                  <p className="text-note text-ink-faint">{r.owner ?? "No owner"}</p>
                </li>
              ))}
            </DetailList>
          </DetailSection>

          <DetailSection
            icon={CalendarCheck}
            title="Milestones"
            count={i.milestones.length > 0 && `${i.milestones.filter((m) => m.completedAt).length}/${i.milestones.length} complete`}
            isEmpty={i.milestones.length === 0}
            emptyText="No milestones yet."
            addLabel={editable ? "Add milestone" : undefined}
            addForm={
              editable && (
                <form action={addInitiativeMilestone} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="initiativeId" value={i.id} />
                  <Input size="sm" name="title" required placeholder="Milestone" className="min-w-48 flex-1" />
                  <Input size="sm" name="owner" list="people-list" placeholder="Owner" className="w-40" />
                  <div className="w-44"><DatePicker name="dueAt" label="Due date" clearable align="end" /></div>
                  <SubmitButton variant="secondary" size="sm">Add milestone</SubmitButton>
                </form>
              )
            }
          >
            <DetailList>
              {i.milestones.map((m) => {
                const overdue = !m.completedAt && m.dueAt != null && m.dueAt < now;
                return (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <CompletionToggle id={m.id} done={!!m.completedAt} label={m.title} action={toggleInitiativeMilestone} editable={editable} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${m.completedAt ? "text-ink-faint line-through" : "text-ink"}`}>{m.title}</p>
                      <p className="text-note text-ink-faint">
                        {[m.owner, m.dueAt ? `due ${formatDateDay(m.dueAt)}` : null, m.completedAt ? `done ${formatDateDay(m.completedAt)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {overdue && <Badge variant="risk" shape="pill" className="shrink-0">Past due</Badge>}
                    {editable && (
                      <RemoveButton action={removeInitiativeMilestone} id={m.id} title="Remove milestone?" description={`Remove milestone “${m.title}”? This can't be undone.`} />
                    )}
                  </li>
                );
              })}
            </DetailList>
          </DetailSection>

          <DetailSection
            icon={UserCheck}
            title="Dependencies & actions"
            count={i.actionItems.length > 0 && `${i.actionItems.filter((a) => a.status !== "DONE").length} open`}
            isEmpty={i.actionItems.length === 0}
            emptyText="No dependencies or actions yet."
            addLabel={editable ? "Add dependency or action" : undefined}
            addForm={
              editable && (
                <form action={addInitiativeActionItem} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="initiativeId" value={i.id} />
                  <NativeSelect size="sm" name="kind" defaultValue="ACTION" className="px-2" aria-label="Kind">
                    <option value="ACTION">Action</option>
                    <option value="DEPENDENCY">Dependency</option>
                  </NativeSelect>
                  <Input size="sm" name="title" required placeholder="What is needed" className="min-w-48 flex-1" />
                  <Input size="sm" name="owner" required list="people-list" placeholder="Owner" className="w-40" />
                  <div className="w-44"><DatePicker name="dueAt" label="Due date" clearable align="end" /></div>
                  <SubmitButton variant="secondary" size="sm">Add</SubmitButton>
                </form>
              )
            }
          >
            <DetailList>
              {i.actionItems.map((a) => {
                const overdue = a.status !== "DONE" && a.dueAt != null && a.dueAt < now;
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <CompletionToggle id={a.id} done={a.status === "DONE"} label={a.title} action={toggleInitiativeActionItem} editable={editable} />
                    <Badge
                      variant="custom"
                      shape="pill"
                      className={`shrink-0 text-micro uppercase tracking-wide ${a.kind === "DEPENDENCY" ? "bg-gold/20 text-gold-deep" : "bg-navy/10 text-navy-deep"}`}
                    >
                      {a.kind === "DEPENDENCY" ? "Dependency" : "Action"}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${a.status === "DONE" ? "text-ink-faint line-through" : "text-ink"}`}>{a.title}</p>
                      <p className="text-note text-ink-faint">
                        {[a.owner, a.dueAt ? `due ${formatDateDay(a.dueAt)}` : a.byWhen].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {overdue && <Badge variant="risk" shape="pill" className="shrink-0">Past due</Badge>}
                    {editable && (
                      <RemoveButton action={removeInitiativeActionItem} id={a.id} title="Remove item?" description={`Remove action item “${a.title}”? This can't be undone.`} />
                    )}
                  </li>
                );
              })}
            </DetailList>
          </DetailSection>

          <DetailSection
            icon={HandCoins}
            title="ELT support & investment requests"
            count={i.eltRequests.length > 0 && `${i.eltRequests.filter((r) => r.status === "REQUESTED").length} awaiting decision`}
            isEmpty={i.eltRequests.length === 0}
            emptyText="Nothing requested from the ELT."
            addLabel={editable ? "Add request" : undefined}
            addForm={
              editable && (
                <form action={addInitiativeEltRequest} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="initiativeId" value={i.id} />
                  <NativeSelect size="sm" name="kind" defaultValue="SUPPORT" className="px-2" aria-label="Kind">
                    <option value="SUPPORT">Support</option>
                    <option value="INVESTMENT">Investment</option>
                  </NativeSelect>
                  <Input size="sm" name="request" required placeholder="What the ELT is asked for" className="min-w-48 flex-1" />
                  <Input size="sm" name="amount" placeholder="$ (investment)" className="w-32" />
                  <SubmitButton variant="secondary" size="sm">Add request</SubmitButton>
                </form>
              )
            }
          >
            <DetailList>
              {i.eltRequests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <Badge
                        variant="custom"
                        shape="pill"
                        className={`mr-2 text-micro uppercase tracking-wide ${r.kind === "INVESTMENT" ? "bg-gold/20 text-gold-deep" : "bg-navy/10 text-navy-deep"}`}
                      >
                        {r.kind === "INVESTMENT" ? "Investment" : "Support"}
                      </Badge>
                      {r.request}
                      {r.amount != null && <span className="tabular ml-1.5 font-semibold text-ink">{formatMoney(Number(r.amount))}</span>}
                    </p>
                    {r.decidedNote && <p className="mt-0.5 text-note text-ink-faint">{r.decidedNote}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {editable ? (
                      <form action={updateInitiativeEltRequest} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={r.id} />
                        <NativeSelect size="xs" name="status" defaultValue={r.status} aria-label="Request status">
                          <option value="REQUESTED">Requested</option>
                          <option value="APPROVED">Approved</option>
                          <option value="DECLINED">Declined</option>
                        </NativeSelect>
                        <SubmitButton variant="outline" size="xs">Save</SubmitButton>
                      </form>
                    ) : (
                      <Badge variant={r.status === "APPROVED" ? "ok" : r.status === "DECLINED" ? "secondary" : "warn"} shape="pill">
                        {r.status === "APPROVED" ? "Approved" : r.status === "DECLINED" ? "Declined" : "Requested"}
                      </Badge>
                    )}
                    {editable && (
                      <RemoveButton action={removeInitiativeEltRequest} id={r.id} title="Remove ELT request?" description={`Remove ELT request “${r.request}”? This can't be undone.`} />
                    )}
                  </div>
                </li>
              ))}
            </DetailList>
          </DetailSection>

          <DetailSection
            icon={RefreshCw}
            title={`${i.planVersion?.code ? `${i.planVersion.code} ` : ""}status updates`}
            count={i.updates.length > 0 && String(i.updates.length)}
            isEmpty={i.updates.length === 0}
            emptyText="No status updates yet."
            addLabel={editable ? "Add status update" : undefined}
            addForm={
              editable && (
                <form action={addInitiativeUpdate} className="grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="initiativeId" value={i.id} />
                  <NativeSelect size="sm" name="status" defaultValue={i.status} aria-label="Status">
                    {STATUSES.map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
                  </NativeSelect>
                  <Input size="sm" name="reportingPeriod" placeholder="Reporting period (e.g. October 2026)" />
                  <Textarea name="update" rows={2} placeholder="Latest meaningful update" className="sm:col-span-2" />
                  <Textarea name="pathForward" rows={2} placeholder="Path forward / next priorities" className="sm:col-span-2" />
                  <Input size="sm" name="nextMilestone" placeholder="Next milestone" />
                  <DatePicker name="milestoneDueAt" label="Milestone due date" clearable align="end" />
                  <SubmitButton size="sm" className="w-fit sm:col-span-2">Save status update</SubmitButton>
                </form>
              )
            }
          >
            <DetailList>
              {i.updates.map((u) => (
                <li key={u.id} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={u.status} />
                    <span className="text-note text-ink-faint">{u.reportingPeriod ?? "Unspecified period"} · {formatDateDay(u.createdAt)}</span>
                  </div>
                  {u.update && <p className="mt-1 text-sm text-ink-muted">{u.update}</p>}
                  <p className="mt-1 text-note text-ink-faint">Path forward: {u.pathForward ?? "TBD"} · Next milestone: {u.nextMilestone ?? "TBD"}{u.milestoneDueAt ? ` (${formatDateDay(u.milestoneDueAt)})` : ""}</p>
                </li>
              ))}
            </DetailList>
          </DetailSection>
        </div>
      </div>

      <datalist id="people-list">
        {people.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}

function RailGroup({ title, icon: Icon, children }: { title: string; icon?: typeof TrendingUp; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-4 last:border-b-0">
      <h2 className="mb-2.5 flex items-center gap-1.5 text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">
        {Icon && <Icon size={12} aria-hidden />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function RailRow({ label, value, muted, tabular }: { label: string; value: React.ReactNode; muted?: boolean; tabular?: boolean }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-ink-faint">{label}</dt>
      <dd className={`${muted ? "text-ink-faint" : "font-medium text-ink"} ${tabular ? "tabular" : ""}`}>{value}</dd>
    </div>
  );
}

function ValueRow({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-note text-ink-faint">{label}</dt>
      <dd className={value ? "text-ink" : "text-ink-faint"}>{value ?? "Not set"}</dd>
    </div>
  );
}

function Block({
  title,
  body,
  assist,
}: {
  title: string;
  body: string | null;
  assist?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-md border border-border bg-surface px-4 py-4 sm:px-5">
      <h2 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">{title}</h2>
      {body ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{body}</p>
      ) : (
        <p className="mt-2 text-sm text-ink-faint">Not yet documented.</p>
      )}
      {assist && <div className="mt-auto pt-3">{assist}</div>}
    </section>
  );
}
