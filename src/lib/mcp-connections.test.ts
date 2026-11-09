import { beforeEach, describe, expect, it, vi } from "vitest";

// Disconnecting MCP OAuth clients (ADR 0001): consents go, refresh tokens are
// revoked, and each disconnected app is audited with who did it and why.

const m = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn((args: { where: unknown }) => ({ op: "deleteConsents", args })),
  updateMany: vi.fn((args: { where: unknown }) => ({ op: "revokeRefresh", args })),
  transaction: vi.fn(async (ops: unknown[]) => ops),
  audit: vi.fn(async () => {}),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    oauthConsent: { findMany: m.findMany, deleteMany: m.deleteMany },
    oauthRefreshToken: { updateMany: m.updateMany },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/audit", () => ({ audit: m.audit }));

import { disconnectMcpConnections } from "@/lib/mcp-connections";

const consent = (id: string, clientId: string) => ({ id, clientId, scopes: ["mcp:read"], oauthclient: { name: "Claude" } });

beforeEach(() => vi.clearAllMocks());

describe("disconnectMcpConnections", () => {
  it("removes all of a user's connections and revokes all their refresh tokens", async () => {
    m.findMany.mockResolvedValue([consent("k1", "c1"), consent("k2", "c2")]);
    const n = await disconnectMcpConnections({ userId: "u1", actorId: "u1", reason: "sign-out" });
    expect(n).toBe(2);
    expect(m.findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
    expect(m.updateMany.mock.calls[0][0]).toMatchObject({ where: { userId: "u1", revoked: null }, data: { revoked: expect.any(Date) } });
    expect(m.deleteMany.mock.calls[0][0]).toEqual({ where: { id: { in: ["k1", "k2"] } } });
    expect(m.transaction).toHaveBeenCalledTimes(1);
    expect(m.audit).toHaveBeenCalledTimes(2);
    expect(m.audit).toHaveBeenCalledWith("u1", "DELETE", "OAuthConsent", "k1", expect.objectContaining({ after: { reason: "sign-out" } }));
  });

  it("revokes refresh tokens even when the user has no consent left", async () => {
    m.findMany.mockResolvedValue([]);
    expect(await disconnectMcpConnections({ userId: "u1", actorId: "admin", reason: "sessions-revoked" })).toBe(0);
    expect(m.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1", revoked: null } }));
  });

  it("disconnects one connection, scoped to its owner and its client", async () => {
    m.findMany.mockResolvedValue([consent("k1", "c1")]);
    await disconnectMcpConnections({ userId: "u1", consentId: "k1", actorId: "admin", reason: "admin" });
    expect(m.findMany.mock.calls[0][0].where).toEqual({ userId: "u1", id: "k1" });
    expect(m.updateMany.mock.calls[0][0].where).toEqual({ userId: "u1", revoked: null, clientId: { in: ["c1"] } });
    expect(m.audit).toHaveBeenCalledWith("admin", "DELETE", "OAuthConsent", "k1", expect.anything());
  });

  it("does nothing for a consent that isn't the user's", async () => {
    m.findMany.mockResolvedValue([]);
    expect(await disconnectMcpConnections({ userId: "u1", consentId: "someone-elses", actorId: "u1", reason: "user" })).toBe(0);
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });
});
