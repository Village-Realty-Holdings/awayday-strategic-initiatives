import { Skeleton } from "@/components/ui/skeleton";

// Initiatives list: header with three stats, a filter bar, and table rows.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px]" role="status" aria-label="Loading initiatives">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-6">
          {Array.from({ length: 3 }).map((_, n) => (
            <div key={n} className="flex flex-col items-end gap-1.5">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </header>
      <div className="mb-3 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
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
