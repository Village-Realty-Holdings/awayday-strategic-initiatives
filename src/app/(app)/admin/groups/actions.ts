"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { str } from "@/lib/form";
import { audit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { requireAdmin } from "@/lib/session";
import { getActivePlan } from "@/lib/active-plan";


export async function createGroup(fd: FormData) {
  const session = await requireAdmin();
  const name = str(fd, "name");
  if (!name) {
    await flash("Give the group a name before creating it.", "error");
    redirect("/admin/groups");
  }
  const ids = [...new Set(fd.getAll("initiativeIds").map(String).filter(Boolean))];
  const created = await prisma.initiativeGroup.create({
    data: { name, description: str(fd, "description"), initiatives: { connect: ids.map((id) => ({ id })) } },
  });
  await audit(session.user.id, "CREATE", "InitiativeGroup", created.id, { after: { name, members: ids.length } });
  revalidatePath("/admin/groups");
  revalidatePath("/admin/initiatives");
  await flash("Group created");
  redirect("/admin/groups");
}

export async function updateGroup(fd: FormData) {
  const session = await requireAdmin();
  const id = String(fd.get("id"));
  const name = str(fd, "name");
  if (!name) {
    await flash("A group needs a name. Nothing was saved.", "error");
    redirect("/admin/groups");
  }
  const ids = [...new Set(fd.getAll("initiativeIds").map(String).filter(Boolean))];
  // The picker only lists active-plan initiatives, so `set` would silently drop
  // members from other plans. Keep any current member outside the active plan.
  const activePlan = await getActivePlan();
  if (activePlan) {
    const outOfPlan = await prisma.initiative.findMany({
      where: {
        groups: { some: { id } },
        OR: [{ planVersionId: null }, { planVersionId: { not: activePlan.id } }],
      },
      select: { id: true },
    });
    for (const m of outOfPlan) if (!ids.includes(m.id)) ids.push(m.id);
  }
  const after = await prisma.initiativeGroup.update({
    where: { id },
    data: { name, description: str(fd, "description"), initiatives: { set: ids.map((x) => ({ id: x })) } },
  });
  await audit(session.user.id, "UPDATE", "InitiativeGroup", id, { after: { name: after.name, members: ids.length } });
  revalidatePath("/admin/groups");
  revalidatePath("/admin/initiatives");
  await flash("Group saved");
  redirect("/admin/groups");
}

export async function setGroupArchived(fd: FormData) {
  const session = await requireAdmin();
  const id = String(fd.get("id"));
  const archived = fd.get("archived") === "true";
  const before = await prisma.initiativeGroup.findUnique({ where: { id } });
  if (!before) redirect("/admin/groups");
  await prisma.initiativeGroup.update({ where: { id }, data: { archived } });
  await audit(session.user.id, "UPDATE", "InitiativeGroup", id, { after: { name: before.name, archived } });
  revalidatePath("/admin/groups");
  revalidatePath("/admin/initiatives");
  await flash(archived ? "Group archived" : "Group restored");
  redirect("/admin/groups");
}

export async function deleteGroup(fd: FormData) {
  const session = await requireAdmin();
  const id = String(fd.get("id"));
  const before = await prisma.initiativeGroup.findUnique({ where: { id } });
  if (!before) redirect("/admin/groups");
  await prisma.initiativeGroup.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "InitiativeGroup", id, { before: { name: before.name } });
  revalidatePath("/admin/groups");
  revalidatePath("/admin/initiatives");
  await flash("Group deleted");
  redirect("/admin/groups");
}
