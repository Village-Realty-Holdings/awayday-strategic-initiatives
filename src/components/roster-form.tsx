import Link from "next/link";
import type { RosterMember } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function RosterForm({
  action,
  member,
  departments,
  positions,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  member?: RosterMember;
  departments: string[];
  positions: string[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-5">
      {member && <input type="hidden" name="id" value={member.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <Input name="name" required defaultValue={member?.name} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={member?.email ?? ""} />
        </Field>
        <Field label="Position">
          <Input name="position" list="positions" defaultValue={member?.position ?? ""} />
          <datalist id="positions">{positions.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Department">
          <Input name="department" list="departments" defaultValue={member?.department ?? ""} />
          <datalist id="departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Button asChild variant="faint" size="bare" className="text-sm font-normal text-ink-muted">
          <Link href="/settings/people">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <Label className="flex flex-col gap-1.5">
      <span>
        {label}
        {required && <span className="text-risk"> *</span>}
      </span>
      {children}
    </Label>
  );
}
