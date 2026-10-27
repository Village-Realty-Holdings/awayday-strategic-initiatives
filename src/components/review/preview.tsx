import type { ReactNode } from "react";

export function ReviewHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-deep">{eyebrow}</p>
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

/** Dashed note for a section whose data isn't in the database yet. */
export function NoDataNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-xs text-ink-muted">{children}</p>;
}
