"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "@/components/icons";

import { Button } from "@/components/ui/button";

// Error boundary for everything inside the app shell (the sidebar stays). Uses
// `retry()` (re-fetches and re-renders the segment), per this Next version.
// Plain messaging only: the error itself is logged to the console, and the
// digest lets someone match it to the server log.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center" role="alert">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-risk-soft text-risk">
        <TriangleAlert size={20} aria-hidden />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mt-1 text-sm text-ink-muted">
          This page couldn&apos;t be loaded. Your data is safe. Try again, and if it keeps happening, let the team know.
        </p>
        {error.digest && <p className="mt-2 text-note text-ink-faint">Reference: {error.digest}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to overview</Link>
        </Button>
      </div>
    </div>
  );
}
