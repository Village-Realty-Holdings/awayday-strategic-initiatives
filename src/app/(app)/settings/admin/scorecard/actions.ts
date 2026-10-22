"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { audit } from "@/lib/audit";

const COLORS = ["green", "amber", "red", "grey"];

type RowInput = {
  category?: string; name?: string; goal?: string; ltm?: string; ytdBud?: string;
  status?: string; color?: string; owner?: string; cim?: string; sis?: string; notes?: string;
};

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => clean(v).split(",").map((s) => s.trim()).filter(Boolean);

// Replace the whole scorecard from the submitted rows (the form is the source of
// truth). Editor-gated. Rows arrive as JSON in the "rows" field.
export async function saveScorecard(formData: FormData) {
  const session = await requireEditor();
  let rows: RowInput[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("rows") ?? "[]"));
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    // The inline editor always serializes valid JSON; on the off chance it
    // doesn't, no-op rather than wipe the scorecard or navigate to a dead route.
    return;
  }

  // Keep only rows with at least a name; map to records in submitted order.
  const data = rows
    .filter((r) => clean(r.name))
    .map((r, idx) => ({
      category: clean(r.category) || "Uncategorized",
      name: clean(r.name),
      goal: clean(r.goal) || null,
      ltm: clean(r.ltm) || null,
      ytdBud: clean(r.ytdBud) || null,
      status: clean(r.status) || null,
      color: COLORS.includes(clean(r.color)) ? clean(r.color) : "grey",
      owner: clean(r.owner) || null,
      cim: list(r.cim),
      sis: list(r.sis),
      notes: clean(r.notes) || null,
      order: idx,
    }));

  await prisma.$transaction([
    prisma.scorecardGoal.deleteMany({}),
    prisma.scorecardGoal.createMany({ data }),
  ]);
  await audit(session.user.id, "UPDATE", "ScorecardGoal", "scorecard", { after: { rowCount: data.length } });

  // No redirect: edited inline on the Overview, the client toggles back to the
  // read view after this resolves and revalidatePath refreshes the data.
  revalidatePath("/");
}
