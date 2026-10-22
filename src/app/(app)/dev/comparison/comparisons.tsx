"use client";

import { useState } from "react";
import { Loader2, Sparkles, Trash2 } from "@/components/icons";
import { AskPanel } from "@/components/ask-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InitiativesTable } from "@/components/initiatives-table";
import { PeopleActionsProvider, PeopleManager } from "@/components/people-manager";
import { ScorecardEditor } from "@/components/scorecard-editor";
import { ScorecardTable } from "@/components/scorecard-table";
import { TelemetryTable } from "@/components/admin/telemetry-table";
import { SiSubmissionStatus } from "@/app/(app)/v2/_components/si-submission-status";
import { ItemChecklist } from "@/app/(app)/v2/_components/my-updates";
import { SiStatusPicker } from "@/app/(app)/v2/_components/status";
import type { SiStatus } from "@/app/(app)/v2/_mock/types";
import { InitiativeChecklist } from "@/components/initiative-checklist";
import { RiskViewSwitch, type RiskView } from "@/components/risk-views";
import { TeamPicker, ValueTypeSwitch } from "@/components/initiative-form";
import { CompletionToggle } from "@/components/completion-toggle";
import { CodeMultiSelect } from "@/components/code-multiselect";
import { DatePicker } from "@/components/date-picker";
import { LegacyDatePicker } from "./_legacy/legacy-date-picker";
import { LegacyCodeMultiSelect } from "./_legacy/legacy-code-multiselect";
import { LegacyTeamChips, LegacyValueTypeSwitch, LegacyViewSwitch } from "./_legacy/legacy-toggles";
import { LegacyCompletionToggle } from "./_legacy/legacy-completion-toggle";
import { LegacyInitiativeChecklist } from "./_legacy/legacy-initiative-checklist";
import { LegacyItemChecklist, LegacySiStatusPicker } from "./_legacy/legacy-my-updates";
import { LegacyAskPanel } from "./_legacy/legacy-ask-panel";
import { LegacyButton } from "./_legacy/legacy-button";
import { LegacyInitiativesTable } from "./_legacy/legacy-initiatives-table";
import { LegacyPeopleManager } from "./_legacy/legacy-people-manager";
import { LegacyScorecardEditor } from "./_legacy/legacy-scorecard-editor";
import { LegacyScorecardTable } from "./_legacy/legacy-scorecard-table";
import { LegacySiSubmissionStatus } from "./_legacy/legacy-si-submission-status";
import { LegacyTelemetryTable } from "./_legacy/legacy-telemetry-table";
import {
  MOCK_CIM_OPTIONS,
  MOCK_CIMS,
  MOCK_GOALS,
  MOCK_INITIATIVES,
  MOCK_MY_ITEMS,
  MOCK_OWNERS,
  MOCK_PEOPLE,
  MOCK_PEOPLE_ACTIONS,
  MOCK_REVIEW_TABS,
  MOCK_SCORECARD_ROWS,
  MOCK_SCORECARD_TOTALS,
  MOCK_SI_OPTIONS,
  MOCK_SI_ROWS,
  MOCK_TELEMETRY_HEADERS,
  MOCK_TELEMETRY_ROWS,
  mockAsk,
  mockSave,
} from "./_mock";

// One entry per component replaced with (or rebuilt on) a shadcn primitive.
// When you replace another component: snapshot the old file into _legacy/,
// then add an entry here with both renders and what changed.
const PHASES = ["Foundations", "Tables", "Checkboxes & radios", "Toggles", "Pickers"] as const;
type Phase = (typeof PHASES)[number];
type Comparison = {
  id: string;
  name: string;
  phase: Phase;
  /** "stacked" puts Before above After, for components too wide to sit side by side. */
  layout?: "split" | "stacked";
  /** Where the component lives in the real app. */
  usedIn: string;
  changes: string[];
  /** What to do on this page to see the difference. */
  tryIt: string;
  before: React.ReactNode;
  after: React.ReactNode;
};

