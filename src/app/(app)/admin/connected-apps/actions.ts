"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { str } from "@/lib/form";
import { requireAdmin } from "@/lib/session";
import { disconnectMcpConnections } from "@/lib/mcp-connections";

/** Admin: disconnect one person's connected app (by consent id). Audited with the admin as actor. */
export async function adminDisconnectApp(fd: FormData): Promise<void> {
  const session = await requireAdmin();
  const consentId = str(fd, "id");
  if (!consentId) return;
  const consent = await prisma.oauthConsent.findUnique({ where: { id: consentId }, select: { userId: true } });
  if (!consent?.userId) return;
  await disconnectMcpConnections({ userId: consent.userId, consentId, actorId: session.user.id, reason: "admin" });
  revalidatePath("/admin/connected-apps");
}

/** Admin: disconnect every app a person has connected. */
export async function adminDisconnectAllForUser(fd: FormData): Promise<void> {
  const session = await requireAdmin();
  const userId = str(fd, "userId");
  if (!userId) return;
  await disconnectMcpConnections({ userId, actorId: session.user.id, reason: "admin" });
  revalidatePath("/admin/connected-apps");
}
