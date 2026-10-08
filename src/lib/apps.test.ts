import { describe, it, expect } from "vitest";
import { APPS, accessibleApps, hasApp, type AppDef } from "./apps";

// Dark-launch contract: hidden apps never appear in the launcher (accessibleApps),
// but direct-URL access via entitlement (hasApp) keeps working.

const FIXTURE: AppDef[] = [
  { key: "initiatives", name: "Visible", href: "/", tagline: "", blurb: "" },
  { key: "initiatives", name: "Dark", href: "/dark", tagline: "", blurb: "", hidden: true },
];

describe("accessibleApps", () => {
  it("excludes hidden apps for admins", () => {
    expect(accessibleApps("admin", [], FIXTURE).map((a) => a.name)).toEqual(["Visible"]);
  });
  it("filters visible apps by entitlement for non-admins", () => {
    expect(accessibleApps("user", ["initiatives"]).map((a) => a.key)).toEqual(["initiatives"]);
    expect(accessibleApps("user", null).map((a) => a.key)).toEqual([]);
  });
});

describe("hasApp", () => {
  it("grants admins regardless of entitlement", () => {
    expect(hasApp("admin", [], "initiatives")).toBe(true);
  });
  it("grants entitled users and denies the rest", () => {
    expect(hasApp("editor", ["initiatives"], "initiatives")).toBe(true);
    expect(hasApp("user", [], "initiatives")).toBe(false);
    expect(hasApp("user", null, "initiatives")).toBe(false);
  });
});

describe("APPS registry", () => {
  it("contains only Strategic Initiatives", () => {
    expect(APPS.map((a) => a.key)).toEqual(["initiatives"]);
  });
});
