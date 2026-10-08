import { beforeEach, describe, expect, it, vi } from "vitest";

// rateLimitCount: a read-only look at a rateLimit bucket, for checks that must
// not count the try itself (the seller sign-in code's daily cap counts
// failures only, so it checks first and counts after a failure).

const rows = new Map<string, string>();
const setting = {
  findUnique: async ({ where }: { where: { key: string } }) => (rows.has(where.key) ? { key: where.key, value: rows.get(where.key)! } : null),
  upsert: async ({ where, create, update }: { where: { key: string }; create: { value: string }; update: { value: string } }) => {
    rows.set(where.key, rows.has(where.key) ? update.value : create.value);
    return {};
  },
};
// A getter: vi.mock is hoisted above the fake's definition.
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return { setting, $transaction: async (fn: (tx: unknown) => unknown) => fn({ setting }) };
  },
}));

import { rateLimit, rateLimitCount } from "@/lib/rate-limit";

beforeEach(() => {
  rows.clear();
  vi.useRealTimers();
});

describe("rateLimitCount", () => {
  it("reads the bucket rateLimit counts, without adding to it", async () => {
    expect(await rateLimitCount("k")).toBe(0);
    await rateLimit("k", 20, 60_000);
    await rateLimit("k", 20, 60_000);
    expect(await rateLimitCount("k")).toBe(2);
    expect(await rateLimitCount("k")).toBe(2);
  });

  it("reads 0 once the window has passed, or for a malformed row", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
    await rateLimit("k", 20, 60_000);
    vi.setSystemTime(new Date("2026-10-07T00:01:01Z"));
    expect(await rateLimitCount("k")).toBe(0);
    rows.set("rl:bad", "not json");
    expect(await rateLimitCount("bad")).toBe(0);
  });
});
