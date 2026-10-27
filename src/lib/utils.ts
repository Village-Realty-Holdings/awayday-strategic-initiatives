import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The theme defines custom font-size, tracking and width tokens (globals.css).
// Without this, tailwind-merge reads `text-note` etc. as a colour and drops a
// real `text-ink` colour next to it, and can't dedupe the others.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta", "note", "micro", "nano", "stat", "h1"] }],
      tracking: [{ tracking: ["eyebrow"] }],
      "max-w": [{ "max-w": ["page", "section", "review", "narrow"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
