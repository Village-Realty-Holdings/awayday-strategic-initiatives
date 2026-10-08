"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";

const plain = (o: unknown) => JSON.parse(JSON.stringify(o));

function name(fd: FormData): string {
  const v = fd.get("name");
  return typeof v === "string" ? v.trim() : "";
}

export async function addDepartment(formData: FormData) {
  const session = await requireEditor();
  const n = name(formData);
  if (!n) return;
  const created = await prisma.department.upsert({ where: { name: n }, update: {}, create: { name: n } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", entity: "Department", entityId: created.id, after: plain(created) },
  });
  revalidatePath("/roster/lists");
}

export async function deleteDepartment(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.department.findUnique({ where: { id } });
  if (!before) return;
  await prisma.department.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", entity: "Department", entityId: id, before: plain(before) },
  });
  revalidatePath("/roster/lists");
}

export async function addPosition(formData: FormData) {
  const session = await requireEditor();
  const n = name(formData);
  if (!n) return;
  const created = await prisma.position.upsert({ where: { name: n }, update: {}, create: { name: n } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", entity: "Position", entityId: created.id, after: plain(created) },
  });
  revalidatePath("/roster/lists");
}

export async function deletePosition(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.position.findUnique({ where: { id } });
  if (!before) return;
  await prisma.position.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", entity: "Position", entityId: id, before: plain(before) },
  });
  revalidatePath("/roster/lists");
}
