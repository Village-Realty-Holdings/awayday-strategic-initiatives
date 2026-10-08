import { describe, it, expect } from "vitest";
import { attachmentKey, contentDisposition, deleteAttachment, getAttachment, putAttachment, type Bucket } from "./storage";

function fakeBucket() {
  const store = new Map<string, { data: ArrayBuffer; contentType?: string }>();
  const bucket = {
    async put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
      store.set(key, { data: value, contentType: opts?.httpMetadata?.contentType });
      return null;
    },
    async get(key: string) {
      const v = store.get(key);
      return v ? { size: v.data.byteLength, body: v.data, httpMetadata: { contentType: v.contentType } } : null;
    },
    async delete(key: string) {
      store.delete(key);
    },
  } as unknown as Bucket;
  return { bucket, store };
}

describe("attachment storage", () => {
  it("keys files under attachments/<initiative>/<attachment>", () => {
    expect(attachmentKey("init1", "att1")).toBe("attachments/init1/att1");
  });

  it("round-trips a file with its content type, then deletes it", async () => {
    const { bucket, store } = fakeBucket();
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await putAttachment("attachments/i/a", file, bucket);
    expect(store.get("attachments/i/a")?.contentType).toBe("text/plain");
    const got = await getAttachment("attachments/i/a", bucket);
    expect(got?.size).toBe(5);
    await deleteAttachment("attachments/i/a", bucket);
    expect(await getAttachment("attachments/i/a", bucket)).toBeNull();
  });

  it("never throws from delete (orphans are acceptable, failed actions are not)", async () => {
    const bucket = { delete: async () => { throw new Error("down"); } } as unknown as Bucket;
    const errors: unknown[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void errors.push(a);
    await expect(deleteAttachment("k", bucket)).resolves.toBeUndefined();
    console.error = orig;
    expect(errors).toHaveLength(1);
  });
});

describe("contentDisposition", () => {
  it("always downloads, with an ASCII fallback and the UTF-8 name", () => {
    expect(contentDisposition("Plan Q3.pdf")).toBe(`attachment; filename="Plan Q3.pdf"; filename*=UTF-8''Plan%20Q3.pdf`);
  });

  it("cannot break out of the header", () => {
    const h = contentDisposition('a"b\\c\r\nX-Evil: 1.pdf');
    expect(h).not.toMatch(/[\r\n]/);
    expect(h.split(";")[1]).toBe(' filename="a_b_c__X-Evil: 1.pdf"');
  });

  it("keeps non-ASCII names in filename*", () => {
    expect(contentDisposition("Résumé.pdf")).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9.pdf");
  });
});
