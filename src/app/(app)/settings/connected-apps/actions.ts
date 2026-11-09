"use server";

import { revalidatePath } from "next/cache";
import { str } from "@/lib/form";
import { requireSession } from "@/lib/session";
import { disconnectMcpConnections } from "@/lib/mcp-connections";

/** Disconnect one of the signed-in user's own connected apps. It loses access on its next request. */
export async function disconnectApp(fd: FormData): Promise<void> {
  const session = await requireSession();
  const consentId = str(fd, "id");
  if (!consentId) return;
  await disconnectMcpConnections({ userId: session.user.id, consentId, actorId: session.user.id, reason: "user" });
  revalidatePath("/settings/connected-apps");
}
