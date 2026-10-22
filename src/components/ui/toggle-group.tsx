"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// shadcn ToggleGroup on the Awayday tokens, for choices that look like
// buttons but behave like a selection (aria-pressed / radio semantics and
// arrow-key navigation come from Radix).
//  - variant "segmented": joined control in a hairline frame (view switches,
//    Value / Non-value). Use with type="single".
//  - variant "chip": separate rounded pills (filters, team tags, app access).

const toggleGroupVariants = cva("inline-flex flex-wrap items-center", {
  variants: {
    variant: {
      segmented: "gap-0.5 rounded-md border border-border bg-surface p-0.5",
      chip: "gap-1.5",
    },
  },
  defaultVariants: { variant: "segmented" },
});

const toggleItemVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[color,background-color,border-color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        segmented:
          "rounded text-ink-muted hover:bg-surface-2 hover:text-ink data-[state=on]:bg-navy data-[state=on]:text-white data-[state=on]:hover:bg-navy-deep",
        chip: "rounded-full border border-border bg-surface text-ink-muted hover:border-navy/40 hover:text-ink data-[state=on]:border-navy data-[state=on]:bg-navy/10 data-[state=on]:text-navy-deep",
      },
      size: {
        default: "px-3 py-1.5 text-sm",
        sm: "px-2.5 py-1 text-xs",
        xs: "px-2 py-0.5 text-[10px]",
      },
    },
    defaultVariants: { variant: "segmented", size: "sm" },
  },
);

type ItemVariants = VariantProps<typeof toggleItemVariants>;
const ToggleGroupContext = React.createContext<ItemVariants>({});

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & ItemVariants) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant ?? "segmented"}
      className={cn(toggleGroupVariants({ variant }), className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & ItemVariants) {
  const ctx = React.useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(toggleItemVariants({ variant: variant ?? ctx.variant, size: size ?? ctx.size }), className)}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
