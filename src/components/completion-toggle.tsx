"use client";

import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ring = "grid h-5 w-5 place-items-center rounded-full border transition-colors";
const on = "border-ok bg-ok/15 text-ok";

// Round done/reopen control for milestones and action items. Editable: a
// one-field form posting `id` to the toggle server action; while it runs the
// circle already shows the new state (the page re-renders when it lands).
// Read-only: the same circle as a static indicator.
export function CompletionToggle({
  id,
  done,
  label,
  action,
  editable,
}: {
  id: string;
  done: boolean;
  /** The item's title, used to name the button for screen readers. */
  label: string;
  action: (fd: FormData) => void | Promise<void>;
  editable: boolean;
}) {
  if (!editable) {
    return (
      <span className={cn(ring, "shrink-0", done ? on : "border-border text-transparent")} role="img" aria-label={done ? "Complete" : "Open"}>
        <Check size={12} strokeWidth={3} aria-hidden />
      </span>
    );
  }
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <ToggleButton done={done} label={label} />
    </form>
  );
}

function ToggleButton({ done, label }: { done: boolean; label: string }) {
  const { pending } = useFormStatus();
  const shown = pending ? !done : done;
  return (
    <Button
      type="submit"
      variant="faint"
      size="bare"
      disabled={pending}
      aria-label={done ? `Reopen “${label}”` : `Mark “${label}” complete`}
      title={done ? "Reopen" : "Mark complete"}
      className={cn(
        ring,
        "disabled:opacity-100",
        shown ? on : "border-border-strong text-transparent hover:border-ok hover:bg-ok/5 hover:text-ok/60",
        pending && "animate-pulse",
      )}
    >
      <Check size={12} strokeWidth={3} aria-hidden />
    </Button>
  );
}
