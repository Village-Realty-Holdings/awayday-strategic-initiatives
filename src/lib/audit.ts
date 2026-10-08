import { prisma } from "@/lib/prisma";

// One-line audit trail for server actions. Best-effort by design: the audit
// write must never turn a completed mutation into a user-facing error.
// DOWNLOAD and DENIED record who fetched a file, or was refused one
// (src/lib/partners/download-audit.ts).
export async function audit(
  userId: string | null | undefined,
  action: "CREATE" | "UPDATE" | "DELETE" | "IMPORT" | "DOWNLOAD" | "DENIED",
  entity: string,
  entityId: string,
  data: { before?: unknown; after?: unknown } = {},
): Promise<void> {
  const plain = (o: unknown) => (o == null ? undefined : JSON.parse(JSON.stringify(o)));
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity,
        entityId,
        before: plain(data.before) as never,
        after: plain(data.after) as never,
      },
    });
  } catch (e) {
    console.error("audit write failed", { entity, entityId, action }, e);
  }
}
