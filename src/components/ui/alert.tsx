import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Inline page banner for form errors and conflicts: a leading icon and the
// message. Always carries text, so colour is never the only signal.
const alertVariants = cva(
  "flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-sm text-ink [&>svg]:mt-0.5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        risk: "border-risk/40 bg-risk-soft [&>svg]:text-risk",
        warn: "border-warn/40 bg-warn-soft [&>svg]:text-warn",
        info: "border-navy/20 bg-navy/5 [&>svg]:text-navy",
      },
    },
    defaultVariants: { variant: "risk" },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
