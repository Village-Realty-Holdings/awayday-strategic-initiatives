import { Skeleton } from "@/components/ui/skeleton";

// Timeline: header, filter bar, then bars staggered across a time axis.
const BARS = [
  ["8%", "38%"], ["20%", "30%"], ["5%", "52%"], ["32%", "26%"], ["14%", "44%"], ["40%", "34%"],
  ["10%", "28%"], ["26%", "40%"], ["3%", "36%"], ["34%", "30%"], ["18%", "46%"], ["28%", "24%"],
];

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px]" role="status" aria-label="Loading timeline">
      <header className="mb-5 flex flex-col gap-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-[34rem] max-w-full" />
      </header>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex border-b border-border">
          <div className="w-56 shrink-0 border-r border-border px-4 py-3">
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="grid flex-1 grid-cols-4 gap-6 px-4 py-3">
            {Array.from({ length: 4 }).map((_, n) => (
              <Skeleton key={n} className="h-3 w-12" />
            ))}
          </div>
        </div>
        {BARS.map(([left, width], n) => (
          <div key={n} className="flex items-center border-b border-border/60 last:border-0">
            <div className="flex w-56 shrink-0 flex-col gap-1.5 border-r border-border px-4 py-3">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="relative h-10 flex-1">
              <Skeleton className="absolute top-3 h-4 rounded-full" style={{ left, width }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
