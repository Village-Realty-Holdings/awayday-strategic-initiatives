import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { twoFactor } from "better-auth/plugins";

// Guards against drift between the installed better-auth two-factor plugin and
// our Prisma schema. better-auth 1.6.25 added account-lockout fields
// (failedVerificationCount, lockedUntil) that the plugin writes on EVERY
// verification — including the reset on a successful code. A Prisma client
// generated from a schema without those fields throws on that write, so
// /api/auth/two-factor/verify-totp 500s for every user, correct code or not
// (prod incident 2026-08-10: users without a trust-device cookie were locked
// out of the platform entirely).
describe("better-auth twoFactor plugin vs Prisma schema", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const prismaSchema = readFileSync(join(here, "../../prisma/schema.prisma"), "utf8");
  const model = prismaSchema.match(/model TwoFactor \{[\s\S]*?\n\}/)?.[0] ?? "";

  it("declares every field the installed plugin can read or write", () => {
    const fields = Object.keys(twoFactor().schema?.twoFactor?.fields ?? {});
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      expect(
        model.includes(f),
        `Prisma TwoFactor model is missing "${f}", required by the installed better-auth two-factor plugin`,
      ).toBe(true);
    }
  });
});
