import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy/10 text-navy-deep",
        secondary: "bg-surface-2 text-ink-muted",
        outline: "border border-border text-ink-muted",
        ok: "bg-ok-soft text-ok",
        warn: "bg-warn-soft text-ink",
        risk: "bg-risk-soft text-risk",
        done: "bg-done-soft text-done",
        // Status fills supplied by the caller (e.g. DMAIC/quadrant meta maps).
        custom: "",
      },
      shape: {
        default: "",
        pill: "rounded-full text-note font-semibold",
      },
    },
    defaultVariants: { variant: "default", shape: "default" },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean };

function Badge({ className, variant, shape, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, shape }), className)} {...props} />;
}

export { Badge, badgeVariants };
export type { BadgeProps };
