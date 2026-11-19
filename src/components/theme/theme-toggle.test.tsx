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

  it("keeps a theme control at every width instead of hiding it on phones", () => {
    const html = renderToStaticMarkup(<ThemeToggle initial="system" />);
    // The segmented control is for wide screens: the *wrapper* carries the
    // breakpoint, because the `.theme-toggle` stylesheet rule declares `display`
    // and unlayered CSS outranks Tailwind's layered `hidden` utility. Putting the
    // breakpoint on the element itself left the segmented control visible on a
    // phone beside the compact button.
    expect(html).toMatch(/<div class="hidden sm:flex">/);
    expect(html).not.toMatch(/class="theme-toggle hidden/);
    // ...and below sm the compact trigger is present, so a phone still has a way
    // to choose. Hiding both was the defect this replaced.
    expect(html).toMatch(/class="sm:hidden"/);
    expect(html).toContain("<button");
    expect(html).toMatch(/type="button"/);
    expect(html).toContain('aria-label="Colour theme: System. Choose light, dark or system."');
    expect(html).toContain("theme-toggle__trigger");
    // The trigger gets its own display utility so the stylesheet need not set one.
    expect(html).toMatch(/class="theme-toggle__trigger grid place-items-center"/);
  });

  it("names the current choice on the compact trigger for assistive technology", () => {
    const html = renderToStaticMarkup(<ThemeToggle initial="dark" />);
    expect(html).toContain("Colour theme: Dark.");
    expect(html).toContain('title="Colour theme: Dark"');
  });

  it("is a segmented control, not a single mystery icon", () => {
    const html = renderToStaticMarkup(<ThemeToggle initial="light" />);
    expect(html).toContain("theme-toggle");
    expect(html.match(/theme-toggle__option/g)?.length).toBeGreaterThanOrEqual(3);
    // The choice is announced politely when it changes.
    expect(html).toContain('aria-live="polite"');
  });
});
