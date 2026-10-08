import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every exported server action that mutates the database must write an audit
// log entry. Regression guard for the live-pilot gap where removeAssignment
// deleted roster rows with no trace of who did it.
//
// Allowlisted exceptions must state why.
// Mutating server actions that deliberately skip the audit log, with the reason.
// Every exception must still exist and still mutate (see the last test).
const ALLOWED: Record<string, string> = {};

const MUTATION = /prisma\.\w+\.(create|update|delete|updateMany|deleteMany|createMany|upsert)\b/;

function actionFiles(): string[] {
  const root = join(__dirname, "../..");
  return readdirSync(join(root, "src/app"), { recursive: true })
    .map(String)
    // An actions.ts file, or a file inside an actions/ folder (the Tuck-In
    // actions were split into one file per area on 28 September).
    .filter((p) => p.endsWith("actions.ts") || /(^|[\\/])actions[\\/][^\\/]+\.ts$/.test(p))
    .map((p) => join("src/app", p));
}

function exportedFunctions(src: string): { name: string; body: string }[] {
  const parts = src.split(/export async function (\w+)/);
  const out: { name: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) out.push({ name: parts[i], body: parts[i + 1] });
  return out;
}

describe("audit coverage", () => {
  const files = actionFiles();

  it("finds the server action files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)("%s: every mutating action writes an audit entry", (file) => {
    const src = readFileSync(join(__dirname, "../..", file), "utf8");
    const offenders = exportedFunctions(src)
      .filter((fn) => MUTATION.test(fn.body))
      .filter((fn) => !/auditLog\.create|\baudit\(/.test(fn.body))
      .map((fn) => `${file}:${fn.name}`)
      .filter((key) => !(key in ALLOWED));
    expect(offenders, `mutating actions without audit logging: ${offenders.join(", ")}`).toEqual([]);
  });

  it("allowlist entries still exist and still mutate (no stale exceptions)", () => {
    for (const key of Object.keys(ALLOWED)) {
      const [file, name] = key.split(":");
      const src = readFileSync(join(__dirname, "../..", file), "utf8");
      const fn = exportedFunctions(src).find((f) => f.name === name);
      expect(fn, `${key} no longer exists — remove from allowlist`).toBeDefined();
      expect(MUTATION.test(fn!.body), `${key} no longer mutates — remove from allowlist`).toBe(true);
    }
  });
});
