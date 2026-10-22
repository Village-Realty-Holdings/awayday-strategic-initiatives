import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_FRAME } from "@/components/shell/page-header";

// Strategy Sources: header, slide figures on the left, summary cards on the right.
export default function Loading() {
  return (
    <div className={PAGE_FRAME} role="status" aria-label="Loading strategy sources">
      <header className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-[36rem] max-w-full" />
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid max-w-[900px] gap-5">
          {Array.from({ length: 2 }).map((_, n) => (
            <div key={n} className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="flex justify-between border-b border-border px-4 py-3">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-5 w-28" />
              </div>
              <Skeleton className="aspect-[900/506] w-full rounded-none" />
            </div>
          ))}
        </div>
        <div className="grid gap-5">
          {Array.from({ length: 3 }).map((_, n) => (
            <div key={n} className="grid gap-3 rounded-md border border-border bg-surface p-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
