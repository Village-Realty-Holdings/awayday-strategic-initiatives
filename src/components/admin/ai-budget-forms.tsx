"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminSetAiBudget, adminSetAiBudgetRecipients } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Admin controls for the monthly AI budget and its alert recipients
// (/admin/ai-telemetry). Same shape as the onboarding digest-recipients form:
// a single input, a save button, a toast with the result, refresh on success.

type Result = { ok: true; message: string } | { ok: false; error: string };

function useSave(action: (fd: FormData) => Promise<Result>, field: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const save = (value: string) =>
    startTransition(async () => {
      const fd = new FormData();
      fd.set(field, value);
      const res = await action(fd);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  return { save, pending };
}

export function AiBudgetForm({ initial, effectivePlaceholder }: { initial: string; effectivePlaceholder: string }) {
  const [value, setValue] = useState(initial);
  const { save, pending } = useSave(adminSetAiBudget, "budget");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <Label htmlFor="ai-budget" className="block text-ink">
        Monthly budget (USD)
      </Label>
      <div className="mt-1.5 flex items-start gap-2">
        <Input
          id="ai-budget"
          name="budget"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={effectivePlaceholder}
          className="w-full max-w-[200px] placeholder:text-ink-faint"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending} className="bg-surface py-2 hover:text-ink">
          {pending ? "Saving" : "Save budget"}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        Enter 0 or off to remove the cap. Leave blank to use the environment value or the default.
      </p>
    </form>
  );
}

export function AiBudgetRecipientsForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const { save, pending } = useSave(adminSetAiBudgetRecipients, "recipients");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <Label htmlFor="ai-budget-recipients" className="block text-ink">
        Alert recipients
      </Label>
      <div className="mt-1.5 flex items-start gap-2">
        <Input
          id="ai-budget-recipients"
          name="recipients"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="name@company.com, other@company.com"
          className="w-full max-w-[520px] placeholder:text-ink-faint"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending} className="bg-surface py-2 hover:text-ink">
          {pending ? "Saving" : "Save recipients"}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        Emailed once at 80% and once at 100% of the budget each month. Comma-separated.
      </p>
    </form>
  );
}
