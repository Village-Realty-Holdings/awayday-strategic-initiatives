import type { SoWhat } from "@/lib/review-model";

/** Strategy's so-whats for one scope (the summary, or a pillar or enabler), as written on the editor. */
export function SoWhatList({ items, className }: { items: SoWhat[]; className?: string }) {
  return (
    <ol className={`flex flex-col gap-2.5 ${className ?? ""}`}>
      {items.map((s) => (
        <li key={s.id} className="border-l-2 border-gold-deep pl-3 text-sm leading-6 text-ink-muted">
          <span className="font-semibold text-ink">{s.headline}</span>
          {s.body && <span className="whitespace-pre-line"> {s.body}</span>}
        </li>
      ))}
    </ol>
  );
}
