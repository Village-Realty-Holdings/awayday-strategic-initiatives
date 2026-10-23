import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { personName } from "../_mock/data";
import { fmtDay, milestonesBySi, siShortCode, snapshotFor } from "../_mock/selectors";
import type { MockSi } from "../_mock/types";
import { SiStatusBadge, UpdateStateBadge } from "./status";

export function SiCard({ si, periodId }: { si: MockSi; periodId: string }) {
  const snap = snapshotFor(si.code, periodId);
  const nextMs = milestonesBySi(si.code).find((m) => !m.done);
  return (
    <Link
      href={`/v2/si/${si.code}`}
      className="group flex flex-col gap-2 rounded-lg border border-border/70 bg-surface-2/30 px-3 py-3 transition-colors hover:border-navy/40 hover:bg-surface-2/60"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-medium text-ink group-hover:text-navy-deep">
          <span className="tabular mr-2 text-[10px] text-ink-faint">{siShortCode(si.code)}</span>
          {si.name}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <SiStatusBadge status={snap.status} />
          {snap.state !== "SUBMITTED" && <UpdateStateBadge state={snap.state} />}
        </span>
      </div>
      <p className="text-xs text-ink-faint">Lead: {personName(si.ownerId)}</p>
      <dl className="grid gap-1.5 text-xs">
        <div>
          <dt className="font-semibold text-ink">Latest progress</dt>
          <dd className="text-ink-muted">{snap.latestProgress ?? "TBD"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">What next</dt>
          <dd className="text-ink-muted">{snap.whatNext ?? "TBD"}</dd>
        </div>
        {nextMs && (
          <div>
            <dt className="font-semibold text-ink">Next milestone</dt>
            <dd className="text-ink-muted">
              {nextMs.title} ({fmtDay(nextMs.date)})
            </dd>
          </div>
        )}
      </dl>
      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[11px] font-medium text-navy">
        Open charter <ArrowRight size={12} aria-hidden />
      </span>
    </Link>
  );
}
