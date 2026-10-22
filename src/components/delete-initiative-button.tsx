"use client";

import { Trash2 } from "@/components/icons";
import { deleteInitiative } from "@/app/(app)/initiatives/actions";
import { ConfirmAction } from "@/components/confirm-action";

export function DeleteInitiativeButton({
  id,
  name,
  variant = "default",
}: {
  id: string;
  /** Shown in the confirmation copy when known. */
  name?: string;
  variant?: "default" | "onDark";
}) {
  return (
    <ConfirmAction
      action={deleteInitiative}
      fields={{ id }}
      title="Delete initiative?"
      description={`Delete ${name ? `initiative “${name}”` : "this initiative"}? This can't be undone.`}
      confirmLabel="Delete initiative"
      triggerProps={
        variant === "onDark"
          ? { variant: "onDark", size: "sm", className: "px-2.5 hover:border-risk hover:bg-risk" }
          : { variant: "destructive", size: "sm", className: "px-2.5" }
      }
    >
      <Trash2 size={13} aria-hidden /> Delete
    </ConfirmAction>
  );
}
