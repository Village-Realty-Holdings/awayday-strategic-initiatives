"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Send } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { PeriodStatus } from "../_mock/types";
import { MockNote } from "./preview";
import { PeriodStatusBadge } from "./status";

/** Draft/Published badge plus a mock Publish button (editors only). Nothing persists. */
export function PublishBar({
  initialStatus,
  canEdit,
  editHref,
}: {
  initialStatus: PeriodStatus;
  canEdit: boolean;
  editHref?: string;
}) {
  const [status, setStatus] = useState<PeriodStatus>(initialStatus);
  const [touched, setTouched] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodStatusBadge status={status} />
      {canEdit && editHref && (
        <Button asChild variant="secondary" size="sm">
          <Link href={editHref}>
            <Pencil size={12} aria-hidden /> Edit
          </Link>
        </Button>
      )}
      {canEdit && (
        <Button
          size="sm"
          variant={status === "DRAFT" ? "default" : "outline"}
          onClick={() => {
            setStatus((s) => (s === "DRAFT" ? "PUBLISHED" : "DRAFT"));
            setTouched(true);
          }}
        >
          <Send size={12} aria-hidden />
          {status === "DRAFT" ? "Publish" : "Unpublish"}
        </Button>
      )}
      {canEdit && <MockNote>{touched ? "Mock — not saved, reload to reset" : "Mock — not saved"}</MockNote>}
    </div>
  );
}
