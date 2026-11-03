import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { InitiativeStatus } from "@/generated/prisma/client";
import { STATUS_META, STATUS_ORDER } from "@/lib/initiatives";
import type { PillarTone, ReviewPeriodStatus } from "@/lib/review-model";

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
const STATUS_PICKED: Record<InitiativeStatus, string> = {
  COMPLETE: "data-[state=checked]:border-done data-[state=checked]:bg-done-soft data-[state=checked]:text-done",
  ON_TRACK: "data-[state=checked]:border-ok data-[state=checked]:bg-ok-soft data-[state=checked]:text-ok",
  AT_RISK: "data-[state=checked]:border-warn data-[state=checked]:bg-warn-soft data-[state=checked]:text-ink",
  OFF_TRACK: "data-[state=checked]:border-risk data-[state=checked]:bg-risk-soft data-[state=checked]:text-risk",
};

/** Segmented SI status picker (arrow keys move the choice). */
export function SiStatusPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: InitiativeStatus | null;
  onChange: (s: InitiativeStatus) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value ?? ""}
      onValueChange={(v) => onChange(v as InitiativeStatus)}
      disabled={disabled}
      className="flex flex-wrap gap-2"
    >
      {STATUS_ORDER.map((s) => (
        <RadioGroupItem key={s} value={s} variant="pill" className={STATUS_PICKED[s]}>
          <span aria-hidden className="text-nano">{STATUS_META[s].glyph}</span>
          {STATUS_META[s].label}
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}

/** Whether Strategy has published the month's review. */
export function PeriodStatusBadge({ status }: { status: ReviewPeriodStatus }) {
  return status === "PUBLISHED" ? <Badge variant="ok">Published</Badge> : <Badge variant="outline">Draft</Badge>;
}
