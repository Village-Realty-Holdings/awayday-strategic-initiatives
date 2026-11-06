"use client";

import { useActionState, useState } from "react";
import { createApiToken, type CreateTokenState } from "@/app/(app)/settings/api-tokens/actions";
import { Check, Copy } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";

// New API token form. The token comes back from the action once and is shown
// here until the page is left; it can't be retrieved again.
export function ApiTokenForm({ mcpUrl }: { mcpUrl: string }) {
  const [state, action] = useActionState<CreateTokenState, FormData>(createApiToken, null);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <Label className="flex flex-col gap-1.5">
          Name
          <Input name="name" required maxLength={80} placeholder="e.g. Claude on my laptop" className="bg-bg" />
        </Label>
        <Label className="flex flex-col gap-1.5">
          Access
          <NativeSelect name="scope" defaultValue="write" className="bg-bg">
            <option value="write">Read and update</option>
            <option value="read">Read only</option>
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-1.5">
          Expires
          <NativeSelect name="expiresInDays" defaultValue="90" className="bg-bg">
            <option value="30">In 30 days</option>
            <option value="90">In 90 days</option>
            <option value="365">In a year</option>
          </NativeSelect>
        </Label>
        <SubmitButton className="px-3">Create token</SubmitButton>
      </form>
      {state && !state.ok && <p className="text-xs text-risk">{state.error}</p>}
      {state?.ok && <NewToken token={state.token} name={state.name} mcpUrl={mcpUrl} />}
    </div>
  );
}

function NewToken({ token, name, mcpUrl }: { token: string; name: string; mcpUrl: string }) {
  const command = `claude mcp add --transport http awayday ${mcpUrl} --header "Authorization: Bearer ${token}"`;
  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border border-ok/40 bg-ok-soft p-4">
      <p className="text-sm text-ink">
        <span className="font-medium">{name}</span> is ready. Copy it now: it won&apos;t be shown again.
      </p>
      <CopyField label="Token" value={token} />
      <CopyField label="Claude Code command" value={command} />
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-muted">{label}</span>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-ink">{value}</code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </Button>
      </div>
    </div>
  );
}
