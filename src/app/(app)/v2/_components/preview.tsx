import type { ReactNode } from "react";
import { FlaskConical } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { V2Tabs } from "./v2-tabs";

export function PreviewBadge() {
  return (
    <Badge variant="custom" className="gap-1.5 border border-gold/60 bg-gold/15 text-navy-deep">
      <FlaskConical size={12} strokeWidth={2} aria-hidden />
      V2 preview · mock data
    </Badge>
  );
}

/** Inline reminder that a form does not persist anything. */
export function MockNote({ children = "Mock — not saved" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong px-2 py-1 text-[11px] text-ink-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
      {children}
    </span>
  );
}

export function V2Header({
  eyebrow,
  title,
  description,
  actions,
  tabs = true,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: boolean;
}) {
  return (
    <header className="flex flex-col gap-4">
      {tabs && <V2Tabs />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-deep">{eyebrow}</p>
            <PreviewBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ id, children, aside }: { id?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 id={id} className="scroll-mt-20 text-sm font-semibold text-ink">
        {children}
      </h2>
      {aside && <div className="text-xs text-ink-muted">{aside}</div>}
    </div>
  );
}
