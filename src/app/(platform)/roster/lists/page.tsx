import Link from "next/link";
import { ArrowLeft, Plus, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { addDepartment, deleteDepartment, addPosition, deletePosition } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Manage lists — Awayday" };

export default async function ListsPage() {
  await requireEditor();
  const [departments, positions, members] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.position.findMany({ orderBy: { name: "asc" } }),
    prisma.rosterMember.findMany({ select: { department: true, position: true } }),
  ]);

  const deptUse = new Map<string, number>();
  const posUse = new Map<string, number>();
  for (const m of members) {
    if (m.department) deptUse.set(m.department, (deptUse.get(m.department) ?? 0) + 1);
    if (m.position) posUse.set(m.position, (posUse.get(m.position) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/roster" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Roster
      </Link>
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">Manage reference lists</h1>
      <p className="mb-6 text-sm text-ink-muted">
        The departments and positions that power the roster pickers. The number shows how many people
        currently use each one. Removing an entry only drops it from the picker; it leaves existing
        people untouched.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <ListCard
          title="Departments"
          items={departments.map((d) => ({ id: d.id, name: d.name, count: deptUse.get(d.name) ?? 0 }))}
          addAction={addDepartment}
          deleteAction={deleteDepartment}
          placeholder="e.g. Revenue"
        />
        <ListCard
          title="Positions"
          items={positions.map((p) => ({ id: p.id, name: p.name, count: posUse.get(p.name) ?? 0 }))}
          addAction={addPosition}
          deleteAction={deletePosition}
          placeholder="e.g. VP Operations"
        />
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  addAction,
  deleteAction,
  placeholder,
}: {
  title: string;
  items: { id: string; name: string; count: number }[];
  addAction: (fd: FormData) => void | Promise<void>;
  deleteAction: (fd: FormData) => void | Promise<void>;
  placeholder: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="text-[11px] text-ink-faint">{items.length}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2/30 px-3 py-2">
            <span className="truncate text-sm text-ink">{it.name}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted" title="People using this">
                {it.count} in use
              </span>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={it.id} />
                <button type="submit" title="Remove from picker" className="text-ink-faint transition-colors hover:text-risk">
                  <X size={14} aria-hidden />
                </button>
              </form>
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="px-1 py-2 text-xs text-ink-faint">None yet.</li>}
      </ul>
      <form action={addAction} className="mt-3 flex items-center gap-2">
        <input
          name="name"
          required
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-navy"
        />
        <button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-md bg-navy px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-deep">
          <Plus size={13} aria-hidden /> Add
        </button>
      </form>
    </section>
  );
}
