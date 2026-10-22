"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

// shadcn Checkbox on the Awayday tokens: hairline box, navy fill when checked.
// Inside a <form>, pass `name` (and `value`) and Radix renders a hidden native
// input, so server actions read it from FormData exactly like a native
// checkbox (`value` defaults to "on"; repeated names give multi-values).
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer grid size-4 shrink-0 place-items-center rounded-sm border border-border-strong bg-surface text-white transition-colors hover:border-navy/60 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-risk data-[state=checked]:border-navy data-[state=checked]:bg-navy data-[state=indeterminate]:border-navy data-[state=indeterminate]:bg-navy",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-items-center">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} aria-hidden />
        ) : (
          <Check className="size-3" strokeWidth={3} aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
