import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { PillarTone, ReviewPeriodStatus, SiReviewStatus } from "@/lib/review-model";

type SiStatus = SiReviewStatus;

export const SI_STATUS_META: Record<SiStatus, { label: string; variant: "ok" | "default" | "warn" | "risk"; glyph: string }> = {
  AHEAD: { label: "Ahead", variant: "ok", glyph: "▲" },
  ON_TRACK: { label: "On track", variant: "default", glyph: "●" },
  AT_RISK: { label: "At risk", variant: "warn", glyph: "◆" },
  BEHIND: { label: "Behind", variant: "risk", glyph: "▼" },
};

export const SI_STATUS_ORDER: SiStatus[] = ["AHEAD", "ON_TRACK", "AT_RISK", "BEHIND"];

export function SiStatusBadge({ status }: { status: SiStatus | null }) {
  if (!status) {
    return <Badge variant="outline">Status TBD</Badge>;
  }
  const m = SI_STATUS_META[status];
  return (
    <Badge variant={m.variant}>
      <span aria-hidden className="text-[9px] leading-none">{m.glyph}</span>
      {m.label}
    </Badge>
  );
}

/** Whether the SI lead has posted an update for the review month. */
export function UpdatedBadge({ updated }: { updated: boolean }) {
  return updated ? <Badge variant="ok">Updated</Badge> : <Badge variant="outline">No update yet</Badge>;
}

export const TONE_VARIANT: Record<PillarTone, "ok" | "default" | "warn" | "risk"> = {
  ahead: "ok",
  on_track: "default",
  watch: "warn",
  behind: "risk",
};

export function PillarLabelBadge({ label, tone, className }: { label: string; tone: PillarTone; className?: string }) {
  return (
    <Badge variant={TONE_VARIANT[tone]} className={className}>
      {label}
    </Badge>
  );
}

// Selected pill takes the status colour, so the choice reads at a glance.
const STATUS_PICKED: Record<"ok" | "default" | "warn" | "risk", string> = {
  ok: "data-[state=checked]:border-ok data-[state=checked]:bg-ok-soft data-[state=checked]:text-ok",
  default: "",
  warn: "data-[state=checked]:border-warn data-[state=checked]:bg-warn-soft data-[state=checked]:text-ink",
  risk: "data-[state=checked]:border-risk data-[state=checked]:bg-risk-soft data-[state=checked]:text-risk",
};

/** Segmented SI status picker (arrow keys move the choice). */
export function SiStatusPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: SiStatus | null;
  onChange: (s: SiStatus) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value ?? ""}
      onValueChange={(v) => onChange(v as SiStatus)}
      disabled={disabled}
      className="flex flex-wrap gap-2"
    >
      {SI_STATUS_ORDER.map((s) => (
        <RadioGroupItem key={s} value={s} variant="pill" className={STATUS_PICKED[SI_STATUS_META[s].variant]}>
          <span aria-hidden className="text-[9px]">{SI_STATUS_META[s].glyph}</span>
          {SI_STATUS_META[s].label}
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}

/** Whether Strategy has published the month's review. */
export function PeriodStatusBadge({ status }: { status: ReviewPeriodStatus }) {
  return status === "PUBLISHED" ? <Badge variant="ok">Published</Badge> : <Badge variant="outline">Draft</Badge>;
}
