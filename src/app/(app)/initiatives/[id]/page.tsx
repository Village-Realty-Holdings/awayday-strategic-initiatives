import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgressEditor } from "@/components/progress-editor";
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
import { requireSession, canEdit } from "@/lib/session";
import { ConfirmAction } from "@/components/confirm-action";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Pencil,
  Paperclip,
  ExternalLink,
  FileText,
  Upload,
  X,
  ListTree,
  MessageSquare,
  Trash2,
  AlertTriangle,
  CalendarCheck,
  UserCheck,
  HandCoins,
} from "lucide-react";
import { BreadcrumbTitle } from "@/components/shell/breadcrumbs";

const ATTACH_ERRORS: Record<string, string> = {
  "1": "Enter a valid http(s) URL.",
  file: "Choose a file to upload.",
  size: "File is too large (max 3 MB).",
  type: "That file type isn't allowed. Use PDF, an image, or an Office/CSV/text doc.",
};

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
  const editable = canEdit(session.user.role);
  const isAdmin = session.user.role === "admin";
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
      updates: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!i) notFound();

  // People directory, for the sub-initiative owner picker (Jakob: "pull from People").
  const roster = await prisma.rosterMember.findMany({ select: { name: true }, orderBy: { name: "asc" } });
  const people = [...new Set(roster.map((r) => r.name).filter(Boolean))] as string[];

  const now = new Date();
  const p = pace(i.startDate, i.endDate, i.pctComplete, now);
  const behind = i.status !== "DONE" && p && p.lag < -0.15;
  const days = durationDays(i.startDate, i.endDate);
  const effort = effortBadge(i.lift);
  const isValue = i.valueType === "VALUE";

  const objectiveLine =
    i.quantMetric || i.quantTarget
      ? `${i.quantMetric ?? ""}${i.quantTarget ? ` → ${i.quantTarget}` : ""}`
      : null;

  return (
    <div className="mx-auto max-w-4xl">
      <BreadcrumbTitle path={`/initiatives/${i.id}`} title={`${i.code} ${i.name}`} />
      <Link
        href="/initiatives"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden /> All initiatives
      </Link>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {/* Charter header band */}
        <div className="relative bg-navy px-6 py-5 pb-14 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gold">
                Project Charter
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                <span className="tabular text-white/55">{i.code}</span> · {i.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge variant="custom" className="gap-1.5 rounded bg-white/15 text-white">
                  <span className="text-[10px] leading-none" aria-hidden>{STATUS_META[i.status].glyph}</span>
                  {STATUS_META[i.status].label}
                </Badge>
                <Badge variant="custom" className="rounded bg-white/15 text-white">
                  {isValue ? QUADRANT_META[i.quadrant].label : "Non-value"}
                </Badge>
                {behind && (
                  <Badge variant="custom" className="rounded bg-gold font-semibold text-navy-deep">
                    Behind pace
                  </Badge>
                )}
                {i.cimDriver && (
                  <span className="text-xs text-white/70">{i.cimDriver}</span>
                )}
                {i.cimItemCode && (
                  <Badge variant="custom" className="tabular rounded bg-white/10 px-1.5 text-[11px] text-white/80">{i.cimItemCode}</Badge>
                )}
                {i.strategicArea && (
                  <Badge variant="custom" className="rounded bg-white/10 px-1.5 font-normal text-white/80">{i.strategicArea.name}</Badge>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-5">
              {isValue ? (
                <>
                  <StatBadge label="Targeted value" value={formatMoney(i.progressTarget)} tone="gold" />
                  <StatBadge label="Effort" value={effort} tone="teal" />
                </>
              ) : (
                <StatBadge label="Type" value="Non-value" tone="gold" />
              )}
            </div>
          </div>
          {editable && (
            <div className="absolute bottom-4 right-6 flex items-center gap-2">
              <Button asChild variant="onDark" size="sm" className="px-2.5">
                <Link href={`/initiatives/${i.id}/edit`}>
                  <Pencil size={13} aria-hidden /> Edit
                </Link>
              </Button>
              <DeleteInitiativeButton id={i.id} name={i.name} variant="onDark" />
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border bg-surface-2/50 sm:grid-cols-4 sm:divide-y-0">
          <Meta label="Lead" value={i.teamLead ?? "Unassigned"} />
          <Meta label="Secondary lead" value={i.secondaryLead ?? "—"} />
          <Meta
            label="Timeline"
            value={
              days !== null
                ? `${days} days · ${formatDateDay(i.startDate)} → ${formatDateDay(i.endDate)}`
                : "Not scheduled"
            }
          />
          <Meta label="Working team" value={formatTeam(i.supports) || "—"} />
        </div>

        {/* Charter blocks */}
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x">
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
                <p className="mt-2 text-sm">
                  <span className="font-semibold text-ink">{objectiveLine}</span>
                  {i.endDate && <span className="text-ink-muted"> · by {formatDateDay(i.endDate)}</span>}
                </p>
              ) : null
            }
            assist={editable && <CharterAssistButton initiativeId={i.id} kind="objective" label="Sharpen with Claude" />}
          />
        </div>
        <div className="grid grid-cols-1 divide-y divide-border border-t border-border md:grid-cols-2 md:divide-x">
          <Block
            title="Deliverables"
            accent
            body={i.workRequired}
            assist={editable && <CharterAssistButton initiativeId={i.id} kind="deliverables" label="Suggest outputs" />}
          />
          <div className="px-6 py-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gold-deep">
              Progress &amp; success metrics
            </h2>
            <div className="mt-3">
              {isValue ? (
                <ProgressEditor
                  initiativeId={i.id}
                  pct={i.pctComplete}
                  actual={i.progressActual}
                  target={i.progressTarget}
                  editable={editable}
                  paceNote={p ? { behind: Boolean(behind), text: behind ? `Behind pace. Expected ~${Math.round(p.expected * 100)}% by today.` : `On pace. Expected ~${Math.round(p.expected * 100)}% by today.` } : null}
                  kpiLine={objectiveLine}
                />
              ) : (
                <div>
                  <p className="text-sm text-ink">
                    <span className={`mr-1.5 ${STATUS_META[i.status].fg}`} aria-hidden>{STATUS_META[i.status].glyph}</span>
                    {i.status === "DONE" ? "Complete" : STATUS_META[i.status].label}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-faint">Non-value initiative. Completion is tracked by status, not dollars.</p>
                  {objectiveLine && <p className="mt-2 text-sm font-semibold text-ink">{objectiveLine}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Sub-initiatives */}
        <div className="border-t border-border px-6 py-5">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            <ListTree size={14} className="text-navy" aria-hidden /> Sub-initiatives
            {i.subInitiatives.length > 0 && <span className="text-ink-faint">· {i.subInitiatives.length}</span>}
          </h2>
          {i.subInitiatives.length === 0 && !editable && (
            <p className="text-sm text-ink-faint">No sub-initiatives.</p>
          )}
          {i.subInitiatives.length > 0 && (
            <ul className="flex flex-col gap-2">
              {i.subInitiatives.map((s) => (
                <li key={s.id} className="rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{s.title}</p>
                      {s.owner && <p className="text-[11px] text-ink-faint">{s.owner}</p>}
                    </div>
                    {editable ? (
                      <form action={updateSubInitiative} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={s.id} />
                        <NativeSelect size="xs" name="status" defaultValue={s.status}>
                          {(["NOT_STARTED", "PLANNING", "IN_PROGRESS", "AT_RISK", "DONE"] as const).map((st) => (
                            <option key={st} value={st}>{STATUS_META[st].label}</option>
                          ))}
                        </NativeSelect>
                        <Input size="xs" type="number" name="pctComplete" min={0} max={100} defaultValue={Math.round(s.pctComplete * 100)} className="w-16" />
                        <SubmitButton variant="outline" size="xs" className="hover:bg-surface">Save</SubmitButton>
                      </form>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 text-xs ${STATUS_META[s.status].fg}`}>
                        <span aria-hidden>{STATUS_META[s.status].glyph}</span>
                        {STATUS_META[s.status].label} · {Math.round(s.pctComplete * 100)}%
                      </span>
                    )}
                    {editable && (
                      <ConfirmAction
                          action={removeSubInitiative}
                          fields={{ id: s.id }}
                          title="Remove sub-initiative?"
                          description={`Remove sub-initiative “${s.title}”? This can't be undone.`}
                          confirmLabel="Remove"
                          triggerProps={{ variant: "faint", size: "bare", title: "Remove", "aria-label": "Remove", className: "hover:text-risk" }}
                        >
                          <Trash2 size={13} aria-hidden />
                        </ConfirmAction>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <form action={addSubInitiative} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <Input size="sm" name="title" required placeholder="Sub-initiative title" className="min-w-0 flex-1" />
              <NativeSelect size="sm" name="owner" defaultValue="" className="w-44">
                <option value="">Owner (from People)</option>
                {people.map((p) => <option key={p} value={p}>{p}</option>)}
              </NativeSelect>
              <SubmitButton variant="secondary" size="sm">Add sub-initiative</SubmitButton>
            </form>
          )}
        </div>

        {/* Milestones (Alex: milestone tracking with dates) */}
        <div className="border-t border-border px-6 py-5">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            <CalendarCheck size={14} className="text-navy" aria-hidden /> Milestones
            {i.milestones.length > 0 && (
              <span className="text-ink-faint">
                · {i.milestones.filter((m) => m.completedAt).length}/{i.milestones.length} complete
              </span>
            )}
          </h2>
          {i.milestones.length === 0 && <p className="text-sm text-ink-faint">No milestones yet.</p>}
          {i.milestones.length > 0 && (
            <ul className="flex flex-col gap-2">
              {i.milestones.map((m) => {
                const overdue = !m.completedAt && m.dueAt != null && m.dueAt < now;
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5">
                    <CompletionToggle id={m.id} done={!!m.completedAt} label={m.title} action={toggleInitiativeMilestone} editable={editable} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${m.completedAt ? "text-ink-faint line-through" : "text-ink"}`}>{m.title}</p>
                      <p className="text-[11px] text-ink-faint">
                        {[m.owner, m.dueAt ? `due ${formatDateDay(m.dueAt)}` : null, m.completedAt ? `done ${formatDateDay(m.completedAt)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {overdue && (
                      <Badge variant="risk" shape="pill" className="shrink-0">Past due</Badge>
                    )}
                    {editable && (
                      <ConfirmAction
                          action={removeInitiativeMilestone}
                          fields={{ id: m.id }}
                          title="Remove milestone?"
                          description={`Remove milestone “${m.title}”? This can't be undone.`}
                          confirmLabel="Remove"
                          triggerProps={{ variant: "faint", size: "bare", title: "Remove", "aria-label": "Remove", className: "hover:text-risk" }}
                        >
                          <Trash2 size={13} aria-hidden />
                        </ConfirmAction>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {editable && (
            <form action={addInitiativeMilestone} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <Input size="sm" name="title" required placeholder="Milestone" className="min-w-0 flex-1" />
              <Input size="sm" name="owner" list="people-list" placeholder="Owner" className="w-40" />
              <div className="w-44"><DatePicker name="dueAt" label="Due date" clearable align="end" /></div>
              <SubmitButton variant="secondary" size="sm">Add milestone</SubmitButton>
            </form>
          )}
        </div>

        {/* Risk log (Alex: risks and mitigating actions) */}
        <div className="border-t border-border px-6 py-5">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            <AlertTriangle size={14} className="text-navy" aria-hidden /> Risks &amp; mitigations
            {i.riskLog.length > 0 && <span className="text-ink-faint">· {i.riskLog.filter((r) => r.status === "OPEN").length} open</span>}
          </h2>
          {i.riskLog.length === 0 && <p className="text-sm text-ink-faint">No risks logged.</p>}
          {i.riskLog.length > 0 && (
            <ul className="flex flex-col gap-2">
              {i.riskLog.map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${r.status === "OPEN" ? "text-ink" : "text-ink-muted"}`}>{r.risk}</p>
                      {r.mitigation && (
                        <p className="mt-1 text-[12px] text-ink-muted">
                          <span className="font-semibold text-ink-faint">Mitigation:</span> {r.mitigation}
                        </p>
                      )}
                      {r.owner && <p className="mt-0.5 text-[11px] text-ink-faint">{r.owner}</p>}
                    </div>
                    {editable ? (
                      <form action={updateInitiativeRisk} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={r.id} />
                        <NativeSelect size="xs" name="status" defaultValue={r.status}>
                          <option value="OPEN">Open</option>
                          <option value="MITIGATED">Mitigated</option>
                          <option value="ACCEPTED">Accepted</option>
                        </NativeSelect>
                        <SubmitButton variant="outline" size="xs" className="hover:bg-surface">Save</SubmitButton>
                      </form>
                    ) : (
                      <Badge variant={r.status === "OPEN" ? "risk" : "custom"} shape="pill" className={r.status === "OPEN" ? undefined : "bg-surface text-ink-muted"}>
                        {r.status === "OPEN" ? "Open" : r.status === "MITIGATED" ? "Mitigated" : "Accepted"}
                      </Badge>
                    )}
                    {editable && (
                      <ConfirmAction
                          action={removeInitiativeRisk}
                          fields={{ id: r.id }}
                          title="Remove risk?"
                          description={`Remove risk “${r.risk}”? This can't be undone.`}
                          confirmLabel="Remove"
                          triggerProps={{ variant: "faint", size: "bare", title: "Remove", "aria-label": "Remove", className: "hover:text-risk" }}
                        >
                          <Trash2 size={13} aria-hidden />
                        </ConfirmAction>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <form action={addInitiativeRisk} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <Input size="sm" name="risk" required placeholder="Risk" className="min-w-0 flex-1" />
              <Input size="sm" name="mitigation" placeholder="Mitigating action" className="min-w-0 flex-1" />
              <Input size="sm" name="owner" list="people-list" placeholder="Owner" className="w-36" />
              <SubmitButton variant="secondary" size="sm">Add risk</SubmitButton>
            </form>
          )}
        </div>

        {/* Dependencies & actions (Alex: dependencies with owners, assign actions to owners) */}
        <div className="border-t border-border px-6 py-5">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            <UserCheck size={14} className="text-navy" aria-hidden /> Dependencies &amp; actions
            {i.actionItems.length > 0 && (
              <span className="text-ink-faint">· {i.actionItems.filter((a) => a.status !== "DONE").length} open</span>
            )}
          </h2>
          {i.actionItems.length === 0 && <p className="text-sm text-ink-faint">No dependencies or actions yet.</p>}
          {i.actionItems.length > 0 && (
            <ul className="flex flex-col gap-2">
              {i.actionItems.map((a) => {
                const overdue = a.status !== "DONE" && a.dueAt != null && a.dueAt < now;
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5">
                    <CompletionToggle id={a.id} done={a.status === "DONE"} label={a.title} action={toggleInitiativeActionItem} editable={editable} />
                    <Badge
                      variant="custom"
                      shape="pill"
                      className={`shrink-0 text-[10px] uppercase tracking-wide ${
                        a.kind === "DEPENDENCY" ? "bg-gold/20 text-gold-deep" : "bg-navy/10 text-navy-deep"
                      }`}
                    >
                      {a.kind === "DEPENDENCY" ? "Dependency" : "Action"}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${a.status === "DONE" ? "text-ink-faint line-through" : "text-ink"}`}>{a.title}</p>
                      <p className="text-[11px] text-ink-faint">
                        {[a.owner, a.dueAt ? `due ${formatDateDay(a.dueAt)}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {overdue && (
                      <Badge variant="risk" shape="pill" className="shrink-0">Past due</Badge>
                    )}
                    {editable && (
                      <ConfirmAction
                          action={removeInitiativeActionItem}
                          fields={{ id: a.id }}
                          title="Remove item?"
                          description={`Remove action item “${a.title}”? This can't be undone.`}
                          confirmLabel="Remove"
                          triggerProps={{ variant: "faint", size: "bare", title: "Remove", "aria-label": "Remove", className: "hover:text-risk" }}
                        >
                          <Trash2 size={13} aria-hidden />
                        </ConfirmAction>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {editable && (
            <form action={addInitiativeActionItem} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <NativeSelect size="sm" name="kind" defaultValue="ACTION" className="px-2">
                <option value="ACTION">Action</option>
                <option value="DEPENDENCY">Dependency</option>
              </NativeSelect>
              <Input size="sm" name="title" required placeholder="What is needed" className="min-w-0 flex-1" />
              <Input size="sm" name="owner" required list="people-list" placeholder="Owner" className="w-40" />
              <div className="w-44"><DatePicker name="dueAt" label="Due date" clearable align="end" /></div>
              <SubmitButton variant="secondary" size="sm">Add</SubmitButton>
            </form>
          )}
        </div>

        {/* ELT support & investment (Alex: requests for ELT support / investment) */}
        <div className="border-t border-border px-6 py-5">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            <HandCoins size={14} className="text-navy" aria-hidden /> ELT support &amp; investment requests
            {i.eltRequests.length > 0 && (
              <span className="text-ink-faint">· {i.eltRequests.filter((r) => r.status === "REQUESTED").length} awaiting decision</span>
            )}
          </h2>
          {i.eltRequests.length === 0 && <p className="text-sm text-ink-faint">Nothing requested from the ELT.</p>}
          {i.eltRequests.length > 0 && (
            <ul className="flex flex-col gap-2">
              {i.eltRequests.map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <Badge
                          variant="custom"
                          shape="pill"
                          className={`mr-2 text-[10px] uppercase tracking-wide ${
                            r.kind === "INVESTMENT" ? "bg-gold/20 text-gold-deep" : "bg-navy/10 text-navy-deep"
                          }`}
                        >
                          {r.kind === "INVESTMENT" ? "Investment" : "Support"}
                        </Badge>
                        {r.request}
                        {r.amount != null && <span className="ml-1.5 font-semibold text-ink">{formatMoney(Number(r.amount))}</span>}
                      </p>
                      {r.decidedNote && <p className="mt-0.5 text-[11px] text-ink-faint">{r.decidedNote}</p>}
                    </div>
                    {editable ? (
                      <form action={updateInitiativeEltRequest} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={r.id} />
                        <NativeSelect size="xs" name="status" defaultValue={r.status}>
                          <option value="REQUESTED">Requested</option>
                          <option value="APPROVED">Approved</option>
                          <option value="DECLINED">Declined</option>
                        </NativeSelect>
                        <SubmitButton variant="outline" size="xs" className="hover:bg-surface">Save</SubmitButton>
                      </form>
                    ) : (
                      <Badge
                        variant="custom"
                        shape="pill"
                        className={
                          r.status === "APPROVED" ? "bg-ok/10 text-ok" : r.status === "DECLINED" ? "bg-surface text-ink-muted" : "bg-gold/20 text-gold-deep"
                        }
                      >
                        {r.status === "APPROVED" ? "Approved" : r.status === "DECLINED" ? "Declined" : "Requested"}
                      </Badge>
                    )}
                    {editable && (
                      <ConfirmAction
                          action={removeInitiativeEltRequest}
                          fields={{ id: r.id }}
                          title="Remove ELT request?"
                          description={`Remove ELT request “${r.request}”? This can't be undone.`}
                          confirmLabel="Remove"
                          triggerProps={{ variant: "faint", size: "bare", title: "Remove", "aria-label": "Remove", className: "hover:text-risk" }}
                        >
                          <Trash2 size={13} aria-hidden />
                        </ConfirmAction>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <form action={addInitiativeEltRequest} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <NativeSelect size="sm" name="kind" defaultValue="SUPPORT" className="px-2">
                <option value="SUPPORT">Support</option>
                <option value="INVESTMENT">Investment</option>
              </NativeSelect>
              <Input size="sm" name="request" required placeholder="What the ELT is asked for" className="min-w-0 flex-1" />
              <Input size="sm" name="amount" placeholder="$ (investment)" className="w-32" />
              <SubmitButton variant="secondary" size="sm">Add request</SubmitButton>
            </form>
          )}
        </div>

        <datalist id="people-list">
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        {/* FY27 status update history */}
        <div className="border-t border-border px-6 py-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            FY27 status updates {i.updates.length > 0 && <span>· {i.updates.length}</span>}
          </h2>
          {i.updates.length === 0 ? (
            <p className="text-sm text-ink-faint">No status updates yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {i.updates.map((u) => (
                <li key={u.id} className="rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-xs font-medium ${STATUS_META[u.status].fg}`}><span aria-hidden>{STATUS_META[u.status].glyph}</span> {STATUS_META[u.status].label}</span>
                    <span className="text-[11px] text-ink-faint">{u.reportingPeriod ?? "Unspecified period"} · {formatDateDay(u.createdAt)}</span>
                  </div>
                  {u.update && <p className="mt-1 text-sm text-ink-muted">{u.update}</p>}
                  <p className="mt-1 text-[11px] text-ink-faint">Path forward: {u.pathForward ?? "TBD"} · Next milestone: {u.nextMilestone ?? "TBD"}{u.milestoneDueAt ? ` (${formatDateDay(u.milestoneDueAt)})` : ""}</p>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <form action={addInitiativeUpdate} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <NativeSelect size="sm" name="status" defaultValue={i.status}>
                {(["NOT_STARTED", "PLANNING", "IN_PROGRESS", "AT_RISK", "DONE"] as const).map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
              </NativeSelect>
              <Input size="sm" name="reportingPeriod" placeholder="Reporting period (e.g. October 2026)" />
              <Textarea name="update" rows={2} placeholder="Latest meaningful update" className="sm:col-span-2" />
              <Textarea name="pathForward" rows={2} placeholder="Path forward / next priorities" className="sm:col-span-2" />
              <Input size="sm" name="nextMilestone" placeholder="Next milestone" />
              <Input size="sm" name="milestoneDueAt" type="date" />
              <SubmitButton size="sm" className="w-fit sm:col-span-2">Save status update</SubmitButton>
            </form>
          )}
        </div>

        {/* Comments */}
        <div className="border-t border-border px-6 py-5">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            <MessageSquare size={14} className="text-navy" aria-hidden /> Comments
            {i.comments.length > 0 && <span className="text-ink-faint">· {i.comments.length}</span>}
          </h2>
          {i.comments.length === 0 ? (
            <p className="text-sm text-ink-faint">No comments yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {i.comments.map((c) => (
                <li key={c.id} className="rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-ink">{c.authorName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-ink-faint">{formatDateDay(c.createdAt)}</span>
                      {editable && (c.authorUserId === session.user.id || isAdmin) && (
                        <ConfirmAction
                          action={removeComment}
                          fields={{ id: c.id }}
                          title="Delete comment?"
                          description={`Delete this comment by ${c.authorName}? This can't be undone.`}
                          confirmLabel="Delete"
                          triggerProps={{ variant: "faint", size: "bare", title: "Delete comment", "aria-label": "Delete comment", className: "hover:text-risk" }}
                        >
                          <Trash2 size={12} aria-hidden />
                        </ConfirmAction>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <form action={addComment} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <Textarea name="body" required rows={2} placeholder="Add a comment…" />
              <SubmitButton size="sm" className="self-start">Post comment</SubmitButton>
            </form>
          )}
        </div>

        {/* Attachments */}
        {(i.attachments.length > 0 || editable) && (
          <div className="border-t-2 border-gold/40 bg-surface-2/30 px-6 py-5">
            <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-navy">
              <Paperclip size={14} aria-hidden /> Examples of end product · links &amp; files
            </h2>
            {attachError && <p className="mb-2 text-xs text-risk">{ATTACH_ERRORS[attachError] ?? "Could not add that attachment."}</p>}
            {i.attachments.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {i.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5"
                  >
                    <a
                      href={a.url}
                      target={a.kind === "FILE" ? undefined : "_blank"}
                      download={a.kind === "FILE" ? a.label : undefined}
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1.5 text-xs text-navy-deep hover:underline"
                    >
                      {a.kind === "FILE" ? <FileText size={12} className="shrink-0" aria-hidden /> : <ExternalLink size={12} className="shrink-0" aria-hidden />}
                      <span className="truncate">{a.label}</span>
                    </a>
                    {editable && (
                      <ConfirmAction
                          action={removeAttachment}
                          fields={{ id: a.id }}
                          title="Remove attachment?"
                          description={`Remove attachment “${a.label}”? This can't be undone.`}
                          confirmLabel="Remove"
                          triggerProps={{ variant: "faint", size: "bare", title: "Remove", "aria-label": "Remove", className: "hover:text-risk" }}
                        >
                          <X size={13} aria-hidden />
                        </ConfirmAction>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <form action={addAttachment} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="initiativeId" value={i.id} />
                <Input size="sm" name="label" placeholder="Label" className="w-40" />
                <Input
                  size="sm"
                  name="url"
                  type="url"
                  required
                  placeholder="https://…"
                  className="min-w-0 flex-1"
                />
                <SubmitButton variant="secondary" size="sm">
                  Add link
                </SubmitButton>
              </form>
            )}
            {editable && (
              <form action={addFileAttachment} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="initiativeId" value={i.id} />
                <input
                  name="file"
                  type="file"
                  required
                  className="min-w-0 flex-1 text-xs text-ink-muted file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-surface-2"
                />
                <SubmitButton variant="secondary" size="sm">
                  <Upload size={13} aria-hidden /> Upload file
                </SubmitButton>
                <span className="text-[10px] text-ink-faint">max 3 MB</span>
              </form>
            )}
            {editable && <CharterAssistButton initiativeId={i.id} kind="example" label="Ask Claude for an example end product" />}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, tone }: { label: string; value: string; tone: "gold" | "teal" }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
      <span
        className={`mt-1 inline-block rounded px-2.5 py-1 text-sm font-bold ${
          tone === "gold" ? "bg-gold text-navy-deep" : "bg-teal/90 text-navy-deep"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function Block({
  title,
  body,
  accent,
  footer,
  assist,
}: {
  title: string;
  body: string | null;
  accent?: boolean;
  footer?: React.ReactNode;
  assist?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-5">
      <h2
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          accent ? "text-gold-deep" : "text-ink-faint"
        }`}
      >
        {title}
      </h2>
      {body ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{body}</p>
      ) : (
        !footer && <p className="mt-2 text-sm text-ink-faint">Not yet documented.</p>
      )}
      {footer}
      {assist}
    </div>
  );
}
