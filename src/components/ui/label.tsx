"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

// Default look is the app's small muted field caption. To wrap a control
// (<Label>caption <Input/></Label>), pass "flex flex-col gap-1.5" via className.
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("text-xs font-medium text-ink-muted peer-disabled:opacity-60", className)}
      {...props}
    />
  );
}

export { Label };
