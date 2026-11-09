"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { str } from "@/lib/form";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";

/**
 * Disconnect one of the signed-in user's connected apps. Deleting the consent
 * cuts Claude off on its next request (mcp-auth.ts checks the consent every
 * time); revoking the refresh tokens means it can't get new access tokens either.
 */
export async function disconnectApp(fd: FormData): Promise<void> {
  const session = await requireSession();
  const id = str(fd, "id") ?? "";
  const consent = await prisma.oauthConsent.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, clientId: true, scopes: true, oauthclient: { select: { name: true } } },
  });
  if (!consent) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.oauthRefreshToken.updateMany({ where: { userId: session.user.id, clientId: consent.clientId, revoked: null }, data: { revoked: now } }),
    prisma.oauthConsent.delete({ where: { id: consent.id } }),
  ]);
  await audit(session.user.id, "DELETE", "OAuthConsent", consent.id, {
    before: { clientId: consent.clientId, app: consent.oauthclient.name, scopes: consent.scopes },
  });
  revalidatePath("/settings/connected-apps");
}
