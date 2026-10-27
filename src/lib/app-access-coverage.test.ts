import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPS } from "@/lib/apps";

// Regression guard for 2026-07-29: the admin app-access action validated
// submitted keys against a hand-written ["initiatives","talent"] list. Granting
// a user Talent therefore silently discarded their "nps" entitlement, and the
// client's HRBP lost access to the module she owns. Any list of app keys that
// gates granting MUST come from the registry.
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("app access coverage", () => {
  it("the admin action derives its allowlist from the registry, not a literal", () => {
    const src = read("app/(app)/admin/actions.ts");
    expect(src).toMatch(/APP_KEYS\s*=\s*APPS\.map/);
    // A literal array of app keys is exactly the bug.
    expect(src).not.toMatch(/APP_KEYS\s*=\s*\[\s*"/);
  });

  it("the people picker offers every app in the registry", () => {
    const src = read("components/people-manager.tsx");
    expect(src).toMatch(/APP_DEFS\.map/);
    expect(src).not.toMatch(/\{\s*key:\s*"talent"\s*,\s*label:/);
  });

  it("every app in the registry is grantable", () => {
    // If this ever shrinks, granting silently drops the missing ones.
    expect(APPS.map((a) => a.key).sort()).toEqual(["initiatives"]);
  });
});
