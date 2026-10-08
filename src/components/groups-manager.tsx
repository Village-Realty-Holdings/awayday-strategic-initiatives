"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderPlus, Pencil, Trash2, X, Archive, ArchiveRestore } from "lucide-react";
import { createGroup, updateGroup, deleteGroup, setGroupArchived } from "@/app/(app)/groups/actions";

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
              {g.archived && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">Archived</span>}
            </h2>
            {g.description && <p className="mt-0.5 text-xs text-ink-muted">{g.description}</p>}
            <p className="mt-1 text-[11px] text-ink-faint">{g.members.length} initiative{g.members.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/initiatives?group=${g.id}`}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
            >
              View in table
            </Link>
            {editable && (
              <>
                <button onClick={() => setEditing(g.id)} title="Edit group" className="rounded-md border border-border p-1.5 text-ink-muted transition-colors hover:bg-surface-2">
                  <Pencil size={13} aria-hidden />
                </button>
                <form action={setGroupArchived}>
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="archived" value={g.archived ? "false" : "true"} />
                  <button type="submit" title={g.archived ? "Restore group" : "Archive group"} className="rounded-md border border-border p-1.5 text-ink-muted transition-colors hover:bg-surface-2">
                    {g.archived ? <ArchiveRestore size={13} aria-hidden /> : <Archive size={13} aria-hidden />}
                  </button>
                </form>
                <form action={deleteGroup} onSubmit={(e) => { if (!confirm(`Delete group "${g.name}"? The initiatives themselves are not affected.`)) e.preventDefault(); }}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" title="Delete group" className="rounded-md border border-border p-1.5 text-risk transition-colors hover:bg-risk-soft">
                    <Trash2 size={13} aria-hidden />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
        {g.members.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {g.members.map((m) => (
              <Link
                key={m.id}
                href={`/initiatives/${m.id}`}
                title={m.name}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2/40 px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-navy/40 hover:text-ink"
              >
                <span className="tabular text-ink-faint">{m.code}</span> <span className="max-w-[160px] truncate">{m.name}</span>
              </Link>
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
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep"
            >
              <FolderPlus size={15} aria-hidden /> New group
            </button>
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
        <button type="button" onClick={onClose} className="text-ink-faint transition-colors hover:text-ink"><X size={15} aria-hidden /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-muted">Group name</span>
          <input name="name" required defaultValue={group?.name} placeholder="e.g. Q3 Board Meeting" className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-muted">Description (optional)</span>
          <input name="description" defaultValue={group?.description ?? ""} placeholder="What this group is for" className={input} />
        </label>
      </div>
      <p className="mb-2 mt-4 text-xs font-medium text-ink-muted">Initiatives in this group</p>
      <div className="grid max-h-64 grid-cols-1 gap-x-4 gap-y-1.5 overflow-y-auto rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3">
        {initiatives.map((i) => (
          <label key={i.id} className="flex items-center gap-2 text-xs text-ink">
            <input type="checkbox" name="initiativeIds" value={i.id} defaultChecked={memberIds.has(i.id)} className="h-3.5 w-3.5 shrink-0 rounded border-border accent-navy" />
            <span className="truncate" title={`${i.code} · ${i.name}`}>
              <span className="tabular text-ink-faint">{i.code}</span> {i.name}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep">{submitLabel}</button>
        <button type="button" onClick={onClose} className="text-sm text-ink-muted transition-colors hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}

const input = "rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-navy";
