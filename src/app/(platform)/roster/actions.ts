"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}
const plain = (o: unknown) => JSON.parse(JSON.stringify(o));

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
  const session = await requireEditor();
  const email = str(formData, "email");
  if (await emailTakenByOther(email, null)) redirect("/people?error=email_in_use");
  const created = await prisma.rosterMember.create({
    data: {
      name: str(formData, "name") ?? "Unnamed",
      position: str(formData, "position"),
      department: str(formData, "department"),
      email,
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", entity: "RosterMember", entityId: created.id, after: plain(created) },
  });
  revalidatePath("/people");
  redirect("/people");
}

export async function updateRosterMember(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.rosterMember.findUnique({ where: { id } });
  if (!before) redirect("/people");
  const email = str(formData, "email");
  if (await emailTakenByOther(email, id)) redirect("/people?error=email_in_use");
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
    revalidatePath("/initiatives");
  }
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "RosterMember", entityId: id, before: plain(before), after: plain(after) },
  });
  revalidatePath("/people");
  redirect("/people");
}

// Edit a person's details from the People page, even one who only exists as a
// login (User) with no RosterMember yet — in that case we create/link a roster
// record keyed by email so position/department become editable (Jakob: "can't
// update Adam's position/dept once the account is set up").
export async function upsertPersonDetails(formData: FormData) {
  const session = await requireEditor();
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
  if (await emailTakenByOther(email, target?.id ?? null)) redirect("/people?error=email_in_use");

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
      revalidatePath("/initiatives");
    }
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: "UPDATE", entity: "RosterMember", entityId: after.id, before: plain(before), after: plain(after) },
    });
  } else {
    const created = await prisma.rosterMember.create({ data: { name, email, position, department } });
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: "CREATE", entity: "RosterMember", entityId: created.id, after: plain(created) },
    });
  }
  revalidatePath("/people");
  redirect("/people");
}

export async function deleteRosterMember(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.rosterMember.findUnique({ where: { id } });
  if (!before) redirect("/people");
  await prisma.rosterMember.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", entity: "RosterMember", entityId: id, before: plain(before) },
  });
  revalidatePath("/people");
  redirect("/people");
}
