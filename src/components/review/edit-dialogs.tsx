"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { editPlanHeader, editReviewDetails, editSiUpdate, editSoWhats, editStrategicArea, type EditResult } from "@/app/(app)/review-edit-actions";
import { fmtLong, type ReviewSi, type SiReviewStatus, type SoWhat } from "@/lib/review-model";
import { useCloseEditor } from "./edit-mode";
import { type EditorSoWhat, SoWhatEditor } from "./so-what-editor";
import { SiStatusPicker } from "./status";

/**
 * The dialog body every editor shares: header, a form that calls `action` and
 * closes on success or shows the error in place, and Cancel / Save.
 */
function EditForm({
  title,
  description,
  action,
  hidden,
  children,
}: {
  title: string;
  description?: ReactNode;
  action: (fd: FormData) => Promise<EditResult>;
  hidden: Record<string, string>;
  children: ReactNode;
}) {
  const close = useCloseEditor();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await action(fd);
        if (!result.ok) return setError(result.error);
        toast.success("Saved");
        close();
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-h-[min(820px,92vh)] min-h-0 flex-col">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <DialogHeader className="border-b border-border px-6 pb-4 pt-5">
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <fieldset disabled={pending} className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
        {children}
      </fieldset>
      <DialogFooter className="items-center border-t border-border bg-surface-2/50 px-6 py-3">
        {error && (
          <p role="alert" className="mr-auto text-xs text-risk">
            {error}
          </p>
        )}
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="sm">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending || undefined}>
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <Label className="flex flex-col gap-1.5">
      {label}
      {children}
      {hint && <span className="text-note font-normal text-ink-faint">{hint}</span>}
    </Label>
  );
}

export function PlanHeaderEditor({ planId, mission, goal, values }: { planId: string; mission: string | null; goal: string | null; values: string[] }) {
  return (
    <EditForm title="Edit strategy house" description="The roof and foundations of the house, shared by every month of this plan." action={editPlanHeader} hidden={{ planVersionId: planId }}>
      <Field label="Mission">
        <Input name="mission" defaultValue={mission ?? ""} maxLength={300} />
      </Field>
      <Field label="Goal">
        <Input name="goal" defaultValue={goal ?? ""} maxLength={300} />
      </Field>
      <Field label="Values" hint="One per line, up to 12.">
        <Textarea name="values" rows={4} defaultValue={values.join("\n")} />
      </Field>
    </EditForm>
  );
}

export function ReviewDetailsEditor({
  periodId,
  periodLabel,
  preparedBy,
  meetingDate,
  updatesDueDate,
  dataAsOf,
  observedAsOf,
}: {
  periodId: string;
  periodLabel: string;
  preparedBy: string | null;
  meetingDate: string | null;
  updatesDueDate: string | null;
  /** The stored data-as-of override, if any. */
  dataAsOf: string | null;
  observedAsOf: string | null;
}) {
  return (
    <EditForm title="Edit review details" description={`The header details for ${periodLabel}.`} action={editReviewDetails} hidden={{ periodId }}>
      <Field label="Prepared by">
        <Input name="preparedBy" defaultValue={preparedBy ?? ""} maxLength={120} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ELT meeting">
          <Input name="meetingDate" type="date" defaultValue={meetingDate ?? ""} />
        </Field>
        <Field label="SI updates due">
          <Input name="updatesDueDate" type="date" defaultValue={updatesDueDate ?? ""} />
        </Field>
      </div>
      <Field label="Data as of" hint={observedAsOf ? `Blank uses the KPI data: ${fmtLong(observedAsOf)}.` : "No KPI data loaded for this month."}>
        <Input name="dataAsOf" type="date" defaultValue={dataAsOf ?? ""} />
      </Field>
    </EditForm>
  );
}

export function SoWhatsEditor({ periodId, scope, scopeLabel, items }: { periodId: string; scope: string; scopeLabel: string; items: SoWhat[] }) {
  const [list, setList] = useState<EditorSoWhat[]>(() => items.map((s) => ({ key: s.id, headline: s.headline, body: s.body ?? "" })));
  const payload = JSON.stringify(list.map((s) => ({ scope, headline: s.headline, body: s.body })));
  return (
    <EditForm title={`Edit ${scopeLabel} so-whats`} description="What the ELT should take from this section. Blank rows are dropped." action={editSoWhats} hidden={{ periodId, scope, soWhats: payload }}>
      <SoWhatEditor scopeLabel={scopeLabel} items={list} onChange={setList} locked={false} />
    </EditForm>
  );
}

export function AreaEditor({ areaId, eyebrow, name, goal, owner }: { areaId: string; eyebrow: string; name: string; goal: string | null; owner: string | null }) {
  return (
    <EditForm title={`Edit ${name}`} description={`${eyebrow} of the active plan. The measure and target come from the KPI definitions.`} action={editStrategicArea} hidden={{ areaId }}>
      <Field label="Name">
        <Input name="name" defaultValue={name} maxLength={120} required />
      </Field>
      <Field label="Owner" hint="Blank shows the SI leads instead.">
        <Input name="owner" defaultValue={owner ?? ""} maxLength={200} />
      </Field>
      <Field label="Objective">
        <Textarea name="goal" rows={3} defaultValue={goal ?? ""} maxLength={1000} />
      </Field>
    </EditForm>
  );
}

export function SiUpdateEditor({ periodId, periodLabel, si }: { periodId: string; periodLabel: string; si: ReviewSi }) {
  const [status, setStatus] = useState<SiReviewStatus | null>(si.status);
  return (
    <EditForm
      title={`Edit ${si.shortCode} update`}
      description={
        <>
          {si.name} · {periodLabel}.{" "}
          {si.updatedBy ? `Last updated by ${si.updatedBy}. ` : ""}
          The charter, milestones and asks are edited on the{" "}
          <a href={`/initiatives/${si.id}`} className="text-navy hover:underline">
            full record
          </a>
          .
        </>
      }
      action={editSiUpdate}
      hidden={{ periodId, initiativeId: si.id, reviewStatus: status ?? "" }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Status</span>
        <SiStatusPicker label={`Status for ${si.name}`} value={status} onChange={setStatus} />
      </div>
      <Field label="Latest progress">
        <Textarea name="update" rows={4} defaultValue={si.latestProgress ?? ""} placeholder="What moved since last month?" />
      </Field>
      <Field label="What next">
        <Textarea name="pathForward" rows={3} defaultValue={si.whatNext ?? ""} placeholder="What happens before the next review?" />
      </Field>
    </EditForm>
  );
}