function ButtonRow({ B }: { B: typeof Button | typeof LegacyButton }) {
  // Real actions from the initiative page and the Ask panel.
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <B>Save update</B>
        <B variant="secondary">Cancel</B>
        <B variant="outline">Edit charter</B>
        <B variant="ghost">View audit log</B>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <B variant="accent" size="sm">
          <Sparkles size={13} aria-hidden /> Draft with AI
        </B>
        <B variant="destructive" size="sm">
          <Trash2 size={13} aria-hidden /> Delete FY27-SI-005
        </B>
        <B variant="link">Open FY27 plan</B>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <B disabled>
          <Loader2 size={14} className="animate-spin" aria-hidden /> Saving…
        </B>
        <B variant="secondary" disabled>Disabled</B>
      </div>
    </div>
  );
}

/** Wraps a form-backed control and shows exactly what the form would post. */
function PostPreview({ children }: { children: React.ReactNode }) {
  const [posted, setPosted] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const ids = new FormData(e.currentTarget).getAll("initiativeIds");
        setPosted(ids.length ? ids.join(", ") : "(nothing)");
      }}
      className="flex flex-col gap-3"
    >
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="secondary" size="xs">Show what would be posted</Button>
        {posted && <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink">initiativeIds = {posted}</code>}
      </div>
    </form>
  );
}

function StatusPickerDemo({ legacy }: { legacy?: boolean }) {
  const [status, setStatus] = useState<SiStatus | null>("AT_RISK");
  const Picker = legacy ? LegacySiStatusPicker : SiStatusPicker;
  return <Picker name={legacy ? "status-demo-legacy" : "status-demo"} label="Status for Build tuck-in M&A machine" value={status} onChange={setStatus} />;
}

function ViewSwitchDemo({ legacy }: { legacy?: boolean }) {
  const [view, setView] = useState<RiskView>("scorecard");
  const Switch = legacy ? LegacyViewSwitch : RiskViewSwitch;
  return (
    <div className="flex flex-col gap-2">
      <Switch view={view} onChange={setView} />
      <p className="text-xs text-ink-faint">Showing: {view === "scorecard" ? "Scorecard" : "Exposure map"}</p>
    </div>
  );
}

function ValueTypeDemo({ legacy }: { legacy?: boolean }) {
  const [v, setV] = useState("VALUE");
  const Switch = legacy ? LegacyValueTypeSwitch : ValueTypeSwitch;
  return <Switch value={v} onChange={setV} />;
}

// Real directory names (People) as the working-team options.
const TEAM_OPTIONS = ["Adam Hamdan", "Dan Yankley", "Danny Bradford", "David Reed", "Kyle Campbell", "Kyle Sullivan"];
function TeamDemo({ legacy }: { legacy?: boolean }) {
  const [team, setTeam] = useState<string[]>(["David Reed", "Kyle Campbell"]);
  return legacy ? <LegacyTeamChips options={TEAM_OPTIONS} value={team} onChange={setTeam} /> : <TeamPicker options={TEAM_OPTIONS} value={team} onChange={setTeam} />;
}

// Mock toggle action: waits like a server round-trip, then flips the item.
const MILESTONES = [
  { id: "ms1", title: "Tuck-in pipeline review with brand presidents", done: false },
  { id: "ms2", title: "Hire integration lead", done: true },
];
function CompletionDemo({ legacy }: { legacy?: boolean }) {
  const [done, setDone] = useState<Record<string, boolean>>(Object.fromEntries(MILESTONES.map((m) => [m.id, m.done])));
  const action = async (fd: FormData) => {
    await new Promise((r) => setTimeout(r, 900));
    const id = String(fd.get("id"));
    setDone((d) => ({ ...d, [id]: !d[id] }));
  };
  return (
    <ul className="flex flex-col gap-2">
      {MILESTONES.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5">
          {legacy ? (
            <LegacyCompletionToggle id={m.id} done={done[m.id]} action={action} />
          ) : (
            <CompletionToggle id={m.id} done={done[m.id]} label={m.title} action={action} editable />
          )}
          <p className={`text-sm ${done[m.id] ? "text-ink-faint line-through" : "text-ink"}`}>{m.title}</p>
        </li>
      ))}
    </ul>
  );
}

