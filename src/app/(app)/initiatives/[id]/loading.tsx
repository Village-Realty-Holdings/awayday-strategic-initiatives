import { Skeleton } from "@/components/ui/skeleton";

// Charter page: back link, navy header band, meta row, then charter blocks.
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl" role="status" aria-label="Loading initiative">
      <Skeleton className="mb-5 h-4 w-32" />
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="bg-navy/90 px-6 py-5 pb-14">
          <Skeleton className="h-3 w-24 bg-white/25" />
          <Skeleton className="mt-3 h-7 w-3/4 bg-white/25" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-6 w-24 bg-white/20" />
            <Skeleton className="h-6 w-28 bg-white/20" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-b border-border bg-surface-2/50 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, n) => (
            <div key={n} className="flex flex-col gap-2 px-5 py-3.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          {Array.from({ length: 2 }).map((_, n) => (
            <div key={n} className="flex flex-col gap-2.5 px-6 py-5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, n) => (
          <div key={n} className="flex flex-col gap-3 border-t border-border px-6 py-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
