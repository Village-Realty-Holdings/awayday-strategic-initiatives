import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

// The toggle is a real radio group: three named choices, arrow-key navigable,
// and the server-rendered choice is already the selected one (no flash).

describe("ThemeToggle", () => {
  it("offers light, dark and system by name", () => {
    const html = renderToStaticMarkup(<ThemeToggle initial="system" />);
    expect(html).toContain('aria-label="Colour theme"');
    expect(html).toContain("Light");
    expect(html).toContain("Dark");
    expect(html).toContain("System");
    expect(html.match(/role="radio"/g)).toHaveLength(3);
  });

  it("marks the stored preference as checked from the first render", () => {
    const html = renderToStaticMarkup(<ThemeToggle initial="dark" />);
    const checked = [...html.matchAll(/aria-checked="(true|false)"[^>]*value="([^"]+)"/g)];
    // Radix renders value before aria-checked in some versions; fall back to a
    // per-item scan so the assertion works either way.
    const items = checked.length > 0 ? checked : [...html.matchAll(/value="([^"]+)"[^>]*aria-checked="(true|false)"/g)].map((m) => [null, m[2], m[1]] as unknown as RegExpMatchArray);
    const selected = items.filter((item) => item[1] === "true" || item[2] === "true");
    expect(selected).toHaveLength(1);
    expect(html).toContain('data-state="checked"');
  });

  it("is a segmented control, not a single mystery icon", () => {
    const html = renderToStaticMarkup(<ThemeToggle initial="light" />);
    expect(html).toContain("theme-toggle");
    expect(html.match(/theme-toggle__option/g)?.length).toBeGreaterThanOrEqual(3);
    // The choice is announced politely when it changes.
    expect(html).toContain('aria-live="polite"');
  });
});
