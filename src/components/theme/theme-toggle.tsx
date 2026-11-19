"use client";

import { useState } from "react";
import { Monitor, Moon, Sun, type AppIcon } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
 * Light / dark / follow-system, at every width.
 *
 * The server has already stamped `data-theme` from the preference cookie, so the
 * first paint is correct. Changing the choice updates `<html>` and the cookie
 * directly: no navigation, no round trip, and no React state controlling the
 * attribute (which is what causes hydration mismatches).
 *
 * Wide screens get the three-way segmented control, which reads as a choice
 * rather than a mystery icon. Narrow screens get a compact icon button that
 * opens a popover with the same three labelled options: the control is the same
 * width as the button, so there is no horizontal overflow and no layout shift,
 * and it stays keyboard operable (Radix moves focus into the popover, arrow keys
 * change the choice, Escape returns focus to the button).
 */
export function ThemeToggle({ initial, className }: { initial: ThemePreference; className?: string }) {
  const [preference, setPreference] = useState<ThemePreference>(initial);
  const [open, setOpen] = useState(false);

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

  const CurrentIcon = ICONS[preference];

  return (
    <div className={`flex items-center ${className ?? ""}`}>
      {/* Wide screens: segmented control with words. The wrapper owns the
          breakpoint: `.theme-toggle` is unlayered presentational CSS and its
          `display` would beat Tailwind's layered `hidden` utility, which is how
          the phone ended up showing the segmented control *and* the compact
          button at the same time. */}
      <div className="hidden sm:flex">
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
                <span>{THEME_LABELS[option]}</span>
              </RadioGroupItem>
            );
          })}
        </RadioGroup>
      </div>

      {/* Narrow screens: one button, same three choices behind it. */}
      <div className="sm:hidden">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="theme-toggle__trigger grid place-items-center"
              aria-label={`Colour theme: ${THEME_LABELS[preference]}. Choose light, dark or system.`}
              title={`Colour theme: ${THEME_LABELS[preference]}`}
            >
              <CurrentIcon size={16} strokeWidth={2} aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" className="w-56 rounded-lg p-2">
            <p className="px-1.5 pb-1.5 text-nano font-semibold uppercase tracking-eyebrow text-ink-faint">
              Colour theme
            </p>
            <RadioGroup
              aria-label="Colour theme"
              value={preference}
              onValueChange={(value) => choose(value as ThemePreference)}
              orientation="vertical"
              className="gap-1"
            >
              {THEME_PREFERENCES.map((option) => {
                const Icon = ICONS[option];
                return (
                  <RadioGroupItem
                    key={option}
                    value={option}
                    variant="pill"
                    className="theme-toggle__menu-option"
                    aria-label={THEME_LABELS[option]}
                    title={THEME_DESCRIPTIONS[option]}
                    // A click closes the menu. Arrow keys move the choice
                    // without closing it, so browsing the three options with the
                    // keyboard is possible; Escape returns focus to the trigger.
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={14} strokeWidth={2} aria-hidden />
                    <span className="flex flex-col items-start">
                      <span className="font-medium">{THEME_LABELS[option]}</span>
                      <span className="text-nano font-normal text-ink-faint">{THEME_DESCRIPTIONS[option]}</span>
                    </span>
                  </RadioGroupItem>
                );
              })}
            </RadioGroup>
          </PopoverContent>
        </Popover>
      </div>

      <span className="sr-only" aria-live="polite">
        {`${THEME_LABELS[preference]} theme selected`}
      </span>
    </div>
  );
}
