import type { ReactNode } from "react";

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
