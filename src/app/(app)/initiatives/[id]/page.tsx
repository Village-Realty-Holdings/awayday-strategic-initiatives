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
import { requireSession } from "@/lib/session";
import { DeleteInitiativeButton } from "@/components/delete-initiative-button";
import {
  addAttachment,
  addFileAttachment,
  removeAttachment,
  addSubInitiative,
  updateSubInitiative,
  removeSubInitiative,
  addComment,
  addInitiativeUpdate,
  removeComment,
  addInitiativeRisk,
  updateInitiativeRisk,
  removeInitiativeRisk,
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
import { FileDrop } from "@/components/file-drop";
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
  Paperclip,
  ExternalLink,
  FileText,
  Upload,
  ListTree,
  MessageSquare,
  AlertTriangle,
  CalendarCheck,
  UserCheck,
  HandCoins,
  RefreshCw,
  TrendingUp,
} from "@/components/icons";
import { BreadcrumbTitle } from "@/components/shell/breadcrumbs";
import { PAGE_FRAME, PageHeader } from "@/components/shell/page-header";

const ATTACH_ERRORS: Record<string, string> = {
  "1": "Enter a valid http(s) URL.",
  file: "Choose a file to upload.",
  size: "File is too large (max 3 MB).",
  type: "That file type isn't allowed. Use PDF, an image, or an Office/CSV/text doc.",
};

const STATUSES = Object.values(InitiativeStatus);

export const dynamic = "force-dynamic";

