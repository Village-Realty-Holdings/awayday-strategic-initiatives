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
function num(fd: FormData, key: string): number | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function date(fd: FormData, key: string): Date | null {
  const s = str(fd, key);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
const plain = (o: unknown) => JSON.parse(JSON.stringify(o));

// Rough $M EBITDA-equivalent parsed from a prize display string ("$3-5M NOI" -> 4).
// Falls back to null when there's no number ("EV moat").
function parsePrizeNum(prize: string | null): number | null {
  if (!prize) return null;
  const nums = (prize.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  return Math.round((nums[0] + nums[1]) / 2);
}

function fields(fd: FormData) {
  const prize = str(fd, "prize");
  return {
    category: str(fd, "category") ?? "Uncategorized",
    risk: str(fd, "risk") ?? "Untitled risk",
    owner: str(fd, "owner"),
    prize,
    prizeNum: num(fd, "prizeNum") ?? parsePrizeNum(prize),
    currentState: str(fd, "currentState"),
    targetState: str(fd, "targetState"),
    targetDate: date(fd, "targetDate"),
    focus: fd.get("focus") === "on",
    critical: fd.get("critical") === "on",
  };
}

function linkedIds(fd: FormData): string[] {
  return [...new Set(fd.getAll("initiativeIds").map(String).filter(Boolean))];
}

export async function createCimRisk(formData: FormData) {
  const session = await requireEditor();
  const code = (str(formData, "code") ?? "").toUpperCase();
  if (!code) redirect("/risks/new?error=code");
  if (await prisma.cimRisk.findUnique({ where: { code } })) redirect("/risks/new?error=duplicate");
  const ids = linkedIds(formData);
  const created = await prisma.cimRisk.create({
    data: {
      code,
      ...fields(formData),
      initiatives: { create: ids.map((initiativeId) => ({ initiativeId })) },
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE", entity: "CimRisk", entityId: created.id, after: plain(created) },
  });
  revalidatePath("/risks");
  revalidatePath("/");
  redirect("/risks");
}

export async function updateCimRisk(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.cimRisk.findUnique({ where: { id } });
  if (!before) redirect("/risks");
  if (before.updatedAt.toISOString() !== String(formData.get("updatedAt"))) {
    redirect(`/risks/${id}/edit?conflict=1`);
  }
  const ids = linkedIds(formData);
  const after = await prisma.cimRisk.update({
    where: { id },
    data: {
      ...fields(formData),
      initiatives: {
        deleteMany: {},
        create: ids.map((initiativeId) => ({ initiativeId })),
      },
    },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "CimRisk", entityId: id, before: plain(before), after: plain(after) },
  });
  revalidatePath("/risks");
  revalidatePath("/");
  redirect("/risks");
}

export async function deleteCimRisk(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.cimRisk.findUnique({ where: { id } });
  if (!before) redirect("/risks");
  await prisma.cimRisk.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "DELETE", entity: "CimRisk", entityId: id, before: plain(before) },
  });
  revalidatePath("/risks");
  revalidatePath("/");
  redirect("/risks");
}
