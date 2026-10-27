"use client";

import { createContext, useContext, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { Check, Lock, Pencil } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Edit Mode on the Strategy Review. Admins and editors turn it on from the
// header; every <Editable> section is then outlined, and clicking one opens
// its editor in a dialog instead of following the section's own links.

type EditMode = { editing: boolean; setEditing: (on: boolean) => void; locked: boolean };

const EditModeContext = createContext<EditMode>({ editing: false, setEditing: () => {}, locked: false });
const CloseEditorContext = createContext<() => void>(() => {});

export const useEditMode = () => useContext(EditModeContext);
/** Closes the dialog the current editor is in. */
export const useCloseEditor = () => useContext(CloseEditorContext);

export function EditModeProvider({ locked, children }: { locked: boolean; children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape inside an open dialog closes the dialog, not Edit Mode.
      if (e.key === "Escape" && !document.querySelector("[data-slot=dialog-content]")) setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);
  return <EditModeContext.Provider value={{ editing, setEditing, locked }}>{children}</EditModeContext.Provider>;
}

export function EditModeToggle() {
  const { editing, setEditing } = useEditMode();
  return (
    <Button type="button" variant={editing ? "default" : "secondary"} size="sm" aria-pressed={editing} onClick={() => setEditing(!editing)}>
      {editing ? <Check size={12} aria-hidden /> : <Pencil size={12} aria-hidden />} {editing ? "Done editing" : "Edit review"}
    </Button>
  );
}

/** Bottom bar while Edit Mode is on; admins also get the full editor, where months are published. */
export function EditModeBar({ periodId, periodLabel, canPublish }: { periodId: string; periodLabel: string; canPublish: boolean }) {
  const { editing, setEditing, locked } = useEditMode();
  if (!editing) return null;
  return (
    <>
      <div aria-hidden className="h-16" />
      <div
        role="region"
        aria-label="Edit mode"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            <span className="font-semibold text-ink">Edit mode.</span>{" "}
            {locked
              ? `${periodLabel} is published, so its so-whats, details and SI updates are locked. The plan and pillars can still be edited.`
              : "Click an outlined section to edit it. Measures and financials come from the data loads and can't be edited here."}
          </p>
          <div className="flex items-center gap-2">
            {canPublish && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/review/${periodId}/edit`}>{locked ? "Unpublish…" : "Publish…"}</Link>
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => setEditing(false)}>
              <Check size={12} aria-hidden /> Done editing
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Renders its children only while Edit Mode is on. */
export function EditOnly({ children }: { children: ReactNode }) {
  return useEditMode().editing ? <>{children}</> : null;
}

/**
 * A section of the review that opens `editor` in a dialog when clicked in Edit
 * Mode. `periodLocked` sections (the month's own content) can't be opened
 * once the month is published. Nested sections take their own clicks.
 */
export function Editable({
  label,
  editor,
  periodLocked = false,
  wide = false,
  className,
  children,
}: {
  label: string;
  editor: ReactNode;
  periodLocked?: boolean;
  /** A wider dialog, for the so-what lists. */
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { editing, locked } = useEditMode();
  const [open, setOpen] = useState(false);
  const blocked = periodLocked && locked;

  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    // Clicks from a nested section, or from a dialog portalled out of this
    // one, belong to them.
    if ((e.target as Element).closest("[data-editable]") !== e.currentTarget) return;
    e.preventDefault();
    e.stopPropagation();
    if (!blocked) setOpen(true);
  }

  return (
    <div
      data-editable=""
      className={cn("relative", editing && "edit-target", editing && blocked && "edit-target--locked", className)}
      onClickCapture={editing ? onClickCapture : undefined}
    >
      {children}
      {editing && (
        <button
          type="button"
          disabled={blocked}
          aria-label={blocked ? `${label} is locked` : `Edit ${label}`}
          className="edit-target__chip absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-md border border-navy/30 bg-surface px-2 py-1 text-note font-medium text-navy shadow-sm disabled:border-border disabled:text-ink-faint"
        >
          {blocked ? <Lock size={11} aria-hidden /> : <Pencil size={11} aria-hidden />}
          {blocked ? "Locked" : "Edit"}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={cn("max-h-[min(820px,92vh)] gap-0 overflow-hidden p-0", wide ? "sm:max-w-3xl" : "sm:max-w-xl")}>
          <CloseEditorContext.Provider value={() => setOpen(false)}>{editor}</CloseEditorContext.Provider>
        </DialogContent>
      </Dialog>
    </div>
  );
}
