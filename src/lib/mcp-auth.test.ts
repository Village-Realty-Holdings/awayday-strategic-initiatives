import { beforeEach, describe, expect, it, vi } from "vitest";

// /api/mcp authentication (ADR 0001): the access token must verify against the
// app's own keys for the MCP resource, the person's approval must still exist,
// and role, ban and app access are read fresh on every call.

const m = vi.hoisted(() => ({
  verify: vi.fn(),
  consent: vi.fn(),
  user: vi.fn(),
  rateLimit: vi.fn(async () => ({ allowed: true, retryAfterSec: 0 })),
  getJwks: vi.fn(async () => ({ keys: [] })),
}));

vi.mock("better-auth/oauth2", () => ({ verifyJwsAccessToken: m.verify }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getJwks: m.getJwks } } }));
vi.mock("@/lib/prisma", () => ({ prisma: { oauthConsent: { findFirst: m.consent }, user: { findUnique: m.user } } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));

import { authenticateMcpRequest, bearerToken } from "@/lib/mcp-auth";

const JWT = "aaa.bbb.ccc";
const header = `Bearer ${JWT}`;
const claims = (over: Record<string, unknown> = {}) => ({ sub: "u1", azp: "client1", scope: "mcp:read mcp:write offline_access", exp: 9e9, ...over });
const user = (over: Record<string, unknown> = {}) => ({ id: "u1", name: "Erin Editor", role: "editor", banned: false, banExpires: null, appAccess: ["initiatives"], ...over });

beforeEach(() => {
  vi.clearAllMocks();
  m.verify.mockResolvedValue(claims());
  m.consent.mockResolvedValue({ scopes: ["openid", "mcp:read", "mcp:write", "offline_access"] });
  m.user.mockResolvedValue(user());
  m.rateLimit.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
});

describe("bearerToken", () => {
  it("reads a Bearer header only", () => {
    expect(bearerToken("Bearer a.b.c")).toBe("a.b.c");
    expect(bearerToken("bearer   a.b.c ")).toBe("a.b.c");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe("authenticateMcpRequest", () => {
  it("acts as the token's user, with write access for mcp:write", async () => {
    const res = await authenticateMcpRequest(header);
    expect(res).toEqual({ ok: true, actor: { id: "u1", name: "Erin Editor", role: "editor", scope: "write", clientId: "client1" } });
    const opts = m.verify.mock.calls[0][1];
    expect(opts.verifyOptions).toMatchObject({ audience: "http://localhost:3000/api/mcp", issuer: "http://localhost:3000/api/auth" });
    expect(opts.verifyOptions.requiredClaims).toEqual(expect.arrayContaining(["sub", "azp", "exp"]));
    // Keys come from the app itself, not an HTTP fetch of its own URL.
    expect(typeof opts.jwksFetch).toBe("function");
    expect(m.consent).toHaveBeenCalledWith({ where: { userId: "u1", clientId: "client1" }, select: { scopes: true } });
    expect(m.rateLimit).toHaveBeenCalledWith("mcp-oauth:client1:u1", 120, 60_000);
  });

  it("gives read access for mcp:read alone, and refuses a token with neither", async () => {
    m.verify.mockResolvedValue(claims({ scope: "mcp:read" }));
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: true, actor: { scope: "read" } });
    m.verify.mockResolvedValue(claims({ scope: "openid profile" }));
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: false, status: 403 });
  });

  it("asks for sign-in when there is no token, and says invalid_token for a bad one", async () => {
    expect(await authenticateMcpRequest(null)).toMatchObject({ ok: false, status: 401, challenge: "missing" });
    expect(await authenticateMcpRequest("Bearer asi_oldPersonalToken")).toMatchObject({ ok: false, status: 401, challenge: "invalid_token" });
    expect(m.verify).not.toHaveBeenCalled();
    m.verify.mockRejectedValue(new Error("signature verification failed"));
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: false, status: 401, challenge: "invalid_token" });
  });

  it("refuses DPoP-bound tokens and tokens without a user or client", async () => {
    for (const bad of [claims({ cnf: { jkt: "x" } }), claims({ sub: undefined }), claims({ azp: undefined })]) {
      m.verify.mockResolvedValue(bad);
      expect(await authenticateMcpRequest(header)).toMatchObject({ ok: false, status: 401 });
    }
  });

  it("stops working as soon as the app is disconnected (consent deleted)", async () => {
    m.consent.mockResolvedValue(null);
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: false, status: 401, challenge: "invalid_token" });
  });

  it("limits an older write token to what the current consent allows", async () => {
    m.consent.mockResolvedValue({ scopes: ["openid", "mcp:read", "offline_access"] });
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: true, actor: { scope: "read" } });
    m.consent.mockResolvedValue({ scopes: ["openid", "offline_access"] });
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: false, status: 403 });
  });

  it("applies a ban, a removed app grant and a deleted user on the next call", async () => {
    m.user.mockResolvedValue(user({ banned: true }));
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: false, status: 403, error: "This account is suspended." });
    m.user.mockResolvedValue(user({ banned: true, banExpires: new Date("2000-01-01") }));
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: true });
    m.user.mockResolvedValue(user({ appAccess: [] }));
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: false, status: 403 });
    m.user.mockResolvedValue(user({ role: "admin", appAccess: [] }));
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: true });
    m.user.mockResolvedValue(null);
    expect(await authenticateMcpRequest(header)).toMatchObject({ ok: false, status: 401 });
  });

  it("rate limits each connection", async () => {
    m.rateLimit.mockResolvedValue({ allowed: false, retryAfterSec: 12 });
    expect(await authenticateMcpRequest(header)).toEqual({ ok: false, status: 429, error: expect.any(String), retryAfterSec: 12 });
  });
});
