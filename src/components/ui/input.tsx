import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Shared field chrome for Input, Textarea and NativeSelect so all three stay
// visually identical. Focus = navy border plus a soft navy ring (the global
// gold-free focus outline is suppressed here to avoid doubling up).
const fieldVariants = cva(
  "border border-border bg-surface text-ink outline-none transition-colors focus-visible:border-navy focus-visible:ring-2 focus-visible:ring-navy/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-risk",
  {
    variants: {
      size: {
        default: "rounded-md px-3 py-2 text-sm",
        sm: "rounded-md px-3 py-1.5 text-sm",
        xs: "rounded-md px-2 py-1 text-xs",
        // Dense inline-edit table cell.
        cell: "w-full rounded border-border/70 px-1.5 py-1 text-xs",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type InputProps = Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof fieldVariants>;

function Input({ className, size, type, ...props }: InputProps) {
  return <input type={type} data-slot="input" className={cn(fieldVariants({ size }), className)} {...props} />;
}

export { Input, fieldVariants };
export type { InputProps };
