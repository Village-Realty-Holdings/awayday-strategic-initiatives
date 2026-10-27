import { cn } from "@/lib/utils";

/** Small gold uppercase label above a page or section title. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-note font-semibold uppercase tracking-eyebrow text-gold-deep", className)}>{children}</p>;
}
