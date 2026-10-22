"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderPlus, Pencil, Trash2, X, Archive, ArchiveRestore } from "@/components/icons";
import { createGroup, updateGroup, deleteGroup, setGroupArchived } from "@/app/(app)/groups/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { InitiativeChecklist } from "@/components/initiative-checklist";

type Initiative = { id: string; code: string; name: string };
type Group = { id: string; name: string; description: string | null; archived: boolean; members: Initiative[] };

export function GroupsManager({
  groups,
  initiatives,
  editable,
}: {
  groups: Group[];
  initiatives: Initiative[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const active = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  const card = (g: Group) =>
    editing === g.id ? (
      <GroupForm
        key={g.id}
        group={g}
        initiatives={initiatives}
        action={updateGroup}
        onClose={() => setEditing(null)}
        submitLabel="Save group"
        title={`Edit ${g.name}`}
      />
    ) : (
      <div key={g.id} className={`rounded-xl border border-border bg-surface p-5 ${g.archived ? "opacity-70" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              {g.name}
              {g.archived && <Badge variant="secondary" className="rounded px-1.5 text-[10px] text-ink-faint">Archived</Badge>}
            </h2>
            {g.description && <p className="mt-0.5 text-xs text-ink-muted">{g.description}</p>}
            <p className="mt-1 text-[11px] text-ink-faint">{g.members.length} initiative{g.members.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="secondary" size="sm" className="px-2.5">
              <Link href={`/initiatives?group=${g.id}`}>View in table</Link>
            </Button>
            {editable && (
              <>
                <Button onClick={() => setEditing(g.id)} title="Edit group" aria-label="Edit group" variant="outline" size="bare" className="p-1.5">
                  <Pencil size={13} aria-hidden />
                </Button>
                <form action={setGroupArchived}>
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="archived" value={g.archived ? "false" : "true"} />
                  <SubmitButton title={g.archived ? "Restore group" : "Archive group"} aria-label={g.archived ? "Restore group" : "Archive group"} variant="outline" size="bare" className="p-1.5">
                    {g.archived ? <ArchiveRestore size={13} aria-hidden /> : <Archive size={13} aria-hidden />}
                  </SubmitButton>
                </form>
                <ConfirmAction
                  action={deleteGroup}
                  fields={{ id: g.id }}
                  title="Delete group?"
                  description={`Delete group “${g.name}”? The initiatives in it are not affected. This can't be undone.`}
                  confirmLabel="Delete group"
                  triggerProps={{ title: "Delete group", "aria-label": "Delete group", variant: "destructive", size: "bare", className: "p-1.5" }}
                >
                  <Trash2 size={13} aria-hidden />
                </ConfirmAction>
              </>
            )}
          </div>
        </div>
        {g.members.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {g.members.map((m) => (
              <Badge
                key={m.id}
                asChild
                variant="outline"
                className="bg-surface-2/40 text-[11px] font-normal transition-colors hover:border-navy/40 hover:text-ink"
              >
                <Link href={`/initiatives/${m.id}`} title={m.name}>
                  <span className="tabular text-ink-faint">{m.code}</span> <span className="max-w-[160px] truncate">{m.name}</span>
                </Link>
              </Badge>
            ))}
          </div>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      {editable && (
        <div>
          {creating ? (
            <GroupForm
              initiatives={initiatives}
              action={createGroup}
              onClose={() => setCreating(false)}
              submitLabel="Create group"
              title="New group"
            />
          ) : (
            <Button onClick={() => setCreating(true)} className="px-3.5">
              <FolderPlus size={15} aria-hidden /> New group
            </Button>
          )}
        </div>
      )}

      {groups.length === 0 && !creating && (
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-ink-muted">
          No groups yet. Create one to start collecting initiatives.
        </div>
      )}

      <div className="flex flex-col gap-3">{active.map(card)}</div>

      {archived.length > 0 && (
        <div className="mt-2">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Archived ({archived.length})</p>
          <div className="flex flex-col gap-3">{archived.map(card)}</div>
        </div>
      )}
    </div>
  );
}

function GroupForm({
  group,
  initiatives,
  action,
  onClose,
  submitLabel,
  title,
}: {
  group?: Group;
  initiatives: Initiative[];
  action: (fd: FormData) => void | Promise<void>;
  onClose: () => void;
  submitLabel: string;
  title: string;
}) {
  const memberIds = new Set(group?.members.map((m) => m.id) ?? []);
  return (
    <form action={action} className="rounded-xl border border-border bg-surface p-5">
      {group && <input type="hidden" name="id" value={group.id} />}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Button type="button" onClick={onClose} variant="faint" size="bare" aria-label="Close"><X size={15} aria-hidden /></Button>
      </div>
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
      <p className="mb-2 mt-4 text-xs font-medium text-ink-muted">Initiatives in this group</p>
      <InitiativeChecklist name="initiativeIds" initiatives={initiatives} defaultSelected={[...memberIds]} className="max-h-64" />
      <div className="mt-4 flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Button type="button" onClick={onClose} variant="faint" size="bare" className="text-sm font-normal text-ink-muted">Cancel</Button>
      </div>
    </form>
  );
}
