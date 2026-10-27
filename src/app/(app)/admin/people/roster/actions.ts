"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { str } from "@/lib/form";
import { audit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { requireAdmin } from "@/lib/session";


// True if a DIFFERENT roster member already uses this email. Pointing two rows
// at one email is what let the email-match path in upsertPersonDetails overwrite
// (hijack) the wrong person's record, so we refuse colliding emails up front.
async function emailTakenByOther(email: string | null, selfId: string | null): Promise<boolean> {
  if (!email) return false;
  const other = await prisma.rosterMember.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, ...(selfId ? { NOT: { id: selfId } } : {}) },
    select: { id: true },
  });
  return Boolean(other);
}

export async function createRosterMember(formData: FormData) {
  const session = await requireAdmin();
  const email = str(formData, "email");
  if (await emailTakenByOther(email, null)) redirect("/admin/people?error=email_in_use");
  const created = await prisma.rosterMember.create({
    data: {
      name: str(formData, "name") ?? "Unnamed",
      position: str(formData, "position"),
      department: str(formData, "department"),
      email,
    },
  });
  await audit(session.user.id, "CREATE", "RosterMember", created.id, { after: created });
  revalidatePath("/admin/people");
  await flash("Person added");
  redirect("/admin/people");
}

export async function updateRosterMember(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const before = await prisma.rosterMember.findUnique({ where: { id } });
  if (!before) redirect("/admin/people");
  const email = str(formData, "email");
  if (await emailTakenByOther(email, id)) redirect("/admin/people?error=email_in_use");
  const after = await prisma.rosterMember.update({
    where: { id },
    data: {
      name: str(formData, "name") ?? before.name,
      position: str(formData, "position"),
      department: str(formData, "department"),
      email,
    },
  });
  // Owners are stored as the person's name, so keep initiatives linked when a person is
  // renamed — relink BOTH the primary lead and the secondary lead (#29: secondary was missed).
  if (after.name !== before.name) {
    await prisma.initiative.updateMany({ where: { teamLead: before.name }, data: { teamLead: after.name } });
    await prisma.initiative.updateMany({ where: { secondaryLead: before.name }, data: { secondaryLead: after.name } });
    revalidatePath("/scorecard");
    revalidatePath("/admin/initiatives");
  }
  await audit(session.user.id, "UPDATE", "RosterMember", id, { before, after });
  revalidatePath("/admin/people");
  await flash("Person updated");
  redirect("/admin/people");
}

// Edit a person's details from the People page, even one who only exists as a
// login (User) with no RosterMember yet — in that case we create/link a roster
// record keyed by email so position/department become editable (Jakob: "can't
// update Adam's position/dept once the account is set up").
export async function upsertPersonDetails(formData: FormData) {
  const session = await requireAdmin();
  const rosterId = str(formData, "rosterId");
  const email = str(formData, "email");
  const name = str(formData, "name") ?? "Unnamed";
  const position = str(formData, "position");
  const department = str(formData, "department");

  let target = rosterId ? await prisma.rosterMember.findUnique({ where: { id: rosterId } }) : null;
  if (!target && email) {
    target = await prisma.rosterMember.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  }

  // Refuse to set an email that already belongs to a different roster member.
  if (await emailTakenByOther(email, target?.id ?? null)) redirect("/admin/people?error=email_in_use");

  if (target) {
    const before = target;
    const after = await prisma.rosterMember.update({
      where: { id: target.id },
      data: { name, email: email ?? before.email, position, department },
    });
    if (after.name !== before.name) {
      await prisma.initiative.updateMany({ where: { teamLead: before.name }, data: { teamLead: after.name } });
      await prisma.initiative.updateMany({ where: { secondaryLead: before.name }, data: { secondaryLead: after.name } });
      revalidatePath("/scorecard");
      revalidatePath("/admin/initiatives");
    }
    await audit(session.user.id, "UPDATE", "RosterMember", after.id, { before, after });
  } else {
    const created = await prisma.rosterMember.create({ data: { name, email, position, department } });
    await audit(session.user.id, "CREATE", "RosterMember", created.id, { after: created });
  }
  revalidatePath("/admin/people");
  await flash("Details saved");
  redirect("/admin/people");
}

export async function deleteRosterMember(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const before = await prisma.rosterMember.findUnique({ where: { id } });
  if (!before) redirect("/admin/people");
  await prisma.rosterMember.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "RosterMember", id, { before });
  revalidatePath("/admin/people");
  await flash("Person removed");
  redirect("/admin/people");
}
