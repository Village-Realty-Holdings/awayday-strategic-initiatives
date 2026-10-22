import { ConfirmAction } from "@/components/confirm-action";
import { Plus, Trash2, type AppIcon } from "@/components/icons";

/**
 * One section of an initiative charter: icon heading with a count, the items,
 * an empty line when there are none, and the add form tucked behind a native
 * <details> disclosure. <details> needs no client JS, so the plain
 * <form action> server actions inside keep working, and it stays open after a
 * submit so several items can be added in a row.
 */
export function DetailSection({
  icon: Icon,
  title,
  count,
  isEmpty,
  emptyText,
  addLabel,
  addForm,
  action,
  children,
}: {
  icon: AppIcon;
  title: string;
  /** Short summary after the title, e.g. "2/3 complete". */
  count?: React.ReactNode;
  isEmpty: boolean;
  emptyText: string;
  /** Disclosure label, e.g. "Add milestone". Omit (with addForm) for read-only viewers. */
  addLabel?: string;
  addForm?: React.ReactNode;
  /** A control at the right of the heading (e.g. an AI assist button). */
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-surface px-4 py-4 sm:px-5">
      <header className="flex items-center gap-2.5">
        <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-navy/10 text-navy-deep">
          <Icon size={14} />
        </span>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {count && <span className="tabular text-xs text-ink-faint">{count}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className="mt-3">
        {isEmpty ? <p className="text-sm text-ink-faint">{emptyText}</p> : children}
      </div>
      {addForm && addLabel && (
        <details className="group mt-3 border-t border-dashed border-border pt-3 [&[open]>summary]:text-ink">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-navy hover:text-navy-deep [&::-webkit-details-marker]:hidden">
            <Plus size={13} aria-hidden className="transition-transform group-open:rotate-45" />
            {addLabel}
          </summary>
          <div className="mt-3">{addForm}</div>
        </details>
      )}
    </section>
  );
}

/** Divided list used inside a DetailSection. */
export function DetailList({ children }: { children: React.ReactNode }) {
  return <ul className="-my-1 divide-y divide-border">{children}</ul>;
}

/** The quiet trash-can trigger + confirm dialog every charter item uses. */
export function RemoveButton({
  action,
  id,
  title,
  description,
  confirmLabel = "Remove",
  label = "Remove",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  title: string;
  description: string;
  confirmLabel?: string;
  label?: string;
}) {
  return (
    <ConfirmAction
      action={action}
      fields={{ id }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      triggerProps={{ variant: "faint", size: "bare", title: label, "aria-label": label, className: "p-1 hover:text-risk" }}
    >
      <Trash2 size={13} aria-hidden />
    </ConfirmAction>
  );
}
