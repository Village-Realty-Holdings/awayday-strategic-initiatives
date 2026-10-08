"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { audit } from "@/lib/audit";
import { Q2_SETTING_KEY } from "@/lib/overview-data";

const COLORS = ["green", "amber", "red", "grey"];

type RowInput = { id?: string; name?: string; desc?: string; owner?: string; cim?: unknown; sis?: unknown; color?: string };

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) =>
  Array.isArray(v) ? v.map(clean).filter(Boolean) : clean(v).split(",").map((s) => s.trim()).filter(Boolean);

// Replace the Q2 board from the submitted rows (the table is the source of
// truth). Editor-gated. Rows arrive as JSON in the "rows" field.
export async function saveQ2Board(formData: FormData) {
  const session = await requireEditor();
  let rows: RowInput[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("rows") ?? "[]"));
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    return;
  }

  const data = rows
    .filter((r) => clean(r.name))
    .map((r, idx) => ({
      id: clean(r.id) || `Q2-${idx + 1}`,
      name: clean(r.name),
      desc: clean(r.desc),
      owner: clean(r.owner),
      cim: list(r.cim),
      sis: list(r.sis),
      color: COLORS.includes(clean(r.color)) ? clean(r.color) : "grey",
    }));

  await prisma.setting.upsert({
    where: { key: Q2_SETTING_KEY },
    update: { value: JSON.stringify(data) },
    create: { key: Q2_SETTING_KEY, value: JSON.stringify(data) },
  });
  await audit(session.user.id, "UPDATE", "Setting", Q2_SETTING_KEY, { after: { rows: data.length } });
  revalidatePath("/");
}
