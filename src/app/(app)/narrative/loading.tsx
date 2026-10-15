import { Skeleton } from "@/components/ui/skeleton";

// Board narrative: header, a generate bar, and a document-shaped body.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[860px]" role="status" aria-label="Loading board narrative">
      <header className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-5/6 max-w-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-xl" />
      </header>
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        {Array.from({ length: 4 }).map((_, n) => (
          <div key={n} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
