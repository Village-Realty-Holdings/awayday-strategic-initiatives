"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";

const plain = (o: unknown) => JSON.parse(JSON.stringify(o));
function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

export async function createGroup(fd: FormData) {
  const session = await requireEditor();
  const name = str(fd, "name");
  if (!name) redirect("/groups?error=name");
  const ids = [...new Set(fd.getAll("initiativeIds").map(String).filter(Boolean))];
  const created = await prisma.initiativeGroup.create({
    data: { name, description: str(fd, "description"), initiatives: { connect: ids.map((id) => ({ id })) } },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", entity: "InitiativeGroup", entityId: created.id, after: plain({ name, members: ids.length }) },
  });
  revalidatePath("/groups");
  revalidatePath("/initiatives");
  redirect("/groups");
}

export async function updateGroup(fd: FormData) {
  const session = await requireEditor();
  const id = String(fd.get("id"));
  const name = str(fd, "name");
  if (!name) redirect("/groups");
  const ids = [...new Set(fd.getAll("initiativeIds").map(String).filter(Boolean))];
  const after = await prisma.initiativeGroup.update({
    where: { id },
    data: { name, description: str(fd, "description"), initiatives: { set: ids.map((x) => ({ id: x })) } },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "InitiativeGroup", entityId: id, after: plain({ name: after.name, members: ids.length }) },
  });
  revalidatePath("/groups");
  revalidatePath("/initiatives");
  redirect("/groups");
}

export async function setGroupArchived(fd: FormData) {
  const session = await requireEditor();
  const id = String(fd.get("id"));
  const archived = fd.get("archived") === "true";
  const before = await prisma.initiativeGroup.findUnique({ where: { id } });
  if (!before) redirect("/groups");
  await prisma.initiativeGroup.update({ where: { id }, data: { archived } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "InitiativeGroup", entityId: id, after: plain({ name: before.name, archived }) },
  });
  revalidatePath("/groups");
  revalidatePath("/initiatives");
  redirect("/groups");
}

export async function deleteGroup(fd: FormData) {
  const session = await requireEditor();
  const id = String(fd.get("id"));
  const before = await prisma.initiativeGroup.findUnique({ where: { id } });
  if (!before) redirect("/groups");
  await prisma.initiativeGroup.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", entity: "InitiativeGroup", entityId: id, before: plain({ name: before.name }) },
  });
  revalidatePath("/groups");
  revalidatePath("/initiatives");
  redirect("/groups");
}
