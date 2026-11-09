import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

// Disconnecting Claude (or any MCP OAuth client) from a person's account, for
// every path that does it: the person in Settings > Connected apps, an admin
// in Admin > Connected apps, signing out, and an admin revoking someone's
// sessions or banning them. ADR 0001.
//
// Deleting the consent cuts the client off on its next request (mcp-auth.ts
// checks the consent every time); revoking the refresh tokens means it can't
// get new access tokens either. Each disconnected app is audited.

export type DisconnectReason = "user" | "admin" | "sign-out" | "sessions-revoked" | "banned";

/**
 * Disconnect one connection (consentId) or all of a user's connections.
 * Returns how many apps were disconnected. Refresh tokens are revoked for all
 * the user's clients even when no consent row is left, so nothing can refresh.
 */
export async function disconnectMcpConnections(opts: {
  userId: string;
  consentId?: string;
  actorId: string | null;
  reason: DisconnectReason;
}): Promise<number> {
  const { userId, consentId, actorId, reason } = opts;
  const consents = await prisma.oauthConsent.findMany({
    where: { userId, ...(consentId ? { id: consentId } : {}) },
    select: { id: true, clientId: true, scopes: true, oauthclient: { select: { name: true } } },
  });
  if (consentId && consents.length === 0) return 0;

  const now = new Date();
  const clientIds = consents.map((c) => c.clientId);
  await prisma.$transaction([
    prisma.oauthRefreshToken.updateMany({
      where: { userId, revoked: null, ...(consentId ? { clientId: { in: clientIds } } : {}) },
      data: { revoked: now },
    }),
    prisma.oauthConsent.deleteMany({ where: { id: { in: consents.map((c) => c.id) } } }),
  ]);
  for (const c of consents) {
    await audit(actorId, "DELETE", "OAuthConsent", c.id, {
      before: { userId, clientId: c.clientId, app: c.oauthclient.name, scopes: c.scopes },
      after: { reason },
    });
  }
  return consents.length;
}
