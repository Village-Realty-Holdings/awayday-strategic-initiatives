import { getCloudflareContext } from "@opennextjs/cloudflare";

// Attachment files live in R2 (ATTACHMENTS binding), not in the database.
// Layout of the bucket:
//   attachments/<initiativeId>/<attachmentId>   initiative files (this module)
//   imports/…                                   reserved for FY27 import files
//
// The bucket is a parameter so tests can pass an in-memory fake.

export type Bucket = Pick<R2Bucket, "put" | "get" | "delete">;

export function attachmentsBucket(): Bucket {
  return getCloudflareContext().env.ATTACHMENTS;
}

export function attachmentKey(initiativeId: string, attachmentId: string): string {
  return `attachments/${initiativeId}/${attachmentId}`;
}

export async function putAttachment(
  key: string,
  file: File,
  bucket: Bucket = attachmentsBucket(),
): Promise<void> {
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
}

export async function getAttachment(key: string, bucket: Bucket = attachmentsBucket()) {
  return bucket.get(key);
}

/** Best-effort: a failed delete leaves an orphaned object, never a failed action. */
export async function deleteAttachment(key: string, bucket: Bucket = attachmentsBucket()): Promise<void> {
  try {
    await bucket.delete(key);
  } catch (e) {
    console.error("R2 delete failed", { key }, e);
  }
}

/**
 * Content-Disposition for a download. The ASCII fallback drops anything that
 * could break the header; filename* carries the real name (RFC 6266/5987).
 */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "file";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
