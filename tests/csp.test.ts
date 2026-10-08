import { describe, expect, it } from "vitest";
import { buildCsp } from "../src/lib/csp";

const directive = (csp: string, name: string) =>
  csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `))?.split(/\s+/).slice(1) ?? [];

describe("buildCsp", () => {
  it("only lets forms submit to this origin", () => {
    expect(directive(buildCsp(true), "form-action")).toEqual(["'self'"]);
  });

  it("blocks framing, plugins and eval in production", () => {
    const csp = buildCsp(true);
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
  });
});
