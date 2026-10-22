// Every page in the app shell sits in the same frame: full width up to 1400px,
// left-aligned, like the Strategy Review. Forms keep a readable column inside it.
export const PAGE_FRAME = "mx-auto w-full max-w-[1400px]";
export const FORM_COLUMN = "w-full max-w-4xl";

// The header itself is a client component (it pins on scroll); it's
// re-exported here so pages import the frame, header and Stat from one place.
export { PageHeader } from "@/components/shell/sticky-page-header";

/** A header figure: big tabular value over a faint label. */
export function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "risk" }) {
  return (
    <div className="text-right">
      <p className={`tabular text-lg font-semibold ${tone === "risk" ? "text-risk" : tone === "ok" ? "text-ok" : "text-ink"}`}>
        {value}
      </p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}
