import Image from "next/image";
import Link from "next/link";
import { Compass } from "@/components/icons";

export const metadata = { title: "Page not found — Awayday" };

// Root 404 for unknown URLs and notFound() calls (e.g. a missing initiative).
// Renders inside the root layout only, so it works signed in or out.
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="w-full max-w-sm text-center">
        <Image src="/awayday-logo.png" alt="Awayday" width={475} height={101} className="mx-auto h-6 w-auto" priority />
        <span className="mx-auto mt-8 grid h-11 w-11 place-items-center rounded-xl bg-navy/10 text-navy-deep">
          <Compass size={20} aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink">Page not found</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          This page doesn&apos;t exist or has moved. Check the address, or go back to Strategic Initiatives.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-deep"
        >
          Go to Strategic Initiatives
        </Link>
      </div>
    </main>
  );
}
