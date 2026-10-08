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
import { DeleteInitiativeButton } from "@/components/delete-initiative-button";
import {
  addAttachment,
  addFileAttachment,
  removeAttachment,
  addSubInitiative,
  updateSubInitiative,
  removeSubInitiative,
  addComment,
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
import { DatePicker } from "@/components/date-picker";
import {
  ArrowLeft,
  ShieldAlert,
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
  Check,
  UserCheck,
  HandCoins,
} from "lucide-react";

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
                <span className="inline-flex items-center gap-1.5 rounded bg-white/15 px-2 py-0.5 text-xs font-medium text-white">
                  <span className="text-[10px] leading-none" aria-hidden>{STATUS_META[i.status].glyph}</span>
                  {STATUS_META[i.status].label}
                </span>
                <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-medium text-white">
                  {isValue ? QUADRANT_META[i.quadrant].label : "Non-value"}
                </span>
                {behind && (
                  <span className="rounded bg-gold px-2 py-0.5 text-xs font-semibold text-navy-deep">
                    Behind pace
                  </span>
                )}
                {i.cimDriver && (
                  <span className="text-xs text-white/70">{i.cimDriver}</span>
                )}
                {i.cimItemCode && (
                  <span className="tabular rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white/80">{i.cimItemCode}</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-5">
              {isValue ? (
                <>
                  <Badge label="Targeted value" value={formatMoney(i.progressTarget)} tone="gold" />
                  <Badge label="Effort" value={effort} tone="teal" />
                </>
              ) : (
                <Badge label="Type" value="Non-value" tone="gold" />
              )}
            </div>
          </div>
          {editable && (
            <div className="absolute bottom-4 right-6 flex items-center gap-2">
              <Link
                href={`/initiatives/${i.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
              >
                <Pencil size={13} aria-hidden /> Edit
              </Link>
              <DeleteInitiativeButton id={i.id} variant="onDark" />
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
                        <select name="status" defaultValue={s.status} className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-navy">
                          {(["NOT_STARTED", "PLANNING", "IN_PROGRESS", "AT_RISK", "DONE"] as const).map((st) => (
                            <option key={st} value={st}>{STATUS_META[st].label}</option>
                          ))}
                        </select>
                        <input type="number" name="pctComplete" min={0} max={100} defaultValue={Math.round(s.pctComplete * 100)} className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-navy" />
                        <button type="submit" className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface">Save</button>
                      </form>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 text-xs ${STATUS_META[s.status].fg}`}>
                        <span aria-hidden>{STATUS_META[s.status].glyph}</span>
                        {STATUS_META[s.status].label} · {Math.round(s.pctComplete * 100)}%
                      </span>
                    )}
                    {editable && (
                      <form action={removeSubInitiative}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" title="Remove" className="text-ink-faint transition-colors hover:text-risk"><Trash2 size={13} aria-hidden /></button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <form action={addSubInitiative} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <input name="title" required placeholder="Sub-initiative title" className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <select name="owner" defaultValue="" className="w-44 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy">
                <option value="">Owner (from People)</option>
                {people.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2">Add sub-initiative</button>
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
                    {editable ? (
                      <form action={toggleInitiativeMilestone} className="shrink-0">
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          title={m.completedAt ? "Reopen" : "Mark complete"}
                          className={`grid h-5 w-5 place-items-center rounded-full border transition-colors ${
                            m.completedAt ? "border-ok bg-ok/15 text-ok" : "border-border text-transparent hover:border-ok hover:text-ok/50"
                          }`}
                        >
                          <Check size={12} strokeWidth={3} aria-hidden />
                        </button>
                      </form>
                    ) : (
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                          m.completedAt ? "border-ok bg-ok/15 text-ok" : "border-border text-transparent"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${m.completedAt ? "text-ink-faint line-through" : "text-ink"}`}>{m.title}</p>
                      <p className="text-[11px] text-ink-faint">
                        {[m.owner, m.dueAt ? `due ${formatDateDay(m.dueAt)}` : null, m.completedAt ? `done ${formatDateDay(m.completedAt)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {overdue && (
                      <span className="shrink-0 rounded-full bg-risk-soft px-2 py-0.5 text-[11px] font-semibold text-risk">Past due</span>
                    )}
                    {editable && (
                      <form action={removeInitiativeMilestone}>
                        <input type="hidden" name="id" value={m.id} />
                        <button type="submit" title="Remove" className="text-ink-faint transition-colors hover:text-risk"><Trash2 size={13} aria-hidden /></button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {editable && (
            <form action={addInitiativeMilestone} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <input name="title" required placeholder="Milestone" className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <input name="owner" list="people-list" placeholder="Owner" className="w-40 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <div className="w-44"><DatePicker name="dueAt" label="Due date" clearable align="end" /></div>
              <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2">Add milestone</button>
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
                        <select name="status" defaultValue={r.status} className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-navy">
                          <option value="OPEN">Open</option>
                          <option value="MITIGATED">Mitigated</option>
                          <option value="ACCEPTED">Accepted</option>
                        </select>
                        <button type="submit" className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface">Save</button>
                      </form>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "OPEN" ? "bg-risk-soft text-risk" : "bg-surface text-ink-muted"}`}>
                        {r.status === "OPEN" ? "Open" : r.status === "MITIGATED" ? "Mitigated" : "Accepted"}
                      </span>
                    )}
                    {editable && (
                      <form action={removeInitiativeRisk}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" title="Remove" className="text-ink-faint transition-colors hover:text-risk"><Trash2 size={13} aria-hidden /></button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <form action={addInitiativeRisk} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <input name="risk" required placeholder="Risk" className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <input name="mitigation" placeholder="Mitigating action" className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <input name="owner" list="people-list" placeholder="Owner" className="w-36 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2">Add risk</button>
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
                    {editable ? (
                      <form action={toggleInitiativeActionItem} className="shrink-0">
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          title={a.status === "DONE" ? "Reopen" : "Mark done"}
                          className={`grid h-5 w-5 place-items-center rounded-full border transition-colors ${
                            a.status === "DONE" ? "border-ok bg-ok/15 text-ok" : "border-border text-transparent hover:border-ok hover:text-ok/50"
                          }`}
                        >
                          <Check size={12} strokeWidth={3} aria-hidden />
                        </button>
                      </form>
                    ) : (
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                          a.status === "DONE" ? "border-ok bg-ok/15 text-ok" : "border-border text-transparent"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} aria-hidden />
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        a.kind === "DEPENDENCY" ? "bg-gold/20 text-gold-deep" : "bg-navy/10 text-navy-deep"
                      }`}
                    >
                      {a.kind === "DEPENDENCY" ? "Dependency" : "Action"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${a.status === "DONE" ? "text-ink-faint line-through" : "text-ink"}`}>{a.title}</p>
                      <p className="text-[11px] text-ink-faint">
                        {[a.owner, a.dueAt ? `due ${formatDateDay(a.dueAt)}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {overdue && (
                      <span className="shrink-0 rounded-full bg-risk-soft px-2 py-0.5 text-[11px] font-semibold text-risk">Past due</span>
                    )}
                    {editable && (
                      <form action={removeInitiativeActionItem}>
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" title="Remove" className="text-ink-faint transition-colors hover:text-risk"><Trash2 size={13} aria-hidden /></button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {editable && (
            <form action={addInitiativeActionItem} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <select name="kind" defaultValue="ACTION" className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-navy">
                <option value="ACTION">Action</option>
                <option value="DEPENDENCY">Dependency</option>
              </select>
              <input name="title" required placeholder="What is needed" className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <input name="owner" required list="people-list" placeholder="Owner" className="w-40 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <div className="w-44"><DatePicker name="dueAt" label="Due date" clearable align="end" /></div>
              <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2">Add</button>
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
                        <span
                          className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            r.kind === "INVESTMENT" ? "bg-gold/20 text-gold-deep" : "bg-navy/10 text-navy-deep"
                          }`}
                        >
                          {r.kind === "INVESTMENT" ? "Investment" : "Support"}
                        </span>
                        {r.request}
                        {r.amount != null && <span className="ml-1.5 font-semibold text-ink">{formatMoney(Number(r.amount))}</span>}
                      </p>
                      {r.decidedNote && <p className="mt-0.5 text-[11px] text-ink-faint">{r.decidedNote}</p>}
                    </div>
                    {editable ? (
                      <form action={updateInitiativeEltRequest} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={r.id} />
                        <select name="status" defaultValue={r.status} className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-navy">
                          <option value="REQUESTED">Requested</option>
                          <option value="APPROVED">Approved</option>
                          <option value="DECLINED">Declined</option>
                        </select>
                        <button type="submit" className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface">Save</button>
                      </form>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          r.status === "APPROVED" ? "bg-ok/10 text-ok" : r.status === "DECLINED" ? "bg-surface text-ink-muted" : "bg-gold/20 text-gold-deep"
                        }`}
                      >
                        {r.status === "APPROVED" ? "Approved" : r.status === "DECLINED" ? "Declined" : "Requested"}
                      </span>
                    )}
                    {editable && (
                      <form action={removeInitiativeEltRequest}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" title="Remove" className="text-ink-faint transition-colors hover:text-risk"><Trash2 size={13} aria-hidden /></button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <form action={addInitiativeEltRequest} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="initiativeId" value={i.id} />
              <select name="kind" defaultValue="SUPPORT" className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-navy">
                <option value="SUPPORT">Support</option>
                <option value="INVESTMENT">Investment</option>
              </select>
              <input name="request" required placeholder="What the ELT is asked for" className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <input name="amount" placeholder="$ (investment)" className="w-32 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy" />
              <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2">Add request</button>
            </form>
          )}
        </div>

        <datalist id="people-list">
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        {/* CIM risks */}
        {i.risks.length > 0 && (
          <div className="border-t border-border px-6 py-5">
            <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              <ShieldAlert size={14} className="text-navy" aria-hidden /> Mitigates CIM risks
            </h2>
            <ul className="flex flex-col gap-2">
              {i.risks.map(({ cimRisk }) => (
                <li
                  key={cimRisk.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5"
                >
                  <Link href={`/risks#${cimRisk.code}`} className="text-sm text-ink hover:text-navy-deep">
                    <span className="tabular text-xs text-ink-faint">{cimRisk.code}</span> {cimRisk.risk}
                  </Link>
                  <span className="text-[11px] text-ink-faint">
                    {cimRisk.category}
                    {cimRisk.prize ? ` · ${cimRisk.prize}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
                        <form action={removeComment}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" title="Delete comment" className="text-ink-faint transition-colors hover:text-risk"><Trash2 size={12} aria-hidden /></button>
                        </form>
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
              <textarea name="body" required rows={2} placeholder="Add a comment…" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-navy" />
              <button type="submit" className="self-start rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-deep">Post comment</button>
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
                      <form action={removeAttachment}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          title="Remove"
                          className="text-ink-faint transition-colors hover:text-risk"
                        >
                          <X size={13} aria-hidden />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <form action={addAttachment} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="initiativeId" value={i.id} />
                <input
                  name="label"
                  placeholder="Label"
                  className="w-40 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy"
                />
                <input
                  name="url"
                  type="url"
                  required
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy"
                />
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
                >
                  Add link
                </button>
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
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
                >
                  <Upload size={13} aria-hidden /> Upload file
                </button>
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

function Badge({ label, value, tone }: { label: string; value: string; tone: "gold" | "teal" }) {
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
