import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { fieldVariants } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TextareaProps = Omit<React.ComponentProps<"textarea">, "size"> & VariantProps<typeof fieldVariants>;

function Textarea({ className, size, ...props }: TextareaProps) {
  return <textarea data-slot="textarea" className={cn(fieldVariants({ size }), className)} {...props} />;
}

export { Textarea };
export type { TextareaProps };
