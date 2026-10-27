// Strategy reference data: the EBITDA build, the 2026 pillars and the Financial &
// Operating Scorecard goals. The figures live in the database (Setting rows
// `ebitda_build` and `pillars_2026`, the ScorecardGoal table) and admins edit them
// on Admin > Strategy reference. This module holds the shapes and the pure
// parsing, so stored JSON and form input are validated in one place.

export const EBITDA_SETTING_KEY = "ebitda_build";
export const PILLARS_SETTING_KEY = "pillars_2026";

export type GoalColor = "green" | "amber" | "red" | "grey";
export const GOAL_COLORS: readonly GoalColor[] = ["green", "amber", "red", "grey"];

export type BridgeKind = "component" | "subtotal" | "total";
export const BRIDGE_KINDS: readonly BridgeKind[] = ["component", "subtotal", "total"];
export type BridgeRow = { label: string; value: number; kind: BridgeKind };

/** As stored: the bridge is the source; the headline figures are derived from it. */
export type EbitdaBuildInput = {
  asOf: string;
  target2026: number | null;
  target2027: number | null;
  ytdGrowth: number | null;
  bridge: BridgeRow[];
};

export type EbitdaBuild = EbitdaBuildInput & { lender: number | null; valuation: number | null };

export type PillarItem = { id: string; name: string; desc: string; cim: string[]; sis: string[] };
export type Pillar = { id: string; name: string; headline: string; items: PillarItem[] };

export type Goal = {
  id: string; category: string; name: string; goal: string; ltm: string; ytdBud: string;
  status: string; color: GoalColor; owner: string; cim: string[]; sis: string[]; notes: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const text = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Codes typed as "CIM-04, CIM-05" or one per word: upper-cased, deduplicated. */
export function codeList(v: unknown): string[] {
  const parts = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,;]+/) : [];
  const codes = parts.map((p) => (typeof p === "string" ? p.trim().toUpperCase() : "")).filter(Boolean);
  return [...new Set(codes)].slice(0, 40);
}

// A subtotal is the running sum of the component rows above it; the total is the
// sum of all component rows. Lender (total) and valuation (subtotal) EBITDA are
// read off the bridge so the headline can never drift from the build behind it.
export function normalizeEbitda(b: EbitdaBuildInput): EbitdaBuild {
  let acc = 0;
  const bridge = b.bridge.map((row) => {
    if (row.kind !== "component") return { ...row, value: round1(acc) };
    acc = round1(acc + row.value);
    return { ...row };
  });
  return {
    ...b,
    bridge,
    valuation: bridge.find((r) => r.kind === "subtotal")?.value ?? null,
    lender: bridge.find((r) => r.kind === "total")?.value ?? null,
  };
}

/** The stored `ebitda_build` JSON, or null when missing or unreadable. */
export function parseEbitdaBuild(raw: string | null | undefined): EbitdaBuild | null {
  if (!raw) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const bridge = (Array.isArray(r.bridge) ? r.bridge : [])
    .map((row): BridgeRow | null => {
      const x = (row ?? {}) as Record<string, unknown>;
      const label = text(x.label, 120);
      // `total`/`subtotal` flags: the shape the removed scoreboard editor saved.
      const kind: BridgeKind = BRIDGE_KINDS.includes(x.kind as BridgeKind)
        ? (x.kind as BridgeKind)
        : x.total === true ? "total" : x.subtotal === true ? "subtotal" : "component";
      const value = finite(x.value) ?? 0;
      return label ? { label, value, kind } : null;
    })
    .filter((x): x is BridgeRow => x !== null);
  return normalizeEbitda({
    asOf: text(r.asOf, 60),
    target2026: finite(r.target2026),
    target2027: finite(r.target2027),
    ytdGrowth: finite(r.ytdGrowth),
    bridge,
  });
}

/** The stored `pillars_2026` JSON; ids are re-derived from position (P1, P1-1). */
export function parsePillars(raw: string | null | undefined): Pillar[] {
  if (!raw) return [];
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(o)) return [];
  return o
    .map((p) => (p ?? {}) as Record<string, unknown>)
    .filter((p) => text(p.name))
    .map((p, i) => ({
      id: `P${i + 1}`,
      name: text(p.name),
      headline: text(p.headline),
      items: (Array.isArray(p.items) ? p.items : [])
        .map((it) => (it ?? {}) as Record<string, unknown>)
        .filter((it) => text(it.name))
        .map((it, j) => ({
          id: `P${i + 1}-${j + 1}`,
          name: text(it.name, 120),
          desc: text(it.desc),
          cim: codeList(it.cim),
          sis: codeList(it.sis),
        })),
    }));
}

/** Pillar items typed one per line: `Name | description | CIM codes | SI codes`. */
export function parsePillarItems(input: string): Omit<PillarItem, "id">[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.split("|").map((c) => c.trim()))
    .filter(([name]) => name)
    .slice(0, 40)
    .map(([name, desc = "", cim = "", sis = ""]) => ({
      name: name.slice(0, 120),
      desc: desc.slice(0, 300),
      cim: codeList(cim),
      sis: codeList(sis),
    }));
}

/** The inverse of parsePillarItems, for the editor's textarea. */
export function formatPillarItems(items: Omit<PillarItem, "id">[]): string {
  return items.map((it) => [it.name, it.desc, it.cim.join(", "), it.sis.join(", ")].join(" | ")).join("\n");
}

// CIM register item (CIM-01…) → its measurable KPIs, from the goal↔CIM links.
// Powers "KPIs tied to the CIM item" on the initiative form (Jakob, 2026-06-15:
// tie KPIs to the CIM backward item, not the broad driver).
export function cimKpiMap(goals: Pick<Goal, "name" | "goal" | "cim">[]): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const g of goals) {
    for (const code of g.cim) {
      (m[code] ??= []).push(g.goal ? `${g.name} → ${g.goal}` : g.name);
    }
  }
  return m;
}

/** Bridge rows from the editor's parallel label / value / kind inputs; blank labels drop. */
export function bridgeFromForm(labels: string[], values: string[], kinds: string[]): BridgeRow[] {
  return labels
    .map((l, i): BridgeRow | null => {
      const label = l.trim().slice(0, 120);
      if (!label) return null;
      const kind = BRIDGE_KINDS.includes(kinds[i] as BridgeKind) ? (kinds[i] as BridgeKind) : "component";
      const n = Number((values[i] ?? "").trim());
      return { label, value: kind === "component" && Number.isFinite(n) ? n : 0, kind };
    })
    .filter((r): r is BridgeRow => r !== null)
    .slice(0, 30);
}
