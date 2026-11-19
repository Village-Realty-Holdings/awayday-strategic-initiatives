import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  parseThemePreference,
  resolveTheme,
  themeAttribute,
  themeAttributeValue,
  themeCookie,
  themePreferenceFromCookieHeader,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  THEME_LABELS,
  THEME_PREFERENCES,
} from "./theme";

describe("theme preference", () => {
  it("offers light, dark and follow-system, with system as the default", () => {
    expect(THEME_PREFERENCES).toEqual(["light", "dark", "system"]);
    expect(DEFAULT_THEME_PREFERENCE).toBe("system");
    expect(Object.keys(THEME_LABELS)).toEqual([...THEME_PREFERENCES]);
  });

  it("accepts only the three known preferences", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("DARK")).toBe(false);
    expect(isThemePreference("")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(3)).toBe(false);
  });

  it("falls back to system for a missing or unrecognised stored value", () => {
    expect(parseThemePreference(undefined)).toBe("system");
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference("sepia")).toBe("system");
    expect(parseThemePreference("light")).toBe("light");
  });

  it("prints no data-theme attribute for system, so the media query decides", () => {
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttributeValue("system")).toBeNull();
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("light")).toBe("light");
  });

  it("resolves what a person actually sees, including a system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("stores the choice in a long-lived, site-scoped, lax cookie", () => {
    const cookie = themeCookie("dark");
    expect(cookie).toContain(`${THEME_COOKIE}=dark`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${THEME_COOKIE_MAX_AGE}`);
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    // Presentation only: it is not HttpOnly and carries no credentials.
    expect(cookie).not.toContain("HttpOnly");
    expect(cookie).not.toContain("Domain=");
    expect(themeCookie("dark", false)).not.toContain("Secure");
  });

  it("reads the preference out of a cookie header without disturbing other cookies", () => {
    expect(themePreferenceFromCookieHeader(`${THEME_COOKIE}=dark; session=abc`)).toBe("dark");
    expect(themePreferenceFromCookieHeader(`session=abc; ${THEME_COOKIE}=light`)).toBe("light");
    expect(themePreferenceFromCookieHeader(`${THEME_COOKIE}=%64ark`)).toBe("dark");
    expect(themePreferenceFromCookieHeader("session=abc")).toBe("system");
    expect(themePreferenceFromCookieHeader(null)).toBe("system");
    expect(themePreferenceFromCookieHeader("")).toBe("system");
    // A cookie whose name merely contains ours is not ours.
    expect(themePreferenceFromCookieHeader(`other_${THEME_COOKIE}=dark`)).toBe("system");
  });
});

// ---------------------------------------------------------------------------
// The CSS the preference drives
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");

function darkBlock(): string {
  const start = css.indexOf('html[data-theme="dark"] {');
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

function tokenValue(block: string, token: string): string {
  const match = block.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!match) throw new Error(`missing ${token}`);
  return match[1].trim();
}

/** WCAG relative luminance for a #rrggbb colour. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("theme CSS", () => {
  it("keys dark mode off both an explicit choice and the OS preference", () => {
    expect(css).toContain('html[data-theme="dark"] {');
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)/);
    // An explicit light choice must survive a dark OS.
    expect(css).toMatch(/html:not\(\[data-theme="light"\]\)/);
  });

  it("leaves the print sheet light even when dark is chosen", () => {
    const printBlock = css.slice(css.indexOf("@media print"));
    expect(printBlock).toContain('html[data-theme="dark"]');
    expect(printBlock).toContain("color-scheme: light");
  });

  it("meets WCAG AA for body and small text on the dark surfaces", () => {
    const dark = darkBlock();
    const bg = tokenValue(dark, "--color-bg");
    const surface = tokenValue(dark, "--color-surface");
    const surface2 = tokenValue(dark, "--color-surface-2");
    expect(contrast(tokenValue(dark, "--color-ink"), bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(tokenValue(dark, "--color-ink-muted"), bg)).toBeGreaterThanOrEqual(4.5);
    // ink-faint carries 10–11px notes, so it must clear AA for normal text.
    expect(contrast(tokenValue(dark, "--color-ink-faint"), surface2)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenValue(dark, "--color-ink-faint"), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the status colours readable on dark surfaces", () => {
    const dark = darkBlock();
    const surface = tokenValue(dark, "--color-surface");
    for (const token of ["--color-ok", "--color-warn", "--color-risk", "--color-navy-deep", "--color-gold-deep"]) {
      expect(contrast(tokenValue(dark, token), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("styles the gauge and the sticky report table from tokens", () => {
    expect(css).toContain(".kpi-gauge__plot");
    expect(css).toContain(".kpi-gauge__label");
    expect(css).toContain(".report-table th[scope=\"row\"]");
    // No literal colours inside the gauge rules: they must follow the theme.
    const gaugeBlock = css.slice(css.indexOf(".kpi-gauge {"), css.indexOf(".report-table th"));
    expect(gaugeBlock).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});
