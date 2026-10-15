import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { fieldVariants } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & VariantProps<typeof fieldVariants>;

/** A native <select> styled to match Input (deliberately not Radix Select). */
function NativeSelect({ className, size, ...props }: NativeSelectProps) {
  return <select data-slot="native-select" className={cn(fieldVariants({ size }), className)} {...props} />;
}

export { NativeSelect };
export type { NativeSelectProps };
