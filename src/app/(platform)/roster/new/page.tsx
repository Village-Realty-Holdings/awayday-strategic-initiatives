import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { RosterForm } from "@/components/roster-form";
import { createRosterMember } from "@/app/(platform)/roster/actions";

export const dynamic = "force-dynamic";

export default async function NewRosterMemberPage() {
  await requireEditor();
  const [departments, positions] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.position.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/roster" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Roster
      </Link>
      <h1 className="mb-5 text-xl font-semibold tracking-tight text-ink">Add person</h1>
      <RosterForm
        action={createRosterMember}
        departments={departments.map((d) => d.name)}
        positions={positions.map((p) => p.name)}
        submitLabel="Add person"
      />
    </div>
  );
}
