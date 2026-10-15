import { requireApp } from "@/lib/session";
import { InboxView, type InboxAsk, type InboxItem } from "../_components/inbox-view";
import { V2Header } from "../_components/preview";
import { ACTION_ITEMS, ELT_ASKS, MILESTONES, MOCK_CURRENT_USER_ID, MOCK_TODAY, personName } from "../_mock/data";
import { fmtDay, isPastDue, LATEST_PERIOD, siByCode, siShortCode, sisForOwner, updateStateFor } from "../_mock/selectors";

export default async function InboxPage() {
  await requireApp("initiatives");
  const me = MOCK_CURRENT_USER_ID;
  const mySis = sisForOwner(me);
  const myCodes = new Set(mySis.map((s) => s.code));
  const label = (code: string) => {
    const si = siByCode(code);
    return si ? `${siShortCode(code)} ${si.name}` : code;
  };

  const items: InboxItem[] = [
    ...MILESTONES.filter((m) => m.ownerIds.includes(me) || (m.siCode && myCodes.has(m.siCode))).map(
      (m): InboxItem => ({
        id: m.id,
        kind: "Milestone",
        text: m.title,
        dueLabel: fmtDay(m.date),
        siCode: m.siCode,
        siLabel: m.siCode ? label(m.siCode) : undefined,
        pastDue: isPastDue(m),
        done: m.done,
      }),
    ),
    ...ACTION_ITEMS.filter((a) => a.ownerId === me).map(
      (a): InboxItem => ({
        id: a.id,
        kind: "Action item",
        text: a.text,
        dueLabel: fmtDay(a.due),
        siCode: a.siCode,
        siLabel: label(a.siCode),
        pastDue: !a.done && a.due < MOCK_TODAY,
        done: a.done,
      }),
    ),
  ].filter((i) => !i.done);

  const asks: InboxAsk[] = ELT_ASKS.filter((a) => myCodes.has(a.siCode)).map((a) => ({
    id: a.id,
    siCode: a.siCode,
    siLabel: label(a.siCode),
    fromName: personName(a.fromId),
    text: a.text,
    raisedLabel: fmtDay(a.raisedOn),
    dueLabel: a.due ? fmtDay(a.due) : null,
    open: a.open,
  }));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <V2Header
        eyebrow="Inbox"
        title={`Inbox · ${personName(me)}`}
        description="Your SIs that need an update, the milestones and action items you own, and ELT asks on your SIs. Mock persona; replies and tick-offs are not saved."
      />
      <InboxView
        periodLabel={LATEST_PERIOD.monthName}
        sis={mySis.map((s) => ({ code: s.code, shortCode: siShortCode(s.code), name: s.name, state: updateStateFor(s.code, LATEST_PERIOD.id) }))}
        items={items}
        asks={asks}
      />
    </div>
  );
}
