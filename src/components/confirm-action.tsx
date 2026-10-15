"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type ConfirmActionProps = {
  /** Dialog heading, e.g. "Delete milestone?". */
  title: string;
  /** Specific consequence, e.g. "Delete milestone “Kickoff”? This can't be undone." */
  description: React.ReactNode;
  /** Label of the confirming button. Defaults to "Delete". */
  confirmLabel?: string;
  /** Confirm button look. Defaults to the solid risk fill. */
  confirmVariant?: ButtonProps["variant"];
  /** The trigger button's content (an icon, or icon + text). */
  children: React.ReactNode;
  /** Trigger button props (variant, size, className, title, aria-label...). */
  triggerProps?: Omit<ButtonProps, "children" | "type" | "asChild" | "onClick">;
} & (
  | {
      /** Server action form mode: the dialog hosts `<form action>` with `fields` as hidden inputs. */
      action: (formData: FormData) => void | Promise<void>;
      fields?: Record<string, string>;
      onConfirm?: never;
    }
  | {
      /** Client mode: run a callback instead (for useTransition / busy-state flows). */
      onConfirm: () => void | Promise<void>;
      action?: never;
      fields?: never;
    }
);

/**
 * Replacement for `window.confirm()`: a trigger button that opens an
 * AlertDialog. In server-action mode the confirm button is a SubmitButton inside
 * a `<form action={action}>` rendered in the dialog, so server actions and their
 * FormData field names work unchanged, and the page that renders this can stay a
 * server component (this is the client leaf). The dialog stays open with a
 * spinner while the action runs and closes when it finishes (or the page
 * navigates away).
 */
export function ConfirmAction({
  title,
  description,
  confirmLabel = "Delete",
  confirmVariant = "danger",
  children,
  triggerProps,
  action,
  fields,
  onConfirm,
}: ConfirmActionProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" {...triggerProps}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {action ? (
          <form action={action}>
            {Object.entries(fields ?? {}).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <SubmitButton variant={confirmVariant}>{confirmLabel}</SubmitButton>
            </AlertDialogFooter>
            <CloseWhenDone onDone={() => setOpen(false)} />
          </form>
        ) : (
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant={confirmVariant}
              onClick={() => {
                setOpen(false);
                void onConfirm?.();
              }}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Closes the dialog once the form action settles (pending true -> false). When
// the action redirects, the whole tree swaps instead and this never fires.
function CloseWhenDone({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = React.useRef(false);
  React.useEffect(() => {
    if (pending) wasPending.current = true;
    else if (wasPending.current) {
      wasPending.current = false;
      onDone();
    }
  }, [pending, onDone]);
  return null;
}
