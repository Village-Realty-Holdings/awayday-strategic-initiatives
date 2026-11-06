import { beforeEach, describe, expect, it, vi } from "vitest";

// API token auth: only the hash is looked up, expired/revoked/unknown tokens
// all fail the same way, the user's role and access come from the database on
// every call, and each token is rate limited.

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  rateLimit: vi.fn(async () => ({ allowed: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { apiToken: { findUnique: m.findUnique, update: m.update } } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));

import { authenticateToken, bearerToken, generateToken, hashToken, tokenPrefix } from "@/lib/api-tokens";

const now = new Date("2026-11-06T12:00:00Z");
const user = { id: "u1", name: "Erin Editor", role: "editor", banned: false, banExpires: null, appAccess: ["initiatives"] };
const row = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  scope: "write",
  expiresAt: new Date("2027-01-01"),
  revokedAt: null,
  lastUsedAt: null,
  user,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
});

describe("tokens", () => {
  it("are asi_ plus 43 base64url characters, all different", () => {
    const a = generateToken();
    expect(a).toMatch(/^asi_[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
    expect(tokenPrefix(a)).toBe(a.slice(0, 12));
  });

  it("hash to hex SHA-256", async () => {
    expect(await hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("are read from a Bearer header only", () => {
    expect(bearerToken("Bearer asi_x")).toBe("asi_x");
    expect(bearerToken("bearer   asi_x ")).toBe("asi_x");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe("authenticateToken", () => {
  const token = generateToken();
  const header = `Bearer ${token}`;

  it("looks the token up by hash and acts as its user", async () => {
    m.findUnique.mockResolvedValue(row());
    const auth = await authenticateToken(header, now);
    expect(auth).toEqual({ ok: true, actor: { id: "u1", name: "Erin Editor", role: "editor", scope: "write", tokenId: "t1" } });
    expect(m.findUnique.mock.calls[0][0].where).toEqual({ hash: await hashToken(token) });
    expect(m.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { lastUsedAt: now } });
  });

  it("refuses malformed, unknown, revoked and expired tokens alike, without a lookup for malformed ones", async () => {
    expect(await authenticateToken("Bearer nope", now)).toMatchObject({ ok: false, status: 401 });
    expect(m.findUnique).not.toHaveBeenCalled();
    m.findUnique.mockResolvedValueOnce(null);
    const unknown = await authenticateToken(header, now);
    m.findUnique.mockResolvedValueOnce(row({ revokedAt: new Date("2026-11-01") }));
    const revoked = await authenticateToken(header, now);
    m.findUnique.mockResolvedValueOnce(row({ expiresAt: now }));
    const expired = await authenticateToken(header, now);
    expect(unknown).toMatchObject({ ok: false, status: 401 });
    expect(revoked).toEqual(unknown);
    expect(expired).toEqual(unknown);
  });

  it("refuses a banned user and one without access to the app", async () => {
    m.findUnique.mockResolvedValueOnce(row({ user: { ...user, banned: true } }));
    expect(await authenticateToken(header, now)).toMatchObject({ ok: false, status: 403 });
    m.findUnique.mockResolvedValueOnce(row({ user: { ...user, banned: true, banExpires: new Date("2026-11-01") } }));
    expect((await authenticateToken(header, now)).ok).toBe(true);
    m.findUnique.mockResolvedValueOnce(row({ user: { ...user, appAccess: [] } }));
    expect(await authenticateToken(header, now)).toMatchObject({ ok: false, status: 403 });
  });

  it("takes the role from the user as it is now, and keeps a read-only scope", async () => {
    m.findUnique.mockResolvedValue(row({ scope: "read", user: { ...user, role: "user" } }));
    expect(await authenticateToken(header, now)).toMatchObject({ ok: true, actor: { role: "user", scope: "read" } });
  });

  it("rate limits per token", async () => {
    m.findUnique.mockResolvedValue(row());
    m.rateLimit.mockResolvedValue({ allowed: false, retryAfterSec: 12 });
    expect(await authenticateToken(header, now)).toMatchObject({ ok: false, status: 429, retryAfterSec: 12 });
    expect(m.rateLimit).toHaveBeenCalledWith("api-token:t1", 120, 60_000);
  });

  it("records last use at most once a minute", async () => {
    m.findUnique.mockResolvedValue(row({ lastUsedAt: new Date(now.getTime() - 30_000) }));
    await authenticateToken(header, now);
    expect(m.update).not.toHaveBeenCalled();
  });
});
