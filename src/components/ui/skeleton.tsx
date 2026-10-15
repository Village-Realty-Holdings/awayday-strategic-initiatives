import { cn } from "@/lib/utils";

// shadcn Skeleton on the Awayday tokens: a pulsing hairline-toned block.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-border/70", className)} {...props} />;
}

export { Skeleton };
