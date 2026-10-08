"use client";

import { Trash2 } from "lucide-react";
import { deleteInitiative } from "@/app/(app)/initiatives/actions";

export function DeleteInitiativeButton({ id, variant = "default" }: { id: string; variant?: "default" | "onDark" }) {
  const cls =
    variant === "onDark"
      ? "inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:border-risk hover:bg-risk"
      : "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-risk transition-colors hover:bg-risk-soft";
  return (
    <form
      action={deleteInitiative}
      onSubmit={(e) => {
        if (!confirm("Delete this initiative? This cannot be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={cls}>
        <Trash2 size={13} aria-hidden /> Delete
      </button>
    </form>
  );
}
