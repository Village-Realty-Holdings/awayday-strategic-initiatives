import { Skeleton } from "@/components/ui/skeleton";

// Owner scorecard: header and an 8-column table.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px]" role="status" aria-label="Loading scorecard">
      <header className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-xl" />
      </header>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Skeleton className="h-3 w-24" />
          {Array.from({ length: 7 }).map((_, n) => (
            <Skeleton key={n} className="ml-auto h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 9 }).map((_, n) => (
          <div key={n} className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            {Array.from({ length: 7 }).map((_, k) => (
              <Skeleton key={k} className="ml-auto h-4 w-12" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
