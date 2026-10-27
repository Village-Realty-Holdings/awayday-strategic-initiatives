// FormData readers shared by the server actions. Never trust the client:
// every reader trims, coerces and falls back instead of throwing.

/** Trimmed string, or null when missing or blank. */
export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** One entry per non-blank line, trimmed, duplicates dropped, at most `max`. */
export function lines(fd: FormData, key: string, max = 50): string[] {
  const v = fd.get(key);
  const all = (typeof v === "string" ? v : "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return [...new Set(all)].slice(0, max);
}

/** Finite number, or null when missing, blank or not a number. */
export function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Rounded integer clamped to [min, max]; `fallback` when not a number. */
export function clampInt(fd: FormData, key: string, min: number, max: number, fallback: number): number {
  const n = Number(fd.get(key));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Parsed date, or null when missing or invalid. */
export function date(fd: FormData, key: string): Date | null {
  const s = str(fd, key);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** The value if it is one of `allowed`, otherwise `fallback`. */
export function pick<T extends string>(fd: FormData, key: string, allowed: readonly T[], fallback: T): T {
  const v = String(fd.get(key) ?? "");
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** JSON round-trip: strips Dates/Decimals/undefined for storing in a Json column. */
export const plain = (o: unknown) => JSON.parse(JSON.stringify(o));
