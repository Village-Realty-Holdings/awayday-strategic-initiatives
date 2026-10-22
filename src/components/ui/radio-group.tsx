"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// shadcn RadioGroup on the Awayday tokens. Arrow keys move the selection
// (roving focus); `name` posts the value with a surrounding <form>.
//  - variant "dot": classic radio circle, pair with a <Label>.
//  - variant "pill": the item itself is the visible choice (children are its
//    label), for segmented status pickers.

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />;
}

const radioItemVariants = cva("disabled:cursor-not-allowed disabled:opacity-50", {
  variants: {
    variant: {
      dot: "grid size-4 shrink-0 place-items-center rounded-full border border-border-strong bg-surface transition-colors hover:border-navy/60 data-[state=checked]:border-navy",
      pill: "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-navy/40 hover:text-ink data-[state=checked]:border-navy data-[state=checked]:bg-navy/10 data-[state=checked]:font-medium data-[state=checked]:text-navy-deep",
    },
  },
  defaultVariants: { variant: "dot" },
});

function RadioGroupItem({
  className,
  variant = "dot",
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & VariantProps<typeof radioItemVariants>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      data-variant={variant}
      className={cn(radioItemVariants({ variant }), className)}
      {...props}
    >
      {variant === "dot" ? (
        <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-navy" />
      ) : (
        children
      )}
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
