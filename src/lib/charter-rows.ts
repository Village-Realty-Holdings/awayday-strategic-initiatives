// The charter's three tables (risks, dependencies, milestones), edited as rows
// in the initiative form and posted as JSON. Pure helpers, shared by the server
// action, the FY27 import and tests.

export type RiskRow = { id?: string; risk: string; mitigation: string; owner: string };
export type DependencyRow = { id?: string; need: string; fromWhom: string; byWhen: string };
export type MilestoneRow = { id?: string; title: string; owner: string; dueAt: string };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const lastDayOf = (y: number, m: number) => utc(y, m + 1, 0);

/**
 * A due date as people write it on a charter, and whether it names an exact
 * day. Exact: "2026-10-30", "30 Oct 2026", "Oct 30, 2026", "10/30/26".
 * Periods resolve to their last day: "Oct 2026", "Q1 2027" / "2027-Q1",
 * "Q1 '27". Ranges ("Oct/Nov 2026", "Q2–Q3 2027") take their end, and a
 * trailing note or a leading "Starts" is ignored. Anything else ("TBD",
 * "In progress", "Ongoing") is not a date.
 */
export function readDue(input: string | null | undefined): { date: Date; exact: boolean } | null {
  const raw = (input ?? "").trim().toLowerCase();
  const s = raw
    .replace(/\s*\(.*\)\s*$/, "")
    .replace(/^(starts|by|due)\s+/, "")
    .replace(/,/g, "")
    .replace(/['‘’]\s?(\d{2})$/, " 20$1");
  if (!s) return null;
  // A day with a note around it ("Starts 11 Jan 2027") isn't exact: the note matters.
  const noted = s !== raw.replace(/,/g, "");
  const exact = (d: Date) => ({ date: d, exact: !noted });
  const period = (d: Date) => ({ date: d, exact: false });
  const month = (name: string) => MONTHS.indexOf(name.slice(0, 3));
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return exact(utc(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return exact(utc(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1] - 1, +m[2]));
  m = s.match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/);
  if (m && month(m[2]) >= 0) return exact(utc(+m[3], month(m[2]), +m[1]));
  m = s.match(/^([a-z]+)\.?\s+(\d{1,2})\s+(\d{4})$/);
  if (m && month(m[1]) >= 0) return exact(utc(+m[3], month(m[1]), +m[2]));
  m = s.match(/^(?:end\s+(?:of\s+)?)?([a-z]+)\.?\s+(\d{4})$/);
  if (m && month(m[1]) >= 0) return period(lastDayOf(+m[2], month(m[1])));
  m = s.match(/^(?:end\s+(?:of\s+)?)?q([1-4])\s*(?:fy)?(\d{4})$/);
  if (m) return period(lastDayOf(+m[2], +m[1] * 3 - 1));
  m = s.match(/^(\d{4})-q([1-4])$/);
  if (m) return period(lastDayOf(+m[1], +m[2] * 3 - 1));
  // A range: read its end, carrying the year over ("Oct/Nov 2026", "Q2–Q3 2027").
  m = s.match(/^.+?\s*[–—/-]\s*(.+)$/);
  if (m) {
    const end = readDue(m[1]);
    return end && { date: end.date, exact: false };
  }
  return null;
}

export const parseLooseDate = (input: string | null | undefined) => readDue(input)?.date ?? null;

/**
 * A dependency's "by when": the date (for sorting and overdue) plus the text as
 * written, kept unless it's an exact day the date already says.
 */
export function splitByWhen(input: string | null | undefined): { dueAt: Date | null; byWhen: string | null } {
  const text = (input ?? "").trim();
  const due = readDue(text);
  return { dueAt: due?.date ?? null, byWhen: due?.exact ? null : text || null };
}

const clean = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const id = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{10,40}$/i.test(v) ? v : undefined);

/** Parse a posted JSON array of rows; malformed input yields []. Rows without their key field are dropped. */
function rows<T>(json: string | null, map: (o: Record<string, unknown>) => T | null, max = 50): T[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map(map)
    .filter((r): r is T => r !== null)
    .slice(0, max);
}

export const parseRiskRows = (json: string | null) =>
  rows<RiskRow>(json, (o) => {
    const risk = clean(o.risk);
    return risk ? { id: id(o.id), risk, mitigation: clean(o.mitigation), owner: clean(o.owner, 200) } : null;
  });

export const parseDependencyRows = (json: string | null) =>
  rows<DependencyRow>(json, (o) => {
    const need = clean(o.need);
    return need ? { id: id(o.id), need, fromWhom: clean(o.fromWhom, 200), byWhen: clean(o.byWhen, 100) } : null;
  });

export const parseMilestoneRows = (json: string | null) =>
  rows<MilestoneRow>(json, (o) => {
    const title = clean(o.title, 500);
    const dueAt = clean(o.dueAt, 10);
    return title ? { id: id(o.id), title, owner: clean(o.owner, 200), dueAt: /^\d{4}-\d{2}-\d{2}$/.test(dueAt) ? dueAt : "" } : null;
  });

/**
 * Split posted rows against what's stored: rows whose id matches an existing
 * row update it, rows without one (or with a foreign id) are created, and
 * stored rows that weren't posted are deleted.
 */
export function diffRows<T extends { id?: string }>(posted: T[], existingIds: string[]) {
  const known = new Set(existingIds);
  const update = posted.filter((r) => r.id && known.has(r.id)) as (T & { id: string })[];
  const kept = new Set(update.map((r) => r.id));
  const create = posted.filter((r) => !r.id || !known.has(r.id));
  const remove = existingIds.filter((x) => !kept.has(x));
  return { create, update, remove };
}
