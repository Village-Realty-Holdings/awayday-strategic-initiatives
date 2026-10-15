import { Skeleton } from "@/components/ui/skeleton";

// Route-root fallback inside the app shell (the sidebar/header stay put). Shaped
// like the Overview: plan header, north-star band, then a grid of pillar cards.
// Routes with their own loading.tsx override this; the rest (risks, sources,
// admin...) get the same header + cards shape, which is close enough.
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8" role="status" aria-label="Loading">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>
      <Skeleton className="h-24 rounded-xl" />
      <section className="flex flex-col gap-3">
        <Skeleton className="h-4 w-44" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, n) => (
            <div key={n} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-5 w-48" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
