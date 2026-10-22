import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shell/page-header";
import { requireEditor } from "@/lib/session";
import { RosterForm } from "@/components/roster-form";
import { createRosterMember } from "@/app/(app)/settings/people/roster/actions";

export const dynamic = "force-dynamic";

export default async function NewRosterMemberPage() {
  await requireEditor();
  const [departments, positions] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.position.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="max-w-2xl">
      <PageHeader back={{ href: "/settings/people", label: "People & access" }} eyebrow="People & access" title="Add person" description="Add someone to the People directory so they can own initiatives, milestones and risks." />
      <RosterForm
        action={createRosterMember}
        departments={departments.map((d) => d.name)}
        positions={positions.map((p) => p.name)}
        submitLabel="Add person"
      />
    </div>
  );
}
