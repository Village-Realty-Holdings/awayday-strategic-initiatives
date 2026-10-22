import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_FRAME } from "@/components/shell/page-header";

// Reporting: header, the tab row, then the narrative pane beside its side card.
export default function Loading() {
  return (
    <div className={PAGE_FRAME} role="status" aria-label="Loading reporting">
      <header className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </header>
      <div className="mb-5 flex gap-4 border-b border-border pb-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-52 w-full" />
      </div>
    </div>
  );
}
