import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The theme defines custom font-size tokens (--text-meta, --text-note,
// --text-stat, --text-h1 in globals.css). Without this, tailwind-merge reads
// `text-meta` etc. as a colour and drops a real `text-ink` colour next to it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["meta", "note", "stat", "h1"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
