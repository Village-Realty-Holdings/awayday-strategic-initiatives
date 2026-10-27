import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_FRAME } from "@/components/shell/page-header";

// Initiatives list: header with three stats, a filter bar, and table rows.
export default function Loading() {
  return (
    <div className={PAGE_FRAME} role="status" aria-label="Loading initiatives">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-6">
          {Array.from({ length: 3 }).map((_, n) => (
            <div key={n} className="flex flex-col items-end gap-1.5">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
          <Skeleton className="h-8 w-32" />
        </div>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 5 }).map((_, n) => (
          <Skeleton key={n} className="h-8 w-32" />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-3 w-full max-w-md" />
        </div>
        {Array.from({ length: 10 }).map((_, n) => (
          <div key={n} className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-0">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-64 max-w-[40%]" />
            <Skeleton className="ml-auto hidden h-4 w-24 sm:block" />
            <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
            <Skeleton className="h-2 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
