import { PILLAR_STATUS_RAG, parseApprovedPillarStatus, type Rag } from "@/lib/review-model";

/**
 * The October 2026 pillar statements, exactly as the reviewed page's strategy
 * house states them.
 *
 * Each `status` is the page's own wording, character for character. The status
 * word at the front picks the colour (see `parseApprovedPillarStatus`); the rest
 * is the reviewer's wording and is shown as written, so "Ahead · CAC off track"
 * never collapses to "Ahead".
 *
 * `chip` is the class the page puts on that chip. It is kept purely so the
 * configuration can be checked against the page: if a wording's status word and
 * the page's colour ever disagree, the plan refuses to write rather than guess
 * which one is right.
 */
export const OCTOBER_REVIEWED_PILLAR_STATUSES = [
  { code: "M&A", status: "Ahead", chip: "good" },
  { code: "GROW", status: "Ahead · CAC off track", chip: "good" },
  { code: "RETENTION", status: "Behind · October beat budget", chip: "crit" },
  { code: "TREVPAR", status: "On track reported · October under PY", chip: "warn" },
  { code: "MARGIN", status: "On goal ex-OTA · behind reported", chip: "warn" },
] as const;

/** Where the wording comes from, recorded on each row exactly as September's rows record theirs. */
export const REVIEWED_STATUS_SOURCE = "Alex Bevington (from Awayday October 2026 Strategy Review(2).html)";

const CHIP_RAG: Record<(typeof OCTOBER_REVIEWED_PILLAR_STATUSES)[number]["chip"], Rag> = {
  good: "GREEN",
  warn: "AMBER",
  crit: "RED",
};

/** The pillar status a reviewed wording carries, and the colour the page gives it. */
export function reviewedPillarStatus(entry: (typeof OCTOBER_REVIEWED_PILLAR_STATUSES)[number]): { wording: string; rag: Rag } | null {
  const parsed = parseApprovedPillarStatus(entry.status);
  return parsed ? { wording: parsed.wording, rag: PILLAR_STATUS_RAG[parsed.status] } : null;
}

export type AreaStatusState = {
  code: string;
  areaId: string;
  kind: "VALUE_DRIVER" | "ENABLER";
  /** The status stored for this period, exactly as stored; null when the month has none. */
  stored: string | null;
};

export type PillarStatusChange = {
  code: string;
  areaId: string;
  from: string | null;
  to: string;
  rag: Rag;
};

export type PillarStatusPlan = {
  periodId: string;
  changes: PillarStatusChange[];
  alreadySet: { code: string; status: string }[];
  issues: string[];
};

/**
 * Plan the October pillar statements against what the month currently holds.
 *
 * Pure, so the same plan is what a dry run prints and what --apply writes.
 * Nothing is planned for a pillar the page does not speak about, and a pillar
 * that already holds a different approved status is reported as a conflict
 * rather than overwritten: a newer hand-approved status outranks this file.
 */
export function planOctoberPillarStatuses(periodId: string, areas: readonly AreaStatusState[]): PillarStatusPlan {
  const changes: PillarStatusChange[] = [];
  const alreadySet: { code: string; status: string }[] = [];
  const issues: string[] = [];

  for (const entry of OCTOBER_REVIEWED_PILLAR_STATUSES) {
    const area = areas.find((candidate) => candidate.code === entry.code);
    if (!area) {
      issues.push(`${entry.code} is not in the loaded state.`);
      continue;
    }
    if (area.kind === "ENABLER") {
      issues.push(`${entry.code} is an enabler, and a hand-set status is a pillar-only decision.`);
      continue;
    }
    const reviewed = reviewedPillarStatus(entry);
    if (!reviewed) {
      issues.push(`${entry.code}'s reviewed wording ("${entry.status}") does not start with a status word, so it would have no colour.`);
      continue;
    }
    if (reviewed.rag !== CHIP_RAG[entry.chip]) {
      issues.push(
        `${entry.code}'s reviewed wording reads ${reviewed.rag} but the page marks it ${entry.chip} (${CHIP_RAG[entry.chip]}). Resolve that before writing.`,
      );
      continue;
    }
    if (area.stored === entry.status) {
      alreadySet.push({ code: entry.code, status: entry.status });
      continue;
    }
    if (area.stored !== null) {
      issues.push(`${entry.code} already holds "${area.stored}" for ${periodId}, which is not this wording. Not overwriting it.`);
      continue;
    }
    changes.push({ code: entry.code, areaId: area.areaId, from: null, to: entry.status, rag: reviewed.rag });
  }

  return { periodId, changes, alreadySet, issues };
}

/** One planned change as a line a person can read. */
export function describePillarStatusChange(change: PillarStatusChange): string {
  return `${change.code}: ${change.from === null ? "(no status)" : `"${change.from}"`} → "${change.to}" (${change.rag})`;
}
