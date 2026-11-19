import type { SoWhat } from "@/lib/review-model";

/**
 * Strategy's so-whats for one scope (the summary, or a pillar or enabler), in
 * the order they were written. Each item is a headline and an optional body of
 * plain text; the body keeps its paragraph breaks and is never rendered as HTML.
 */
export function SoWhatList({ items, className }: { items: SoWhat[]; className?: string }) {
  return (
    <ol className={`flex flex-col gap-3 ${className ?? ""}`}>
      {items.map((s) => (
        <li key={s.id} className="border-l-2 border-gold-deep pl-3">
          <p className="text-sm font-semibold leading-6 text-ink">{s.headline}</p>
          {s.body && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-muted">{s.body}</p>}
        </li>
      ))}
    </ol>
  );
}
