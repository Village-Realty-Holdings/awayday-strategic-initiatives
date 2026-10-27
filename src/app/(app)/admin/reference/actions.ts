"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { str, num, clampInt, pick } from "@/lib/form";
import { flash } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import {
  EBITDA_SETTING_KEY,
  PILLARS_SETTING_KEY,
  GOAL_COLORS,
  bridgeFromForm,
  codeList,
  parseEbitdaBuild,
  parsePillarItems,
  parsePillars,
  type EbitdaBuildInput,
  type Pillar,
} from "@/lib/strategy-reference";

const PAGE = "/admin/reference";
const all = (fd: FormData, k: string) => fd.getAll(k).map((v) => (typeof v === "string" ? v : ""));

async function done(message: string, anchor: string): Promise<never> {
  revalidatePath(PAGE);
  await flash(message);
  redirect(`${PAGE}#${anchor}`);
}

async function saveSetting(key: string, value: unknown) {
  const json = JSON.stringify(value);
  await prisma.setting.upsert({ where: { key }, update: { value: json }, create: { key, value: json } });
}

/** EBITDA build: as-of, targets, YTD growth and the bridge rows. */
export async function adminSetEbitdaBuild(fd: FormData): Promise<void> {
  const session = await requireSession({ role: "admin" });
  const before = await prisma.setting.findUnique({ where: { key: EBITDA_SETTING_KEY } });
  const after: EbitdaBuildInput = {
    asOf: str(fd, "asOf")?.slice(0, 60) ?? "",
    target2026: num(fd, "target2026"),
    target2027: num(fd, "target2027"),
    ytdGrowth: num(fd, "ytdGrowth"),
    bridge: bridgeFromForm(all(fd, "bridgeLabel"), all(fd, "bridgeValue"), all(fd, "bridgeKind")),
  };
  await saveSetting(EBITDA_SETTING_KEY, after);
  await audit(session.user.id, "UPDATE", "Setting", EBITDA_SETTING_KEY, { before: parseEbitdaBuild(before?.value), after });
  await done("EBITDA build saved", "ebitda");
}

// Pillars are stored without ids (re-derived from position on read).
const storedPillars = (ps: Pillar[]) =>
  ps.map((p) => ({ name: p.name, headline: p.headline, items: p.items.map(({ name, desc, cim, sis }) => ({ name, desc, cim, sis })) }));

/** Saves pillar `index`, or appends one when the index is past the end. */
export async function adminSavePillar(fd: FormData): Promise<void> {
  const session = await requireSession({ role: "admin" });
  const name = str(fd, "name")?.slice(0, 300);
  if (!name) redirect(`${PAGE}?error=pillar-name#pillars`);
  const row = await prisma.setting.findUnique({ where: { key: PILLARS_SETTING_KEY } });
  const pillars = storedPillars(parsePillars(row?.value));
  const index = clampInt(fd, "index", 0, pillars.length, pillars.length);
  const next = { name, headline: str(fd, "headline")?.slice(0, 300) ?? "", items: parsePillarItems(String(fd.get("items") ?? "")) };
  const before = pillars[index] ?? null;
  pillars[index] = next;
  await saveSetting(PILLARS_SETTING_KEY, pillars);
  await audit(session.user.id, before ? "UPDATE" : "CREATE", "Setting", PILLARS_SETTING_KEY, { before, after: next });
  await done(`Pillar "${name}" saved`, "pillars");
}

export async function adminDeletePillar(fd: FormData): Promise<void> {
  const session = await requireSession({ role: "admin" });
  const row = await prisma.setting.findUnique({ where: { key: PILLARS_SETTING_KEY } });
  const pillars = storedPillars(parsePillars(row?.value));
  const index = clampInt(fd, "index", 0, pillars.length, pillars.length);
  const [removed] = pillars.splice(index, 1);
  if (!removed) redirect(`${PAGE}#pillars`);
  await saveSetting(PILLARS_SETTING_KEY, pillars);
  await audit(session.user.id, "DELETE", "Setting", PILLARS_SETTING_KEY, { before: removed });
  await done(`Pillar "${removed.name}" deleted`, "pillars");
}

/** Creates a scorecard goal when `id` is blank, otherwise updates it. */
export async function adminSaveScorecardGoal(fd: FormData): Promise<void> {
  const session = await requireSession({ role: "admin" });
  const id = str(fd, "id");
  const name = str(fd, "name")?.slice(0, 200);
  const category = str(fd, "category")?.slice(0, 120);
  if (!name || !category) redirect(`${PAGE}?error=goal-name#goals`);
  const text = (k: string, max = 200) => str(fd, k)?.slice(0, max) ?? null;
  const data = {
    category,
    name,
    goal: text("goal"),
    ltm: text("ltm"),
    ytdBud: text("ytdBud"),
    status: text("status"),
    color: pick(fd, "color", GOAL_COLORS, "grey"),
    owner: text("owner"),
    cim: codeList(String(fd.get("cim") ?? "")),
    sis: codeList(String(fd.get("sis") ?? "")),
    notes: text("notes", 2000),
    order: clampInt(fd, "order", 0, 999, 0),
  };
  if (id) {
    const before = await prisma.scorecardGoal.findUnique({ where: { id } });
    if (!before) redirect(`${PAGE}?error=goal-missing#goals`);
    await prisma.scorecardGoal.update({ where: { id }, data });
    await audit(session.user.id, "UPDATE", "ScorecardGoal", id, { before, after: data });
  } else {
    const created = await prisma.scorecardGoal.create({ data });
    await audit(session.user.id, "CREATE", "ScorecardGoal", created.id, { after: data });
  }
  revalidatePath("/admin/initiatives", "layout");
  await done(`Goal "${name}" saved`, "goals");
}

export async function adminDeleteScorecardGoal(fd: FormData): Promise<void> {
  const session = await requireSession({ role: "admin" });
  const id = str(fd, "id");
  const before = id ? await prisma.scorecardGoal.findUnique({ where: { id } }) : null;
  if (!before) redirect(`${PAGE}#goals`);
  await prisma.scorecardGoal.delete({ where: { id: before.id } });
  await audit(session.user.id, "DELETE", "ScorecardGoal", before.id, { before });
  revalidatePath("/admin/initiatives", "layout");
  await done(`Goal "${before.name}" deleted`, "goals");
}
