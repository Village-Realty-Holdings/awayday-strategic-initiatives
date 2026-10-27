import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_FRAME } from "@/components/shell/page-header";

// Initiative groups: header with the "New group" action, then group cards two-up.
export default function Loading() {
  return (
    <div className={PAGE_FRAME} role="status" aria-label="Loading groups">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-[36rem] max-w-full" />
        </div>
        <Skeleton className="h-8 w-28" />
      </header>
      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, n) => (
          <div key={n} className="grid gap-3 rounded-md border border-border bg-surface px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 6 }).map((_, k) => (
                <Skeleton key={k} className="h-5 w-32" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