export default async function InitiativeDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attachError?: string; subError?: string }>;
}) {
  const { id } = await params;
  const { attachError } = await searchParams;
  const session = await requireSession();
  // Everyone can read a charter; only admins manage it.
  const isAdmin = session.user.role === "admin";
  const editable = isAdmin;
  const i = await prisma.initiative.findUnique({
    where: { id },
    include: {
      risks: { include: { cimRisk: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      subInitiatives: { orderBy: { order: "asc" } },
      comments: { orderBy: { createdAt: "asc" } },
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
              <DeleteInitiativeButton id={i.id} name={i.name} />
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
                <RailRow label="Lead" value={i.teamLead ?? "Unassigned"} muted={!i.teamLead} />
                <RailRow label="Secondary lead" value={i.secondaryLead ?? "Unassigned"} muted={!i.secondaryLead} />
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

            <RailGroup title="Links & files" icon={Paperclip}>
              {i.attachments.length === 0 ? (
                <p className="text-xs text-ink-faint">None yet</p>
              ) : (
                <ul className="grid gap-1.5">
                  {i.attachments.map((a) => (
                    <li key={a.id}>
                      <AttachmentLink attachment={a} />
                    </li>
                  ))}
                </ul>
              )}
            </RailGroup>
          </div>
        </aside>

        {/* Main column: the charter, then the working lists. */}
        <div className="grid min-w-0 gap-4 lg:order-1">
          <div className="grid gap-4 md:grid-cols-2">
            <Block
              title="Problem statement"
              body={i.problem}
              assist={editable && <CharterAssistButton initiativeId={i.id} kind="problem" label="Refine with Claude" />}
            />
            <Block
              title="Objective"
              body={i.valueWhenComplete}
              footer={
                objectiveLine ? (
                  <p className="mt-3 border-t border-dashed border-border pt-3 text-sm">
                    <span className="font-semibold text-ink">{objectiveLine}</span>
                    {i.endDate && <span className="text-ink-muted"> · by {formatDateDay(i.endDate)}</span>}
                  </p>
                ) : null
              }
              assist={editable && <CharterAssistButton initiativeId={i.id} kind="objective" label="Sharpen with Claude" />}
            />
          </div>
          <Block
            title="Deliverables"
            body={i.workRequired}
            assist={editable && <CharterAssistButton initiativeId={i.id} kind="deliverables" label="Suggest outputs" />}
          />

          <DetailSection
            icon={Paperclip}
            title="Links & files"
            count={i.attachments.length > 0 && String(i.attachments.length)}
            isEmpty={i.attachments.length === 0 && !attachError}
            emptyText="No examples of the end product yet."
            action={editable && <CharterAssistButton initiativeId={i.id} kind="example" label="Ask Claude for an example" />}
            addLabel={editable ? "Add a link or file" : undefined}
            addForm={
              editable && (
                <div className="grid gap-3">
                  <form action={addAttachment} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="initiativeId" value={i.id} />
                    <Input size="sm" name="label" placeholder="Label" className="w-40" />
                    <Input size="sm" name="url" type="url" required placeholder="https://…" className="min-w-48 flex-1" />
                    <SubmitButton variant="secondary" size="sm">Add link</SubmitButton>
                  </form>
                  <form action={addFileAttachment} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="initiativeId" value={i.id} />
                    <FileDrop name="file" required compact label="Drop a file or browse (max 3 MB)" className="min-w-48 flex-1" />
                    <SubmitButton variant="secondary" size="sm">
                      <Upload size={13} aria-hidden /> Upload file
                    </SubmitButton>
                  </form>
                </div>
              )
            }
          >
            {attachError && <p className="mb-2 text-xs text-risk" role="alert">{ATTACH_ERRORS[attachError] ?? "Could not add that attachment."}</p>}
            <DetailList>
              {i.attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <AttachmentLink attachment={a} />
                  {editable && (
                    <RemoveButton action={removeAttachment} id={a.id} title="Remove attachment?" description={`Remove attachment “${a.label}”? This can't be undone.`} />
                  )}
                </li>
              ))}
            </DetailList>
          </DetailSection>

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
            icon={ListTree}
            title="Sub-initiatives"
            count={i.subInitiatives.length > 0 && String(i.subInitiatives.length)}
            isEmpty={i.subInitiatives.length === 0}
            emptyText="No sub-initiatives."
            addLabel={editable ? "Add sub-initiative" : undefined}
            addForm={
              editable && (
                <form action={addSubInitiative} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="initiativeId" value={i.id} />
                  <Input size="sm" name="title" required placeholder="Sub-initiative title" className="min-w-48 flex-1" />
                  <Input size="sm" name="owner" list="people-list" placeholder="Owner" className="w-40" />
                  <SubmitButton variant="secondary" size="sm">Add sub-initiative</SubmitButton>
                </form>
              )
            }
          >
            <DetailList>
              {i.subInitiatives.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{s.title}</p>
                    {s.owner && <p className="text-note text-ink-faint">{s.owner}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {editable ? (
                      <form action={updateSubInitiative} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={s.id} />
                        <NativeSelect size="xs" name="status" defaultValue={s.status} aria-label={`Status of ${s.title}`}>
                          {STATUSES.map((st) => (
                            <option key={st} value={st}>{STATUS_META[st].label}</option>
                          ))}
                        </NativeSelect>
                        <Input size="xs" type="number" name="pctComplete" min={0} max={100} defaultValue={Math.round(s.pctComplete * 100)} className="w-16" aria-label={`Percent complete of ${s.title}`} />
                        <SubmitButton variant="outline" size="xs">Save</SubmitButton>
                      </form>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 text-xs ${STATUS_META[s.status].fg}`}>
                        <span aria-hidden>{STATUS_META[s.status].glyph}</span>
                        {STATUS_META[s.status].label} · {Math.round(s.pctComplete * 100)}%
                      </span>
                    )}
                    {editable && (
                      <RemoveButton action={removeSubInitiative} id={s.id} title="Remove sub-initiative?" description={`Remove sub-initiative “${s.title}”? This can't be undone.`} />
                    )}
                  </div>
                </li>
              ))}
            </DetailList>
          </DetailSection>

          <DetailSection
            icon={AlertTriangle}
            title="Risks & mitigations"
            count={i.riskLog.length > 0 && `${i.riskLog.filter((r) => r.status === "OPEN").length} open`}
            isEmpty={i.riskLog.length === 0}
            emptyText="No risks logged."
            addLabel={editable ? "Add risk" : undefined}
            addForm={
              editable && (
                <form action={addInitiativeRisk} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="initiativeId" value={i.id} />
                  <Input size="sm" name="risk" required placeholder="Risk" className="min-w-48 flex-1" />
                  <Input size="sm" name="mitigation" placeholder="Mitigating action" className="min-w-48 flex-1" />
                  <Input size="sm" name="owner" list="people-list" placeholder="Owner" className="w-36" />
                  <SubmitButton variant="secondary" size="sm">Add risk</SubmitButton>
                </form>
              )
            }
          >
            <DetailList>
              {i.riskLog.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${r.status === "OPEN" ? "text-ink" : "text-ink-muted"}`}>{r.risk}</p>
                    {r.mitigation && (
                      <p className="mt-1 text-xs text-ink-muted">
                        <span className="font-semibold text-ink-faint">Mitigation:</span> {r.mitigation}
                      </p>
                    )}
                    {r.owner && <p className="mt-0.5 text-note text-ink-faint">{r.owner}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {editable ? (
                      <form action={updateInitiativeRisk} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={r.id} />
                        <NativeSelect size="xs" name="status" defaultValue={r.status} aria-label="Risk status">
                          <option value="OPEN">Open</option>
                          <option value="MITIGATED">Mitigated</option>
                          <option value="ACCEPTED">Accepted</option>
                        </NativeSelect>
                        <SubmitButton variant="outline" size="xs">Save</SubmitButton>
                      </form>
                    ) : (
                      <Badge variant={r.status === "OPEN" ? "risk" : "secondary"} shape="pill">
                        {r.status === "OPEN" ? "Open" : r.status === "MITIGATED" ? "Mitigated" : "Accepted"}
                      </Badge>
                    )}
                    {editable && (
                      <RemoveButton action={removeInitiativeRisk} id={r.id} title="Remove risk?" description={`Remove risk “${r.risk}”? This can't be undone.`} />
                    )}
                  </div>
                </li>
              ))}
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
                        {[a.owner, a.dueAt ? `due ${formatDateDay(a.dueAt)}` : null].filter(Boolean).join(" · ")}
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

          <DetailSection
            icon={MessageSquare}
            title="Comments"
            count={i.comments.length > 0 && String(i.comments.length)}
            isEmpty={i.comments.length === 0}
            emptyText="No comments yet."
            addLabel={editable ? "Add comment" : undefined}
            addForm={
              editable && (
                <form action={addComment} className="grid gap-2">
                  <input type="hidden" name="initiativeId" value={i.id} />
                  <Textarea name="body" required rows={2} placeholder="Add a comment…" />
                  <SubmitButton size="sm" className="justify-self-start">Post comment</SubmitButton>
                </form>
              )
            }
          >
            <DetailList>
              {i.comments.map((c) => (
                <li key={c.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-ink">{c.authorName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-note text-ink-faint">{formatDateDay(c.createdAt)}</span>
                      {editable && (c.authorUserId === session.user.id || isAdmin) && (
                        <RemoveButton action={removeComment} id={c.id} title="Delete comment?" description={`Delete this comment by ${c.authorName}? This can't be undone.`} confirmLabel="Delete" label="Delete comment" />
                      )}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{c.body}</p>
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

function RailGroup({ title, icon: Icon, children }: { title: string; icon?: typeof Paperclip; children: React.ReactNode }) {
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

function Block({
  title,
  body,
  footer,
  assist,
}: {
  title: string;
  body: string | null;
  footer?: React.ReactNode;
  assist?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-md border border-border bg-surface px-4 py-4 sm:px-5">
      <h2 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-faint">{title}</h2>
      {body ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{body}</p>
      ) : (
        !footer && <p className="mt-2 text-sm text-ink-faint">Not yet documented.</p>
      )}
      {footer}
      {assist && <div className="mt-auto pt-3">{assist}</div>}
    </section>
  );
}

type Attachment = { id: string; url: string; label: string; kind: string };

function AttachmentLink({ attachment: a }: { attachment: Attachment }) {
  return (
    <a
      href={a.url}
      target={a.kind === "FILE" ? undefined : "_blank"}
      download={a.kind === "FILE" ? a.label : undefined}
      rel="noopener noreferrer"
      className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs text-navy-deep hover:underline"
    >
      {a.kind === "FILE" ? <FileText size={12} className="shrink-0" aria-hidden /> : <ExternalLink size={12} className="shrink-0" aria-hidden />}
      <span className="truncate">{a.label}</span>
    </a>
  );
}
