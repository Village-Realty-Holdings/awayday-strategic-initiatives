import type { SoWhat } from "@/lib/review-model";
import type { KpiStatus } from "@/lib/kpi-status";

/**
 * Strategy's so-whats for one scope (the summary, or a pillar or enabler), in
 * the order they were written.
 *
 * Presentation follows the reviewed report: a bold lead statement, then the
 * supporting text, with a tone marker that says whether the item is good news,
 * bad news or a watch item. Every tone also carries a visually-hidden word, so
 * the meaning never depends on colour.
 *
 * Tone resolution, in order: the item's own `tone` (the field a reviewed or
 * Claude-drafted item will carry), then the section's `tone`, then neutral. No
 * tone is ever inferred from the wording: guessing whether a sentence is good
 * news is exactly the judgement that must stay with a human.
 */
export function SoWhatList({
  items,
  tone,
  className,
}: {
  items: readonly SoWhatItem[];
  /** Section-level fallback tone, e.g. the pillar's own status. */
  tone?: SoWhatTone;
  className?: string;
}) {
  return (
    <ul className={`flex flex-col gap-3 ${className ?? ""}`}>
      {items.map((s) => {
        const resolved = s.tone ?? tone ?? "neutral";
        return (
          <li
            key={s.id}
            className={`border-l-2 pl-3 ${TONE_STYLE[resolved].border}`}
            data-so-what-tone={resolved}
          >
            <p className="text-sm leading-6 text-ink">
              <span aria-hidden className={`mr-1.5 text-nano leading-none ${TONE_STYLE[resolved].dot}`}>
                {TONE_STYLE[resolved].glyph}
              </span>
              <span className="sr-only">{TONE_STYLE[resolved].spoken}: </span>
              <strong className="font-semibold">{s.headline}</strong>
            </p>
            {s.body && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-muted">{s.body}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export type SoWhatTone = "positive" | "negative" | "warning" | "neutral";

export type SoWhatItem = SoWhat & { tone?: SoWhatTone };

const TONE_STYLE: Record<SoWhatTone, { border: string; dot: string; glyph: string; spoken: string }> = {
  positive: { border: "border-ok", dot: "text-ok", glyph: "▲", spoken: "Positive" },
  negative: { border: "border-risk", dot: "text-risk", glyph: "▼", spoken: "Negative" },
  warning: { border: "border-warn", dot: "text-warn", glyph: "◆", spoken: "Watch" },
  neutral: { border: "border-gold-deep", dot: "text-ink-faint", glyph: "•", spoken: "Note" },
};

/** A section's status as the fallback tone for its so-whats. */
export function toneForStatus(status: KpiStatus | null | undefined): SoWhatTone {
  switch (status) {
    case "ahead":
    case "on_goal":
    case "on_track":
      return "positive";
    case "behind":
    case "floor_breached":
      return "negative";
    case "under_budget":
    case "needs_attention":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * The shared tone of several sections' statuses: only used when they agree, so a
 * mixed month is never painted as one verdict.
 */
export function toneForStatuses(statuses: readonly KpiStatus[]): SoWhatTone {
  const tones = new Set(statuses.map((status) => toneForStatus(status)));
  if (tones.size !== 1) return "neutral";
  return tones.values().next().value ?? "neutral";
}