function CodePickerDemo({ legacy }: { legacy?: boolean }) {
  const [codes, setCodes] = useState<string[]>(["CIM-11", "CIM-13"]);
  const Picker = legacy ? LegacyCodeMultiSelect : CodeMultiSelect;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">TrevPAR vs PY · CIM drivers</p>
      <Picker options={MOCK_CIM_OPTIONS} value={codes} onChange={setCodes} placeholder="+ CIM" />
    </div>
  );
}

// A milestone row from the real FY27 plan, in a short scrolling card like the
// initiative page's panels, so popover clipping shows up.
function DatePickerDemo({ legacy }: { legacy?: boolean }) {
  const [posted, setPosted] = useState<string | null>(null);
  const Picker = legacy ? LegacyDatePicker : DatePicker;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setPosted(String(new FormData(e.currentTarget).get("dueAt") ?? "") || "(empty)");
      }}
      className="flex flex-col gap-3"
    >
      <div className="h-36 overflow-auto rounded-lg border border-border bg-surface-2/40 p-3">
        <p className="mb-1.5 text-xs text-ink-muted">Integration playbook v1 signed off · due</p>
        <div className="w-56">
          <Picker name="dueAt" label="Due date" defaultValue="2026-11-01" clearable />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="secondary" size="xs">Show what would be posted</Button>
        {posted && <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink">dueAt = {posted}</code>}
      </div>
    </form>
  );
}

