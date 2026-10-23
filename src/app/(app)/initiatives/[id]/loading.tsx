import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_FRAME } from "@/components/shell/page-header";

// Initiative charter: header, then the main column of sections beside the summary rail.
export default function Loading() {
  return (
    <div className={PAGE_FRAME} role="status" aria-label="Loading initiative">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-96 max-w-full" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 lg:order-2">
          <div className="grid gap-5 rounded-md border border-border bg-surface p-4">
            {Array.from({ length: 4 }).map((_, n) => (
              <div key={n} className="grid gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:order-1">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, n) => (
              <div key={n} className="grid gap-2 rounded-md border border-border bg-surface p-4">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, n) => (
            <div key={n} className="grid gap-3 rounded-md border border-border bg-surface p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
