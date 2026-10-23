"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * The page header every app route shares. The title row pins to the top of
 * the content inset once you scroll past it and compacts, like the Strategy
 * Review's title. A 1px sentinel above the row scrolls out of the inset at
 * exactly the moment the row sticks.
 *
 * Renders a fragment on purpose: a sticky element only sticks within its
 * parent, so the title row must be a direct child of the page's own wrapper
 * (which spans the whole page), not of a short <header>.
 */
export function PageHeader({
  back,
  eyebrow,
  title,
  description,
  meta,
  badges,
  actions,
  stats,
  className,
}: {
  /** Where "Back" goes, e.g. { href: "/initiatives", label: "Initiatives" }. */
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: React.ReactNode;
  className?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    const root = document.querySelector<HTMLElement>(".app-inset");
    if (!el || !root) return;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { root });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {back && (
        <Link
          href={back.href}
          className={cn("mb-3 inline-flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink", className)}
        >
          <ChevronLeft size={14} aria-hidden /> Back to {back.label}
        </Link>
      )}
      <div ref={sentinel} aria-hidden className="h-px" />
      <div
        className={cn(
          "sticky top-0 z-20 -mx-6 px-6 transition-[padding,background-color,box-shadow] duration-200",
          stuck ? "border-b border-border bg-surface/95 py-2.5 shadow-[0_1px_8px_-4px_rgb(0_0_0/0.12)] backdrop-blur" : "py-0.5",
          className,
        )}
      >
        <div className={cn("flex flex-wrap justify-between gap-x-8 gap-y-3", stuck ? "items-center" : "items-end")}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* Once pinned, the back link rides along as an icon button; the
                text link above has scrolled away. */}
            {stuck && back && (
              <Link
                href={back.href}
                aria-label={`Back to ${back.label}`}
                title={`Back to ${back.label}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <ChevronLeft size={16} aria-hidden />
              </Link>
            )}
            <div className="grid min-w-0 gap-1">
              {eyebrow && (
                <p className={cn("truncate font-semibold uppercase tracking-[0.12em] text-ink-faint", stuck ? "text-[9px]" : "text-[10px]")}>
                  {eyebrow}
                </p>
              )}
              <h1
                className={cn(
                  "font-semibold tracking-tight text-ink transition-[font-size,line-height] duration-200",
                  stuck ? "truncate text-lg leading-6" : "text-2xl text-balance",
                )}
              >
                {title}
              </h1>
            </div>
          </div>
          {(actions || (stats && !stuck)) && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {!stuck && stats}
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          )}
        </div>
      </div>
      {(badges || description || meta) && (
        <div className={cn("mt-1.5 grid max-w-3xl gap-1.5", className)}>
          {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
          {description && <p className="text-sm leading-6 text-ink-muted">{description}</p>}
          {meta && <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">{meta}</div>}
        </div>
      )}
      <div aria-hidden className="mb-6" />
    </>
  );
}
