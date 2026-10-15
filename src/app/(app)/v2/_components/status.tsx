import { Badge } from "@/components/ui/badge";
import type { PeriodStatus, PillarTone, SiStatus, UpdateState } from "../_mock/types";

export const SI_STATUS_META: Record<SiStatus, { label: string; variant: "ok" | "default" | "warn" | "risk"; glyph: string }> = {
  AHEAD: { label: "Ahead", variant: "ok", glyph: "▲" },
  ON_TRACK: { label: "On track", variant: "default", glyph: "●" },
  AT_RISK: { label: "At risk", variant: "warn", glyph: "◆" },
  BEHIND: { label: "Behind", variant: "risk", glyph: "▼" },
};

export const SI_STATUS_ORDER: SiStatus[] = ["AHEAD", "ON_TRACK", "AT_RISK", "BEHIND"];

export function SiStatusBadge({ status }: { status: SiStatus | null }) {
  if (!status) {
    return <Badge variant="outline">TBD</Badge>;
  }
  const m = SI_STATUS_META[status];
  return (
    <Badge variant={m.variant}>
      <span aria-hidden className="text-[9px] leading-none">{m.glyph}</span>
      {m.label}
    </Badge>
  );
}

const UPDATE_META: Record<UpdateState, { label: string; variant: "ok" | "warn" | "outline" }> = {
  SUBMITTED: { label: "Submitted", variant: "ok" },
  DRAFT: { label: "Draft", variant: "warn" },
  NOT_SUBMITTED: { label: "Not submitted", variant: "outline" },
};

export function UpdateStateBadge({ state }: { state: UpdateState }) {
  const m = UPDATE_META[state];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export const TONE_VARIANT: Record<PillarTone, "ok" | "default" | "warn" | "risk"> = {
  ahead: "ok",
  on_track: "default",
  watch: "warn",
  behind: "risk",
};

export const TONE_OPTIONS: { tone: PillarTone; label: string }[] = [
  { tone: "ahead", label: "Ahead" },
  { tone: "on_track", label: "On track" },
  { tone: "watch", label: "Watch" },
  { tone: "behind", label: "Behind" },
];

export function PillarLabelBadge({ label, tone, className }: { label: string; tone: PillarTone; className?: string }) {
  return (
    <Badge variant={TONE_VARIANT[tone]} className={className}>
      {label}
    </Badge>
  );
}

export function PeriodStatusBadge({ status }: { status: PeriodStatus }) {
  return status === "PUBLISHED" ? <Badge variant="ok">Published</Badge> : <Badge variant="warn">Draft</Badge>;
}
