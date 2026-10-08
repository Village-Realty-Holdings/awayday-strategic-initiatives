// Pure calendar-grid math for the shared DatePicker.
//
// Everything here works in LOCAL calendar dates as "YYYY-MM-DD" strings, never
// UTC instants: the value a user picks must be the date they clicked, whatever
// their timezone or a DST boundary does. Constructing with `new Date(y, m, d)`
// (local, midday-safe fields) and reading back local getters is what keeps that
// true — `new Date("2026-03-08")` would parse as UTC and can land on the 7th.

export const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Today as YYYY-MM-DD in the browser's local timezone. */
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function toParts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d }; // m is 0-based, like Date
}

/** Build a YYYY-MM-DD string, normalizing out-of-range day/month values. */
export function toISO(y: number, m: number, d: number): string {
  const dt = new Date(y, m, d);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function addDays(iso: string, delta: number): string {
  const { y, m, d } = toParts(iso);
  return toISO(y, m, d + delta);
}

/** "2026-07-27" -> "Jul 27, 2026" */
export function formatDisplay(iso: string): string {
  const { y, m, d } = toParts(iso);
  return new Date(y, m, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "2026-07-27" -> "Monday, July 27, 2026" (screen-reader label). */
export function formatFull(iso: string): string {
  const { y, m, d } = toParts(iso);
  return new Date(y, m, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Calendar cells for a month; leading/trailing nulls pad out to whole weeks. */
export function monthCells(y: number, m: number): (string | null)[] {
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: firstDow }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Split a month's cells into week rows. */
export function monthWeeks(y: number, m: number): (string | null)[][] {
  const cells = monthCells(y, m);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
