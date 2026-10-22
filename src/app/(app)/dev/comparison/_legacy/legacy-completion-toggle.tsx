// SNAPSHOT of the milestone / action-item done toggle inlined in
// src/app/(app)/initiatives/[id]/page.tsx before the shadcn Button migration,
// kept only for /dev/comparison.
import { Check } from "@/components/icons";

export function LegacyCompletionToggle({ id, done, action }: { id: string; done: boolean; action: (fd: FormData) => void | Promise<void> }) {
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title={done ? "Reopen" : "Mark complete"}
        className={`cursor-default grid h-5 w-5 place-items-center rounded-full border transition-colors ${
          done ? "border-ok bg-ok/15 text-ok" : "border-border text-transparent hover:border-ok hover:text-ok/50"
        }`}
      >
        <Check size={12} strokeWidth={3} aria-hidden />
      </button>
    </form>
  );
}
