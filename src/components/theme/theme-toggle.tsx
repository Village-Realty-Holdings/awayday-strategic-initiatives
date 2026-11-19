"use client";

import { useState } from "react";
import { Monitor, Moon, Sun, type AppIcon } from "@/components/icons";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  THEME_DESCRIPTIONS,
  THEME_LABELS,
  THEME_PREFERENCES,
  themeAttributeValue,
  themeCookie,
  type ThemePreference,
} from "@/lib/theme";

const ICONS: Record<ThemePreference, AppIcon> = { light: Sun, dark: Moon, system: Monitor };

/**
 * Light / dark / follow-system. The server has already stamped `data-theme` from
 * the preference cookie, so the first paint is correct. Changing the choice
 * updates <html> and the cookie directly: no navigation, no round trip, and no
 * React state controlling the attribute (which is what causes hydration
 * mismatches). The control is a real radio group, so arrow keys work and the
 * choice is announced.
 */
export function ThemeToggle({ initial, className }: { initial: ThemePreference; className?: string }) {
  const [preference, setPreference] = useState<ThemePreference>(initial);

  function choose(next: ThemePreference) {
    setPreference(next);
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const attribute = themeAttributeValue(next);
    if (attribute) root.setAttribute("data-theme", attribute);
    else root.removeAttribute("data-theme");
    // Secure is harmless over http://localhost and required in production.
    document.cookie = themeCookie(next, window.location.protocol === "https:");
  }

  return (
    <div className={className}>
      <RadioGroup
        aria-label="Colour theme"
        value={preference}
        onValueChange={(value) => choose(value as ThemePreference)}
        className="theme-toggle"
        orientation="horizontal"
      >
        {THEME_PREFERENCES.map((option) => {
          const Icon = ICONS[option];
          return (
            <RadioGroupItem
              key={option}
              value={option}
              variant="pill"
              className="theme-toggle__option"
              aria-label={THEME_LABELS[option]}
              title={THEME_DESCRIPTIONS[option]}
            >
              <Icon size={12} strokeWidth={2} aria-hidden />
              {/* Below the small breakpoint the control is icons only: the same
                  three choices, named for assistive technology, in ~100px. */}
              <span className="hidden sm:inline">{THEME_LABELS[option]}</span>
            </RadioGroupItem>
          );
        })}
      </RadioGroup>
      <span className="sr-only" aria-live="polite">
        {`${THEME_LABELS[preference]} theme selected`}
      </span>
    </div>
  );
}
