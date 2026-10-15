import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Look-matched to the app's existing hand-rolled buttons (rounded-md, navy
// fill, hairline-border secondary). Keyboard focus comes from the global
// :focus-visible rule in globals.css (navy outline), so no ring classes here.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy text-white hover:bg-navy-deep",
        // Hairline-border button, muted text (the common "secondary action").
        outline: "border border-border text-ink-muted hover:bg-surface-2",
        // Same, but with full-strength ink text.
        secondary: "border border-border text-ink hover:bg-surface-2",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
        // Quiet faint-ink control (icon-only remove/edit affordances).
        faint: "text-ink-faint hover:text-ink",
        // Destructive keeps the app's outlined-risk look; hover fills soft red.
        destructive: "border border-border text-risk hover:bg-risk-soft",
        // Solid risk fill: the confirm button inside destructive dialogs.
        danger: "bg-risk text-white hover:bg-risk/90",
        link: "text-navy hover:underline",
        // Gold-tinted pill used for AI "draft/assist" actions.
        accent: "rounded-full border border-gold/60 bg-gold/10 text-navy-deep hover:bg-gold/20",
        // Translucent button for use on navy/dark hero bands.
        onDark: "border border-white/25 bg-white/10 text-white hover:bg-white/20",
      },
      size: {
        default: "px-4 py-2 text-sm",
        sm: "px-3 py-1.5 text-xs",
        xs: "px-2 py-1 text-[11px]",
        icon: "h-9 w-9 text-sm",
        // No padding or size: for bare icon/text affordances.
        bare: "p-0",
      },
    },
    compoundVariants: [
      // Links are inline text, not boxes.
      { variant: "link", size: "default", className: "p-0" },
      { variant: "link", size: "sm", className: "p-0" },
      { variant: "link", size: "xs", className: "p-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the single child element (e.g. next/link) with button styles. */
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
