import { Skeleton } from "@/components/ui/skeleton";

// Initiative groups: header, "New group" button, a stack of group cards.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1000px]" role="status" aria-label="Loading groups">
      <header className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>
      <Skeleton className="mb-5 h-9 w-32" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, n) => (
          <div key={n} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-64 max-w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from({ length: 5 }).map((_, k) => (
                <Skeleton key={k} className="h-5 w-28" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
