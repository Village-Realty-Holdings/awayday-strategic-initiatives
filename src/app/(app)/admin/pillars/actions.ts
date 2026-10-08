"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { audit } from "@/lib/audit";
import { PILLARS_SETTING_KEY } from "@/lib/overview-data";

type ItemInput = { id?: string; name?: string; desc?: string; cim?: unknown; sis?: unknown };
type PillarInput = { id?: string; name?: string; icon?: string; headline?: string; items?: ItemInput[] };

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) =>
  Array.isArray(v) ? v.map(clean).filter(Boolean) : clean(v).split(",").map((s) => s.trim()).filter(Boolean);

// Replace the 2026 pillars from the submitted JSON (the cards are the source of
// truth). Editor-gated. Pillars arrive as JSON in the "pillars" field.
export async function savePillars(formData: FormData) {
  const session = await requireEditor();
  let pillars: PillarInput[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("pillars") ?? "[]"));
    if (Array.isArray(parsed)) pillars = parsed;
  } catch {
    // The inline editor always serializes valid JSON; no-op rather than wipe.
    return;
  }

  const data = pillars.map((p, pi) => {
    const pid = clean(p.id) || `P${pi + 1}`;
    return {
      id: pid,
      name: clean(p.name),
      icon: clean(p.icon) || "•",
      headline: clean(p.headline),
      items: (Array.isArray(p.items) ? p.items : [])
        .filter((it) => clean(it.name))
        .map((it, ii) => ({
          id: clean(it.id) || `${pid}-${ii + 1}`,
          name: clean(it.name),
          desc: clean(it.desc),
          cim: list(it.cim),
          sis: list(it.sis),
        })),
    };
  });

  await prisma.setting.upsert({
    where: { key: PILLARS_SETTING_KEY },
    update: { value: JSON.stringify(data) },
    create: { key: PILLARS_SETTING_KEY, value: JSON.stringify(data) },
  });
  await audit(session.user.id, "UPDATE", "Setting", PILLARS_SETTING_KEY, { after: { pillars: data.length } });
  revalidatePath("/");
}
