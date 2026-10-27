import { describe, it, expect } from "vitest";
import { lines } from "@/lib/form";

const fd = (v: string) => {
  const f = new FormData();
  f.set("values", v);
  return f;
};

describe("lines", () => {
  it("returns trimmed, non-blank, de-duplicated lines", () => {
    expect(lines(fd("  Local \r\n\nExcellence\nLocal\n  "), "values")).toEqual(["Local", "Excellence"]);
  });

  it("caps the count and treats a missing field as empty", () => {
    expect(lines(fd("a\nb\nc"), "values", 2)).toEqual(["a", "b"]);
    expect(lines(new FormData(), "values")).toEqual([]);
  });
});
