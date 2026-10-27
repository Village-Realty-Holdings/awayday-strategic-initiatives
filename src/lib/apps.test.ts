import { describe, it, expect } from "vitest";
import { APPS, hasApp } from "./apps";

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
