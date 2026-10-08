"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSetAiBudget, adminSetAiBudgetRecipients } from "@/app/(app)/admin/actions";

// Admin controls for the monthly AI budget and its alert recipients
// (/admin/ai-telemetry). Same shape as the onboarding digest-recipients form:
// a single input, a save button, an inline status line, refresh on success.

type Result = { ok: true; message: string } | { ok: false; error: string };

function useSave(action: (fd: FormData) => Promise<Result>, field: string) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (value: string) =>
    startTransition(async () => {
      const fd = new FormData();
      fd.set(field, value);
      const res = await action(fd);
      setNotice({ text: res.ok ? res.message : res.error, ok: res.ok });
      if (res.ok) router.refresh();
    });
  return { save, notice, pending };
}

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-navy focus:outline-none";
const buttonClass =
  "shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-60";

function Notice({ notice }: { notice: { text: string; ok: boolean } | null }) {
  if (!notice) return null;
  return (
    <p role="status" className={`mt-2 rounded-md px-3 py-2 text-xs font-medium ${notice.ok ? "bg-ok-soft text-ok" : "bg-risk-soft text-risk"}`}>
      {notice.text}
    </p>
  );
}

export function AiBudgetForm({ initial, effectivePlaceholder }: { initial: string; effectivePlaceholder: string }) {
  const [value, setValue] = useState(initial);
  const { save, notice, pending } = useSave(adminSetAiBudget, "budget");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <label htmlFor="ai-budget" className="block text-xs font-medium text-ink">
        Monthly budget (USD)
      </label>
      <div className="mt-1.5 flex items-start gap-2">
        <input
          id="ai-budget"
          name="budget"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={effectivePlaceholder}
          className={inputClass + " max-w-[200px]"}
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving" : "Save budget"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        Enter 0 or off to remove the cap. Leave blank to use the environment value or the default.
      </p>
      <Notice notice={notice} />
    </form>
  );
}

export function AiBudgetRecipientsForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const { save, notice, pending } = useSave(adminSetAiBudgetRecipients, "recipients");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <label htmlFor="ai-budget-recipients" className="block text-xs font-medium text-ink">
        Alert recipients
      </label>
      <div className="mt-1.5 flex items-start gap-2">
        <input
          id="ai-budget-recipients"
          name="recipients"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="name@company.com, other@company.com"
          className={inputClass + " max-w-[520px]"}
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving" : "Save recipients"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        Emailed once at 80% and once at 100% of the budget each month. Comma-separated.
      </p>
      <Notice notice={notice} />
    </form>
  );
}
