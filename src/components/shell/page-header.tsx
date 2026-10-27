import Link from "next/link";
import { ChevronLeft } from "@/components/icons";
import { Eyebrow } from "@/components/shell/eyebrow";
import { StickyPageHeader, type PageHeaderProps } from "@/components/shell/sticky-page-header";
import { cn } from "@/lib/utils";

// Every page in the app shell sits in the same frame: full width up to 1400px,
// left-aligned, like the Strategy Review. Forms keep a readable column inside it.
export const PAGE_FRAME = "mx-auto w-full max-w-page";
export const FORM_COLUMN = "w-full max-w-4xl";

export { Eyebrow };

/**
 * The page header every app route shares. Static by default; pass `sticky` on
 * long pages so the title row pins to the top of the content inset once you
 * scroll past it (that variant is a client component).
 */
export function PageHeader({ sticky = false, ...props }: PageHeaderProps & { sticky?: boolean }) {
  if (sticky) return <StickyPageHeader {...props} />;
  const { back, eyebrow, title, description, meta, badges, actions, stats, className } = props;
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {back && (
            <Link
              href={back.href}
              className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <ChevronLeft size={14} aria-hidden /> Back to {back.label}
            </Link>
          )}
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {badges && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{badges}</div>}
          {description && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>}
          {meta && <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">{meta}</div>}
        </div>
        {stats ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {stats}
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        ) : (
          actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}

/** A header figure: big tabular value over a faint label. */
export function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "risk" }) {
  return (
    <div className="text-right">
      <p className={`tabular text-lg font-semibold ${tone === "risk" ? "text-risk" : tone === "ok" ? "text-ok" : "text-ink"}`}>
        {value}
      </p>
      <p className="text-note text-ink-faint">{label}</p>
    </div>
  );
}