const COMPARISONS: Comparison[] = [
  {
    id: "ask-panel",
    name: "Ask panel",
    phase: "Foundations",
    usedIn: "Header “Ask” button, every page (src/components/ask-panel.tsx)",
    changes: [
      "Hand-rolled fixed overlay → shadcn Sheet (Radix Dialog) portaled to <body>.",
      "Fixes the bug: the old panel rendered inside the sticky z-10 header, so the Strategy Review tab bar (sticky z-20) drew on top of it.",
      "Escape closes it, focus is trapped and returned to the trigger, title/description are announced.",
      "Slide-in animation; spinner in Send while waiting; “New question” reset; Enter/Shift+Enter hint.",
      "A thrown server action no longer leaves it stuck on “Thinking…”.",
    ],
    tryIt:
      "Open each panel. The sticky bar above mimics the Strategy Review tabs: it covers the old panel’s description but sits under the new one. Ask a suggested question (mock answer, no API call), then press Escape.",
    // relative z-10 recreates the header's stacking context (sticky z-10) that trapped the old panel.
    before: (
      <div className="relative z-10">
        <LegacyAskPanel ask={mockAsk} />
      </div>
    ),
    after: <AskPanel ask={mockAsk} />,
  },
  {
    id: "button",
    name: "Button",
    phase: "Foundations",
    usedIn: "Every shadcn Button (src/components/ui/button.tsx) + pointer rule in globals.css",
    changes: [
      "Pointer cursor on hover (Tailwind v4 resets buttons to the default arrow).",
      "1px press-down on click; smoother 150ms transitions.",
      "Label text no longer selects on double-click.",
      "Disabled opacity 60% → 50% so disabled reads clearly as disabled.",
    ],
    tryIt: "Hover each side to compare the cursor, click and hold to feel the press, double-click a label.",
    before: <ButtonRow B={LegacyButton} />,
    after: <ButtonRow B={Button} />,
  },
  {
    id: "owner-scorecard",
    name: "Owner Scorecard",
    phase: "Tables",
    layout: "stacked",
    usedIn: "/scorecard (src/components/scorecard-table.tsx, extracted from the page)",
    changes: [
      "Raw <table> → shadcn Table; header gets the shared surface band.",
      "Sticky header row: the directory can be long, the column names stay visible while scrolling.",
      "Avg % gets an inline progress bar next to the number.",
      "People with no initiatives fade their text instead of the whole row (links and badges stay legible).",
      "Empty state row when the directory is empty.",
    ],
    tryIt: "Compare the Avg % column and the idle rows (Adam Hamdan, David Reed). Scroll inside the new table to see the header stay put.",
    before: <LegacyScorecardTable rows={MOCK_SCORECARD_ROWS} totals={MOCK_SCORECARD_TOTALS} />,
    after: <ScorecardTable rows={MOCK_SCORECARD_ROWS} totals={MOCK_SCORECARD_TOTALS} />,
  },
  {
    id: "initiatives-table",
    name: "Initiatives list",
    phase: "Tables",
    layout: "stacked",
    usedIn: "/initiatives (src/components/initiatives-table.tsx)",
    changes: [
      "Raw <table> → shadcn Table with a sticky header.",
      "Sort headers expose aria-sort, and unsorted columns show a faint ⇅ on hover so sortability is discoverable.",
      "The initiative name is a real link: cmd/middle-click opens it in a new tab (the old row was click-only).",
      "Keyboard focus on a row shows a navy edge marker and the chevron, instead of nothing.",
      "Targeted value is right-aligned in tabular figures.",
      "Empty state offers a one-click “Reset filters”.",
    ],
    tryIt: "Hover a column header, sort by Targeted value, Tab into the rows, and search for “zzz” to see the empty state.",
    before: <LegacyInitiativesTable rows={MOCK_INITIATIVES} owners={MOCK_OWNERS} cims={MOCK_CIMS} editable={false} />,
    after: <InitiativesTable rows={MOCK_INITIATIVES} owners={MOCK_OWNERS} cims={MOCK_CIMS} editable={false} />,
  },
  {
    id: "si-submission",
    name: "SI submission status",
    phase: "Tables",
    layout: "stacked",
    usedIn: "/v2 review editor (src/app/(app)/v2/_components/si-submission-status.tsx)",
    changes: [
      "Filter chips → shadcn ToggleGroup: arrow keys move between chips, and the active chip can’t be cleared by clicking it again.",
      "Counts move into a small badge on each chip.",
      "Raw <table> → shadcn Table; SI names underline on hover.",
      "Per-filter empty state (e.g. “Every SI has started its update.”) instead of an empty table.",
    ],
    tryIt: "Click the chips, then Tab to them and use the arrow keys. Pick a filter with no rows.",
    before: <LegacySiSubmissionStatus sis={MOCK_SI_ROWS} />,
    after: <SiSubmissionStatus sis={MOCK_SI_ROWS} />,
  },
  {
    id: "scorecard-editor",
    name: "Editable grid",
    phase: "Tables",
    layout: "stacked",
    usedIn: "Scorecard editor and Q2 board editor (src/components/scorecard-editor.tsx, q2board-section.tsx)",
    changes: [
      "Raw <table> → shadcn Table in its new compact size.",
      "Removing a row shows an “Undo” toast instead of deleting with no way back.",
      "“Add row” focuses the new row’s first field.",
      "Save is disabled until something changes, with an “Unsaved changes” hint.",
      "Every field has an accessible name; the remove button names the row it deletes.",
    ],
    tryIt: "Delete a row on each side (only the new one offers Undo), add a row, and edit a cell to see the save state change. Saving is mocked.",
    before: <LegacyScorecardEditor goals={MOCK_GOALS} siOptions={MOCK_SI_OPTIONS} cimOptions={MOCK_CIM_OPTIONS} onSave={mockSave} />,
    after: <ScorecardEditor goals={MOCK_GOALS} siOptions={MOCK_SI_OPTIONS} cimOptions={MOCK_CIM_OPTIONS} onSave={mockSave} />,
  },
  {
    id: "people-manager",
    name: "People & access",
    phase: "Tables",
    layout: "stacked",
    usedIn: "/settings/people (src/components/people-manager.tsx)",
    changes: [
      "Raw <table> → shadcn Table with a sticky header and an empty state.",
      "App-access pills → shadcn ToggleGroup: they flip immediately, show a spinner while saving, and revert if the save fails.",
      "Grant-login app checkboxes → shadcn Checkbox, with the whole label clickable and a live “n/total” count.",
      "The row being edited is highlighted and its editor panel gets a navy edge, so it’s clear which person you’re changing.",
      "Edit / Password / Grant buttons report aria-expanded.",
    ],
    tryIt: "Toggle David Reed’s app pill, open Edit or Grant login on each side, and untick an app in Grant login. All actions are mocked.",
    before: (
      <PeopleActionsProvider value={MOCK_PEOPLE_ACTIONS}>
        <LegacyPeopleManager people={MOCK_PEOPLE} editable isAdmin />
      </PeopleActionsProvider>
    ),
    after: (
      <PeopleActionsProvider value={MOCK_PEOPLE_ACTIONS}>
        <PeopleManager people={MOCK_PEOPLE} editable isAdmin />
      </PeopleActionsProvider>
    ),
  },
  {
    id: "telemetry-table",
    name: "AI telemetry table",
    phase: "Tables",
    layout: "stacked",
    usedIn: "/settings/admin/ai-telemetry (src/components/admin/telemetry-table.tsx)",
    changes: [
      "Raw <table> → shadcn Table inside a bordered frame, with a header band.",
      "Numeric columns (counts, $, latency, %) are detected and right-aligned in tabular figures.",
      "Blank cells show a faint “—” instead of nothing.",
    ],
    tryIt: "Compare the Cost and Avg latency columns, and the blank Errors cell on the last row.",
    before: <LegacyTelemetryTable headers={MOCK_TELEMETRY_HEADERS} rows={MOCK_TELEMETRY_ROWS} />,
    after: <TelemetryTable headers={MOCK_TELEMETRY_HEADERS} rows={MOCK_TELEMETRY_ROWS} />,
  },
  {
    id: "initiative-checklist",
    name: "Initiative pick-list",
    phase: "Checkboxes & radios",
    layout: "stacked",
    usedIn: "CIM risk form “Linked Strategic Initiatives” and group editor (src/components/initiative-checklist.tsx)",
    changes: [
      "Native checkboxes → shadcn Checkbox; one shared component replaces two inlined copies.",
      "Filter box: type a code or name to narrow a long list (hidden ticks still submit).",
      "Live “n of total selected” count, plus Select all / Clear (scoped to the filter).",
      "Ticked rows get a soft tint and every row has a hover target, not just the 14px box.",
      "Posts exactly the same initiativeIds values as before; the server actions are unchanged.",
    ],
    tryIt: "Filter by “SI-00”, Select shown, then Show what would be posted on both sides and compare the values.",
    before: (
      <PostPreview>
        <LegacyInitiativeChecklist name="initiativeIds" initiatives={MOCK_INITIATIVES} defaultSelected={["m2", "m5"]} />
      </PostPreview>
    ),
    after: (
      <PostPreview>
        <InitiativeChecklist name="initiativeIds" initiatives={MOCK_INITIATIVES} defaultSelected={["m2", "m5"]} />
      </PostPreview>
    ),
  },
  {
    id: "item-checklist",
    name: "Milestone checklist",
    phase: "Checkboxes & radios",
    usedIn: "/v2 My SIs and Inbox (ItemChecklist in my-updates.tsx; inbox-view.tsx)",
    changes: [
      "Native checkboxes → shadcn Checkbox in the app’s navy.",
      "Done items fade and strike through with a short transition.",
      "Each row has a hover background, so the whole line reads as clickable.",
    ],
    tryIt: "Tick and untick the past-due item on both sides.",
    before: <LegacyItemChecklist title="Milestones" items={MOCK_MY_ITEMS} />,
    after: <ItemChecklist title="Milestones" items={MOCK_MY_ITEMS} />,
  },
  {
    id: "status-picker",
    name: "SI status picker",
    phase: "Checkboxes & radios",
    usedIn: "/v2 My SIs monthly update card (SiStatusPicker in v2/_components/status.tsx)",
    changes: [
      "Visually hidden native radios → shadcn RadioGroup (pill variant).",
      "Arrow keys move the choice; Tab enters and leaves the group as one stop.",
      "The selected pill takes its status colour (green Ahead, amber At risk, red Behind) instead of always navy.",
    ],
    tryIt: "Click through the statuses, then Tab into each group and use the arrow keys.",
    before: <StatusPickerDemo legacy />,
    after: <StatusPickerDemo />,
  },
  {
    id: "view-switch",
    name: "View switch",
    phase: "Toggles",
    usedIn: "/risks Scorecard / Exposure map (RiskViewSwitch in src/components/risk-views.tsx)",
    changes: [
      "Two loose buttons → shadcn ToggleGroup (single): announced as one control with the current choice.",
      "Arrow keys switch views; the active option can’t be un-selected into an empty state.",
      "Hover gives a background on the inactive option, not just a text colour change.",
    ],
    tryIt: "Click the active option again (nothing breaks), then Tab in and use the arrow keys.",
    before: <ViewSwitchDemo legacy />,
    after: <ViewSwitchDemo />,
  },
  {
    id: "value-type",
    name: "Value / Non-value",
    phase: "Toggles",
    usedIn: "Initiative form “Type, value & priority” (ValueTypeSwitch in src/components/initiative-form.tsx)",
    changes: [
      "Hand-rolled segmented buttons → shadcn ToggleGroup (single), still mirrored into the hidden valueType input.",
      "Keyboard arrows and pressed-state semantics; clicking the active side keeps it selected.",
    ],
    tryIt: "Switch between Value and Non-value with the mouse, then with the arrow keys.",
    before: <ValueTypeDemo legacy />,
    after: <ValueTypeDemo />,
  },
  {
    id: "team-picker",
    name: "Working team chips",
    phase: "Toggles",
    usedIn: "Initiative form “Working team” (TeamPicker in src/components/initiative-form.tsx)",
    changes: [
      "Loose chip buttons → shadcn ToggleGroup (multiple), still serialized into the hidden supports input.",
      "Selected chips show a check mark, so selection doesn’t rely on colour alone.",
      "A live summary line lists who is selected.",
    ],
    tryIt: "Toggle a few people on both sides and compare how selection reads.",
    before: <TeamDemo legacy />,
    after: <TeamDemo />,
  },
  {
    id: "completion-toggle",
    name: "Done toggle",
    phase: "Toggles",
    usedIn: "Initiative page milestones and action items (src/components/completion-toggle.tsx)",
    changes: [
      "Raw submit <button> → shadcn Button inside the same one-field server-action form.",
      "While the save runs, the circle already shows the new state and pulses (the old one did nothing until the page refreshed).",
      "Screen readers hear “Mark “Hire integration lead” complete” instead of an unnamed button.",
      "Unchecked circles get a stronger border and a hover tint so they read as clickable.",
    ],
    tryIt: "Click a circle on each side: the old one waits ~1s with no feedback, the new one responds at once.",
    before: <CompletionDemo legacy />,
    after: <CompletionDemo />,
  },
  {
    id: "code-picker",
    name: "CIM / SI code picker",
    phase: "Pickers",
    usedIn: "Scorecard and Q2 board editors (src/components/code-multiselect.tsx)",
    changes: [
      "Native <select> → shadcn Popover + Command combobox.",
      "Type to filter by code or name (e.g. “trev” finds CIM-11) instead of scrolling a long list.",
      "Options toggle: picked codes stay in the list with a check, and can be removed there as well as from the chip.",
      "The popover stays open for several picks, has a “n selected · Clear” footer, and renders outside the table so it is never clipped.",
      "Chip remove buttons are named (“Remove CIM-11”) and get a red hover target.",
    ],
    tryIt: "Open both pickers. In the new one type “margin”, press Enter, then Escape.",
    before: <CodePickerDemo legacy />,
    after: <CodePickerDemo />,
  },
  {
    id: "date-picker",
    name: "Date picker",
    phase: "Pickers",
    usedIn: "Milestone / action-item due dates, CIM target date, initiative start/end (src/components/date-picker.tsx)",
    changes: [
      "Hand-built calendar popover → shadcn Popover + Calendar (react-day-picker).",
      "The popover renders outside the page, so a scrolling card no longer clips it, and it flips up near the bottom of the screen.",
      "Month and year dropdowns jump straight to far-off dates (FY27 end dates) instead of clicking month by month.",
      "Quick picks: Today, End of quarter, End of year.",
      "Fuller keyboard support: PageUp/PageDown change month (Shift for year), Home/End jump within the week.",
      "Same props and the same hidden YYYY-MM-DD input, so every form posts exactly what it did before.",
    ],
    tryIt: "Open each picker inside its short card: the old one is cut off by the card, the new one isn’t. Then pick End of quarter and Show what would be posted.",
    before: <DatePickerDemo legacy />,
    after: <DatePickerDemo />,
  },
];

