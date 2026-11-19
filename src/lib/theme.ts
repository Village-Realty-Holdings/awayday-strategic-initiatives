// Colour-theme preference: pure helpers shared by the server layout, the
// client toggle and the tests. No React and no database, so both sides resolve
// a preference the same way.
//
// The preference is stored in a plain cookie (never in the database) so the
// server can stamp `data-theme` on <html> before the first paint. That removes
// the hydration flash and needs no inline script, which keeps the existing CSP
// unchanged. "system" stores no attribute at all: the CSS media query then
// follows the operating system, including when the OS preference changes while
// the page is open.

export const THEME_COOKIE = "awayday_theme";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Following the operating system is the default: a first visit is never wrong. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/** One-line description per choice, used as the control's help text. */
export const THEME_DESCRIPTIONS: Record<ThemePreference, string> = {
  light: "Always use the light theme",
  dark: "Always use the dark theme",
  system: "Follow this device's light or dark setting",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** A stored value we no longer recognise falls back to following the system. */
export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

/**
 * The `data-theme` attribute to render: "light" or "dark" when the person has
 * chosen one, undefined for "system" so the media query decides.
 */
export function themeAttribute(preference: ThemePreference): "light" | "dark" | undefined {
  return preference === "system" ? undefined : preference;
}

/** The attribute value the browser should hold for a preference. */
export function themeAttributeValue(preference: ThemePreference): string | null {
  return themeAttribute(preference) ?? null;
}

/** What a person with this preference actually sees, given the device setting. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): "light" | "dark" {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/**
 * The cookie header value that stores a choice. SameSite=Lax: a presentation
 * preference is never sent on a cross-site request, and it is not an auth
 * credential. No HttpOnly, because the toggle writes it from the browser.
 */
export function themeCookie(preference: ThemePreference, secure = true): string {
  const parts = [`${THEME_COOKIE}=${preference}`, "Path=/", `Max-Age=${THEME_COOKIE_MAX_AGE}`, "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Read the cookie out of a raw `Cookie:` header (used by tests and non-Next callers). */
export function themePreferenceFromCookieHeader(header: string | null | undefined): ThemePreference {
  if (!header) return DEFAULT_THEME_PREFERENCE;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === THEME_COOKIE) return parseThemePreference(decodeURIComponent(rest.join("=")));
  }
  return DEFAULT_THEME_PREFERENCE;
}
