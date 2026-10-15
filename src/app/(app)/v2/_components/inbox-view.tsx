"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UpdateState } from "../_mock/types";
import { MockNote } from "./preview";
import { UpdateStateBadge } from "./status";

export type InboxSi = { code: string; shortCode: string; name: string; state: UpdateState };
export type InboxItem = {
  id: string;
  kind: "Milestone" | "Action item";
  text: string;
  dueLabel: string;
  siCode?: string;
  siLabel?: string;
  pastDue: boolean;
  done: boolean;
};
export type InboxAsk = { id: string; siCode: string; siLabel: string; fromName: string; text: string; raisedLabel: string; dueLabel: string | null; open: boolean };

function Panel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Badge variant={count > 0 ? "default" : "secondary"}>{count}</Badge>
      </div>
      {children}
    </section>
  );
}

function AskRow({ ask }: { ask: InboxAsk }) {
  const [open, setOpen] = useState(ask.open);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  return (
    <li className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          <span className="font-semibold text-ink">{ask.fromName}</span> on{" "}
          <Link href={`/v2/si/${ask.siCode}`} className="text-navy hover:underline">{ask.siLabel}</Link>
        </p>
        <span className="flex items-center gap-1.5">
          {ask.dueLabel && <span className="text-[11px] text-ink-faint">Due {ask.dueLabel}</span>}
          <Badge variant={open ? "warn" : "ok"}>{open ? "Open" : "Answered"}</Badge>
        </span>
      </div>
      <p className="mt-1.5 text-sm text-ink">{ask.text}</p>
      <p className="mt-1 text-[11px] text-ink-faint">Raised {ask.raisedLabel}</p>
      {open && !replying && (
        <Button className="mt-2" size="xs" variant="secondary" onClick={() => setReplying(true)}>Reply</Button>
      )}
      {open && replying && (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Your response to the ELT" aria-label="Reply to ask" />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" disabled={!reply.trim()} onClick={() => { setOpen(false); setReplying(false); }}>Send reply</Button>
            <Button size="xs" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
            <MockNote />
          </div>
        </div>
      )}
    </li>
  );
}

export function InboxView({ sis, items, asks, periodLabel }: { sis: InboxSi[]; items: InboxItem[]; asks: InboxAsk[]; periodLabel: string }) {
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.id, i.done])));
  const needUpdate = sis.filter((s) => s.state !== "SUBMITTED");
  const openItems = items.filter((i) => !done[i.id]);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title={`SIs needing a ${periodLabel} update`} count={needUpdate.length}>
        {needUpdate.length === 0 ? (
          <p className="text-xs text-ink-faint">All caught up.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {needUpdate.map((s) => (
              <li key={s.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2.5">
                <Link href={`/v2/si/${s.code}`} className="text-sm font-medium text-ink hover:text-navy-deep">
                  <span className="tabular mr-2 text-[10px] text-ink-faint">{s.shortCode}</span>{s.name}
                </Link>
                <span className="flex items-center gap-2">
                  <UpdateStateBadge state={s.state} />
                  <Button asChild size="xs" variant="secondary"><Link href="/v2/my">Update</Link></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="ELT asks on my SIs" count={asks.filter((a) => a.open).length}>
        {asks.length === 0 ? <p className="text-xs text-ink-faint">No asks.</p> : (
          <ul className="flex flex-col gap-2">{asks.map((a) => <AskRow key={a.id} ask={a} />)}</ul>
        )}
      </Panel>

      <div className="xl:col-span-2">
        <Panel title="My open milestones and action items" count={openItems.length}>
          {items.length === 0 ? <p className="text-xs text-ink-faint">Nothing open.</p> : (
            <ul className="flex flex-col gap-2">
              {items.map((i) => (
                <li key={i.id} className={`rounded-lg border border-border/70 px-3 py-2.5 ${i.pastDue && !done[i.id] ? "bg-warn-soft/60" : "bg-surface-2/30"}`}>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-navy)]"
                      checked={!!done[i.id]}
                      onChange={(e) => setDone((d) => ({ ...d, [i.id]: e.target.checked }))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">{i.kind}</Badge>
                        {i.pastDue && !done[i.id] && <Badge variant="warn">Needs a status</Badge>}
                        <span className="text-[11px] text-ink-faint">{i.dueLabel}</span>
                      </span>
                      <span className={`mt-1 block text-sm ${done[i.id] ? "text-ink-muted line-through" : "text-ink"}`}>{i.text}</span>
                      {i.siCode && i.siLabel && <span className="mt-0.5 block text-[11px] text-ink-faint">{i.siLabel}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
