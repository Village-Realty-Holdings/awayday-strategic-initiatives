import Link from "next/link";
import type { RosterMember } from "@/generated/prisma/client";

const input =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-navy";

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
          <input name="name" required defaultValue={member?.name} className={input} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={member?.email ?? ""} className={input} />
        </Field>
        <Field label="Position">
          <input name="position" list="positions" defaultValue={member?.position ?? ""} className={input} />
          <datalist id="positions">{positions.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Department">
          <input name="department" list="departments" defaultValue={member?.department ?? ""} className={input} />
          <datalist id="departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-deep">
          {submitLabel}
        </button>
        <Link href="/roster" className="text-sm text-ink-muted transition-colors hover:text-ink">Cancel</Link>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="text-risk"> *</span>}
      </span>
      {children}
    </label>
  );
}