export function Comparisons() {
  return (
    <div className="mx-auto max-w-6xl text-sm">
      {/* Same classes as the Strategy Review tab bar, so z-index bugs reproduce here. */}
      <div className="sticky top-0 z-20 -mx-6 border-b border-border bg-surface/95 px-6 py-2 backdrop-blur">
        <div className="flex items-center gap-3 overflow-x-auto">
          <span className="shrink-0 font-semibold tracking-tight text-ink">MOCK · STRATEGY REVIEW TABS</span>
          <nav aria-label="Comparisons" className="flex min-w-max items-center gap-1">
            {PHASES.filter((ph) => COMPARISONS.some((c) => c.phase === ph)).map((ph) => (
              <span key={ph} className="flex items-center gap-1 border-l border-border pl-2 first:border-0 first:pl-0">
                <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{ph}</span>
                {COMPARISONS.filter((c) => c.phase === ph).map((c) => (
                  <a key={c.id} href={`#${c.id}`} className="rounded px-2 py-1 text-[11px] text-ink hover:bg-surface-2">{c.name}</a>
                ))}
              </span>
            ))}
            {MOCK_REVIEW_TABS.map((id) => (
              <span key={id} className="rounded px-2 py-1 text-[11px] capitalize text-ink-faint">{id}</span>
            ))}
          </nav>
        </div>
      </div>

      <header className="mt-6">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Dev only</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">shadcn migration: before / after</h1>
        <p className="mt-1 max-w-3xl text-ink-muted">
          Each component replaced with a shadcn primitive, rendered as it was and as it is now, with mock data from a real
          FY27 snapshot. Nothing on this page writes to the database or calls the AI.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-10">
        {COMPARISONS.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-28">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold text-ink">{c.name}</h2>
              <span className="text-xs text-ink-faint">{c.usedIn}</span>
            </div>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-muted">
              {c.changes.map((x) => <li key={x}>{x}</li>)}
            </ul>
            <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-muted">
              <span className="font-medium text-ink">Try it: </span>{c.tryIt}
            </p>
            <div className={c.layout === "stacked" ? "mt-4 grid gap-4" : "mt-4 grid gap-4 md:grid-cols-2"}>
              {(["before", "after"] as const).map((side) => (
                <div key={side} className="min-w-0 rounded-xl border border-border bg-surface p-5">
                  <Badge variant="outline" className={side === "after" ? "mb-4 border-navy/40 text-navy" : "mb-4"}>
                    {side === "before" ? "Before" : "After (shadcn)"}
                  </Badge>
                  <div>{c[side]}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
