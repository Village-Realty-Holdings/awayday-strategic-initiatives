"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderPlus, Pencil, Trash2, Archive, ArchiveRestore, ChevronRight, Layers } from "@/components/icons";
import { createGroup, updateGroup, deleteGroup, setGroupArchived } from "@/app/(app)/groups/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { InitiativeChecklist } from "@/components/initiative-checklist";

type Initiative = { id: string; code: string; name: string };
type Group = { id: string; name: string; description: string | null; archived: boolean; members: Initiative[] };

// Groups page body. It owns the page header so "New group" can open the
// same dialog that editing uses; create and edit never reshuffle the list.
export function GroupsManager({
  groups,
  initiatives,
  editable,
}: {
  groups: Group[];
  initiatives: Initiative[];
  editable: boolean;
}) {
  // "new" opens the create dialog; a group id opens that group's edit dialog.
  const [dialog, setDialog] = useState<"new" | string | null>(null);
  const editing = dialog && dialog !== "new" ? groups.find((g) => g.id === dialog) : undefined;
  // A save redirects back here with fresh `groups`; that's the moment to close
  // (adjusting state during render, React's pattern for "reset on prop change").
  const [seenGroups, setSeenGroups] = useState(groups);
  if (seenGroups !== groups) {
    setSeenGroups(groups);
    setDialog(null);
  }

  const active = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  return (
    <>
      <PageHeader
        title="Initiative Groups"
        description="Custom collections of initiatives, such as “Q3 Board Meeting”. Each group becomes a filter on the Initiatives table so you can pull up exactly the set you need."
        stats={
          groups.length > 0 && (
            <span className="text-xs text-ink-faint">
              {active.length} active{archived.length > 0 ? ` · ${archived.length} archived` : ""}
            </span>
          )
        }
        actions={
          editable && (
            <Button size="sm" onClick={() => setDialog("new")}>
              <FolderPlus size={14} aria-hidden /> New group
            </Button>
          )
        }
      />

      {active.length === 0 && (
        <div className="grid justify-items-center gap-3 rounded-md border border-dashed border-border bg-surface px-6 py-12 text-center">
          <span aria-hidden className="grid size-9 place-items-center rounded-md bg-navy/10 text-navy-deep">
            <Layers size={18} />
          </span>
          <div className="grid gap-1">
            <p className="text-sm font-medium text-ink">{archived.length ? "No active groups" : "No groups yet"}</p>
            <p className="max-w-sm text-xs leading-5 text-ink-muted">
              Collect the initiatives you present together, then filter the Initiatives table to exactly that set.
            </p>
          </div>
          {editable && (
            <Button size="sm" onClick={() => setDialog("new")}>
              <FolderPlus size={14} aria-hidden /> Create a group
            </Button>
          )}
        </div>
      )}

      {active.length > 0 && (
        <div className="grid gap-3 xl:grid-cols-2">
          {active.map((g) => (
            <GroupCard key={g.id} group={g} editable={editable} onEdit={() => setDialog(g.id)} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <details className="group mt-6">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRight size={13} aria-hidden className="transition-transform group-open:rotate-90" />
            Archived ({archived.length})
          </summary>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {archived.map((g) => (
              <GroupCard key={g.id} group={g} editable={editable} onEdit={() => setDialog(g.id)} />
            ))}
          </div>
        </details>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {dialog === "new" && (
            <GroupForm initiatives={initiatives} action={createGroup} submitLabel="Create group" title="New group" onCancel={() => setDialog(null)} />
          )}
          {editing && (
            <GroupForm
              key={editing.id}
              group={editing}
              initiatives={initiatives}
              action={updateGroup}
              submitLabel="Save group"
              title={`Edit ${editing.name}`}
              onCancel={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupCard({ group: g, editable, onEdit }: { group: Group; editable: boolean; onEdit: () => void }) {
  return (
    <article className={`grid content-start gap-3 rounded-md border border-border bg-surface px-4 py-4 sm:px-5 ${g.archived ? "bg-surface-2/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {g.name}
            <Badge variant="secondary" className="tabular font-normal">
              {g.members.length} initiative{g.members.length === 1 ? "" : "s"}
            </Badge>
            {g.archived && <Badge variant="outline">Archived</Badge>}
          </h2>
          {g.description && <p className="mt-1 text-xs leading-5 text-ink-muted">{g.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/initiatives?group=${g.id}`}>View in table</Link>
          </Button>
          {editable && (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Pencil size={13} aria-hidden /> Edit
              </Button>
              <form action={setGroupArchived}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="archived" value={g.archived ? "false" : "true"} />
                <SubmitButton
                  title={g.archived ? "Restore group" : "Archive group"}
                  aria-label={g.archived ? `Restore ${g.name}` : `Archive ${g.name}`}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  {g.archived ? <ArchiveRestore size={14} aria-hidden /> : <Archive size={14} aria-hidden />}
                </SubmitButton>
              </form>
              <ConfirmAction
                action={deleteGroup}
                fields={{ id: g.id }}
                title="Delete group?"
                description={`Delete group “${g.name}”? The initiatives in it are not affected. This can't be undone.`}
                confirmLabel="Delete group"
                triggerProps={{ title: "Delete group", "aria-label": `Delete ${g.name}`, variant: "ghost", size: "icon", className: "h-8 w-8 hover:bg-risk-soft hover:text-risk" }}
              >
                <Trash2 size={14} aria-hidden />
              </ConfirmAction>
            </>
          )}
        </div>
      </div>
      {g.members.length === 0 ? (
        <p className="text-xs text-ink-faint">No initiatives in this group yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {g.members.map((m) => (
            <li key={m.id}>
              <Badge
                asChild
                variant="outline"
                className="bg-surface-2/40 text-[11px] font-normal transition-colors hover:border-navy/40 hover:text-ink"
              >
                <Link href={`/initiatives/${m.id}`} title={`${m.code} ${m.name}`}>
                  <span className="tabular text-ink-faint">{m.code}</span> <span className="max-w-[240px] truncate">{m.name}</span>
                </Link>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function GroupForm({
  group,
  initiatives,
  action,
  submitLabel,
  title,
  onCancel,
}: {
  group?: Group;
  initiatives: Initiative[];
  action: (fd: FormData) => void | Promise<void>;
  submitLabel: string;
  title: string;
  onCancel: () => void;
}) {
  const memberIds = new Set(group?.members.map((m) => m.id) ?? []);
  return (
    <form action={action} className="grid gap-4">
      {group && <input type="hidden" name="id" value={group.id} />}
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Name the group and tick the initiatives that belong in it.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="flex flex-col gap-1.5">
          Group name
          <Input name="name" required defaultValue={group?.name} placeholder="e.g. Q3 Board Meeting" />
        </Label>
        <Label className="flex flex-col gap-1.5">
          Description (optional)
          <Input name="description" defaultValue={group?.description ?? ""} placeholder="What this group is for" />
        </Label>
      </div>
      <div className="grid gap-2">
        <p className="text-xs font-medium text-ink-muted">Initiatives in this group</p>
        <InitiativeChecklist name="initiativeIds" initiatives={initiatives} defaultSelected={[...memberIds]} className="max-h-72" />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <SubmitButton>{submitLabel}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
