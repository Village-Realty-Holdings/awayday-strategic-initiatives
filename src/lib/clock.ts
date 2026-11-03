// "Now" for date rules: month rollover, past-due items, schedule pace. The dev
// testing tool can pretend it's another day; everywhere else, and always in a
// production build, this is just the real time. Timestamps of what actually
// happened (createdAt, completedAt, audit) keep using the real clock.

const KEY = "__awaydayDevToday";
const store = globalThis as unknown as Record<string, string | undefined>;

export function appNow(): Date {
  if (process.env.NODE_ENV === "production") return new Date();
  const day = store[KEY];
  return day ? new Date(`${day}T12:00:00Z`) : new Date();
}

/** The pretend day as YYYY-MM-DD, or null on the real clock. Lasts until the dev server restarts. */
export function devToday(): string | null {
  return store[KEY] ?? null;
}

export function setDevToday(day: string | null): void {
  if (day) store[KEY] = day;
  else delete store[KEY];
}
