"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { str, num, date } from "@/lib/form";
import { audit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { requireEditor } from "@/lib/session";


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
  await audit(session.user.id, "CREATE", "CimRisk", created.id, { after: created });
  revalidatePath("/risks");
  revalidatePath("/");
  revalidatePath("/admin/archive");
  await flash("Risk created");
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
  await audit(session.user.id, "UPDATE", "CimRisk", id, { before, after });
  revalidatePath("/risks");
  revalidatePath("/");
  revalidatePath("/admin/archive");
  await flash("Risk saved");
  redirect("/risks");
}

export async function deleteCimRisk(formData: FormData) {
  const session = await requireEditor();
  const id = String(formData.get("id"));
  const before = await prisma.cimRisk.findUnique({ where: { id } });
  if (!before) redirect("/risks");
  await prisma.cimRisk.delete({ where: { id } });
  await audit(session.user.id, "DELETE", "CimRisk", id, { before });
  revalidatePath("/risks");
  revalidatePath("/");
  revalidatePath("/admin/archive");
  await flash("Risk deleted");
  redirect("/risks");
}
