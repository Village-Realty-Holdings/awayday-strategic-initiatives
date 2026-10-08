"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getEbitdaBuild, normalizeEbitda, EBITDA_SETTING_KEY } from "@/lib/overview-data";

function num(fd: FormData, key: string, fallback: number): number {
  const v = fd.get(key);
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function str(fd: FormData, key: string, fallback: string): string {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
}

export async function saveEbitdaBuild(formData: FormData) {
  const session = await requireSession({ role: "admin" });
  const current = await getEbitdaBuild();

  // Trend: up to 5 month/value pairs.
  const trend = current.trend.map((t, idx) => ({
    m: str(formData, `trend_m_${idx}`, t.m),
    v: num(formData, `trend_v_${idx}`, t.v),
  }));

  // Bridge: advanced JSON field; keep current if it doesn't parse.
  let bridge = current.bridge;
  const bridgeRaw = formData.get("bridge");
  if (typeof bridgeRaw === "string" && bridgeRaw.trim() !== "") {
    try {
      const parsed = JSON.parse(bridgeRaw);
      if (Array.isArray(parsed)) bridge = parsed;
    } catch {
      redirect("/admin/scoreboard?error=bridge");
    }
  }

  // lender + valuation are derived from the bridge (normalizeEbitda); the form no
  // longer sets them directly, so the headline can't drift from the build.
  const next = normalizeEbitda({
    ...current,
    asOf: str(formData, "asOf", current.asOf),
    target2026: num(formData, "target2026", current.target2026),
    target2027: num(formData, "target2027", current.target2027),
    ytdGrowth: num(formData, "ytdGrowth", current.ytdGrowth),
    trend,
    bridge,
  });

  await prisma.setting.upsert({
    where: { key: EBITDA_SETTING_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: EBITDA_SETTING_KEY, value: JSON.stringify(next) },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "Setting", entityId: EBITDA_SETTING_KEY, after: JSON.parse(JSON.stringify({ asOf: next.asOf, lender: next.lender })) },
  });
  revalidatePath("/");
  revalidatePath("/admin/scoreboard");
  redirect("/admin/scoreboard?saved=1");
}

// Inline edit on the Overview: saves only the headline figures, preserves the
// trend + bridge, and does NOT redirect (the client toggles back to the read
// view; revalidatePath refreshes the data in place).
export async function saveEbitdaInline(formData: FormData) {
  const session = await requireSession({ role: "admin" });
  const current = await getEbitdaBuild();

  // Inline editing covers the independent figures only. lender + valuation stay
  // derived from the build bridge (normalizeEbitda) and are not set here.
  const next = normalizeEbitda({
    ...current,
    asOf: str(formData, "asOf", current.asOf),
    target2026: num(formData, "target2026", current.target2026),
    target2027: num(formData, "target2027", current.target2027),
    ytdGrowth: num(formData, "ytdGrowth", current.ytdGrowth),
  });

  await prisma.setting.upsert({
    where: { key: EBITDA_SETTING_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: EBITDA_SETTING_KEY, value: JSON.stringify(next) },
  });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE", entity: "Setting", entityId: EBITDA_SETTING_KEY, after: JSON.parse(JSON.stringify({ asOf: next.asOf, lender: next.lender })) },
  });
  revalidatePath("/");
  revalidatePath("/admin/scoreboard");
}
