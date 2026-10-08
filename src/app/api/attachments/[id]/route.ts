import { prisma } from "@/lib/prisma";
import { requireApp } from "@/lib/session";
import { audit } from "@/lib/audit";
import { contentDisposition, getAttachment } from "@/lib/storage";

// Authenticated download for FILE attachments stored in R2. Always served as a
// download (never inline) with nosniff, so even a mislabelled upload can't run
// in the app's origin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApp("initiatives");
  const { id } = await params;
  const row = await prisma.attachment.findUnique({
    where: { id },
    select: { id: true, kind: true, label: true, storageKey: true, contentType: true },
  });
  if (!row || row.kind !== "FILE" || !row.storageKey) return new Response("Not found", { status: 404 });

  const object = await getAttachment(row.storageKey);
  if (!object) return new Response("Not found", { status: 404 });

  await audit(session.user.id, "DOWNLOAD", "Attachment", row.id);
  return new Response(object.body, {
    headers: {
      "Content-Type": row.contentType || "application/octet-stream",
      "Content-Length": String(object.size),
      "Content-Disposition": contentDisposition(row.label),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
