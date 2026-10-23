import type { AiResult } from "@/app/(app)/ai-actions";
import { EBITDA_BUILD, GOALS_2026 } from "@/lib/sources";
import type { InitiativeRow } from "@/components/initiatives-table";
import type { ScorecardRow, ScorecardTotals } from "@/components/scorecard-table";
import type { EditorSiRow } from "@/app/(app)/v2/_components/review-editor";
import type { Person, PeopleActions } from "@/components/people-manager";
import type { CodeOption } from "@/components/code-multiselect";
import type { AdminResult } from "@/app/(app)/settings/admin/actions";
import type { MyItem } from "@/app/(app)/v2/_components/my-updates";

// Mock data for /dev/comparison, lifted from a real local snapshot (FY27 plan
// initiatives, CIM critical risks, May 2026 EBITDA build) so the components
// render with realistic copy and lengths. Nothing here touches the database.

export const MOCK_QUESTION = "What should the board worry about most this quarter?";

export const MOCK_ANSWER = [
  `EBITDA is tracking at $${EBITDA_BUILD.lender}M lender-defined ($${EBITDA_BUILD.valuation}M valuation basis) against a $${EBITDA_BUILD.target2026}M 2026 target, so roughly $${(EBITDA_BUILD.target2026 - EBITDA_BUILD.lender).toFixed(1)}M still has to land with +$${EBITDA_BUILD.ytdGrowth}M already booked YTD.`,
  "",
  "Three things deserve the board's attention:",
  "1. Execution has not started on the brand levers. FY27-SI-005 BD Brand Optimization and FY27-SI-008 Underperforming brand interventions are both Not started at 0%.",
  "2. TRevPAR is going backwards (-0.8% vs PY against a +3.3% target). FY27-SI-010 AI revenue manager and FY27-SI-009 Listing page optimization are the offsets, and both are in progress at 0%.",
  "3. Critical CIM risks are concentrated in CIM-11 TrevPAR degradation and CIM-13 OTA / channel-mix risk, which compound each other.",
  "",
  "Ask: owners of SI-005 and SI-008 to commit to a start date before the next review.",
].join("\n");

/** Stand-in for the askBoard server action: a short delay, then the canned answer. */
export async function mockAsk(): Promise<AiResult> {
  await new Promise((r) => setTimeout(r, 900));
  return { ok: true, text: MOCK_ANSWER };
}

/** Real section ids from the Strategy Review tab bar, for the sticky mock bar. */
export const MOCK_REVIEW_TABS = ["summary", "financials", "ma", "units", "retention", "trevpar", "margin", "enablers", "milestones", "asks"];

/* ---------- Phase 1: tables ---------- */

/** Real FY27 plan rows (codes, names, pillars, owners, status, targets). */
export const MOCK_INITIATIVES: InitiativeRow[] = [
  { id: "m1", code: "BRD-01", name: "1H2026 Performance Improvement (PI) Program", cimDriver: "Margin expansion", teamLead: "Kyle Sullivan", supports: "FP&A Lead; Brand CFOs", quadrant: "FILL_IN", value: 0, lift: 0, valueTargeted: 1_500_000, valueType: "VALUE", status: "IN_PROGRESS", pct: 1, endLabel: "06/30/2026", endTime: Date.UTC(2026, 5, 30), groupIds: [], isBehind: false },
  { id: "m2", code: "BRD-02", name: "AI / Tech Roadmap", cimDriver: "Key Enablers — Technology", teamLead: "Tom Chess", supports: "AI Lead; Data2Value", quadrant: "QUICK_WIN", value: 0, lift: 0, valueTargeted: null, valueType: "VALUE", status: "IN_PROGRESS", pct: 0.55, endLabel: "06/30/2026", endTime: Date.UTC(2026, 5, 30), groupIds: [], isBehind: true },
  { id: "m3", code: "FY27-SI-001", name: "Build tuck-in M&A machine", cimDriver: "M&A", teamLead: "Curt Stark", supports: null, quadrant: "FILL_IN", value: 0, lift: 0, valueTargeted: 4_000_000, valueType: "VALUE", status: "IN_PROGRESS", pct: 0.2, endLabel: "12/31/2027", endTime: Date.UTC(2027, 11, 31), groupIds: [], isBehind: false },
  { id: "m4", code: "FY27-SI-004", name: "BD measurement: leading and lagging scorecards", cimDriver: "GROW", teamLead: "David Jensen", supports: null, quadrant: "FILL_IN", value: 0, lift: 0, valueTargeted: null, valueType: "NON_VALUE", status: "NOT_STARTED", pct: 0, endLabel: "—", endTime: null, groupIds: [], isBehind: false },
  { id: "m5", code: "FY27-SI-005", name: "BD Brand Optimization", cimDriver: "GROW", teamLead: "David Jensen", supports: null, quadrant: "FILL_IN", value: 0, lift: 0, valueTargeted: 750_000, valueType: "VALUE", status: "NOT_STARTED", pct: 0, endLabel: "03/31/2027", endTime: Date.UTC(2027, 2, 31), groupIds: [], isBehind: true },
  { id: "m6", code: "FY27-SI-006", name: "Talent upgrades", cimDriver: "RETENTION", teamLead: "Kyle Sullivan", supports: null, quadrant: "FILL_IN", value: 0, lift: 0, valueTargeted: null, valueType: "NON_VALUE", status: "IN_PROGRESS", pct: 0.1, endLabel: "—", endTime: null, groupIds: [], isBehind: false },
];
export const MOCK_OWNERS = ["Curt Stark", "David Jensen", "Kyle Sullivan", "Tom Chess"];
export const MOCK_CIMS = ["GROW", "Key Enablers — Technology", "M&A", "Margin expansion", "RETENTION"];

/** Owner Scorecard rows built from the real People directory. */
export const MOCK_SCORECARD_ROWS: ScorecardRow[] = [
  { owner: "Kyle Sullivan", position: "VP", department: "Ops Excellence", inDirectory: true, count: 2, complete: 0, inFlight: 2, toCreate: 1_500_000, created: 1_050_000, avgPct: 0.55 },
  { owner: "Curt Stark", position: null, department: null, inDirectory: false, count: 2, complete: 0, inFlight: 2, toCreate: 4_000_000, created: 800_000, avgPct: 0.1 },
  { owner: "David Jensen", position: null, department: null, inDirectory: false, count: 3, complete: 0, inFlight: 3, toCreate: 750_000, created: 0, avgPct: 0 },
  { owner: "Adam Hamdan", position: "VP HR", department: "HR / Talent", inDirectory: true, count: 0, complete: 0, inFlight: 0, toCreate: 0, created: 0, avgPct: 0 },
  { owner: "David Reed", position: "CFO", department: "Finance / FP&A", inDirectory: true, count: 0, complete: 0, inFlight: 0, toCreate: 0, created: 0, avgPct: 0 },
];
export const MOCK_SCORECARD_TOTALS: ScorecardTotals = MOCK_SCORECARD_ROWS.reduce(
  (a, r) => ({ count: a.count + r.count, complete: a.complete + r.complete, inFlight: a.inFlight + r.inFlight, toCreate: a.toCreate + r.toCreate, created: a.created + r.created }),
  { count: 0, complete: 0, inFlight: 0, toCreate: 0, created: 0 },
);

/** AI telemetry "By feature" rows using the app's real feature names. */
export const MOCK_TELEMETRY_HEADERS = ["Module", "Feature", "Calls", "Cost", "Avg latency", "Success", "Fallbacks", "Errors"];
export const MOCK_TELEMETRY_ROWS = [
  ["INITIATIVES", "board-narrative", "42", "$3.18", "6.4s", "97%", "1", "0"],
  ["INITIATIVES", "ask-board", "128", "$2.04", "3.1s", "99%", "0", "1"],
  ["INITIATIVES", "charter-assist", "57", "$0.91", "2.2s", "100%", "0", "0"],
  ["INITIATIVES", "draft-from-name", "19", "$0.22", "1.8s", "95%", "1", ""],
];

/** Review-editor SI rows (real FY27 SIs and owners). */
export const MOCK_SI_ROWS: EditorSiRow[] = [
  { code: "FY27-SI-001", shortCode: "SI-001", name: "Build tuck-in M&A machine", area: "M&A", owner: "Curt Stark", state: "SUBMITTED" },
  { code: "FY27-SI-003", shortCode: "SI-003", name: "Talent: BDM and enablement leadership", area: "Grow New Units", owner: "David Jensen", state: "DRAFT" },
  { code: "FY27-SI-005", shortCode: "SI-005", name: "BD Brand Optimization", area: "Grow New Units", owner: "David Jensen", state: "NOT_SUBMITTED" },
  { code: "FY27-SI-006", shortCode: "SI-006", name: "Talent upgrades", area: "Owner Retention", owner: "Kyle Sullivan", state: "SUBMITTED" },
  { code: "FY27-SI-010", shortCode: "SI-010", name: "AI revenue manager", area: "TRevPAR Expansion", owner: "Danny Bradford", state: "DRAFT" },
];

/** The real 2026 goals scorecard, first five rows. */
export const MOCK_GOALS = GOALS_2026.slice(0, 5);
export const MOCK_CIM_OPTIONS: CodeOption[] = [
  ["CIM-01", "Gross unit growth (>20%)"], ["CIM-02", "Owner churn (sub-11% TTM)"], ["CIM-04", "Increasing M&A competition"],
  ["CIM-07", "Integration / VC repeatability"], ["CIM-11", "TrevPAR degradation"], ["CIM-13", "OTA / channel-mix risk"],
  ["CIM-15", "Margin pressure (labor / COGS)"], ["CIM-16", "Risk from not adopting AI"],
].map(([code, label]) => ({ code, label }));
export const MOCK_SI_OPTIONS: CodeOption[] = MOCK_INITIATIVES.map((i) => ({ code: i.code, label: i.name }));
export async function mockSave(): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
}

/** People directory rows: real names, roles and positions. */
export const MOCK_PEOPLE: Person[] = [
  { key: "p1", rosterId: "r1", userId: "u1", name: "Michael La Spisa", email: "michael@opticommerceai.com", position: null, department: "Technology", role: "admin", appAccess: ["initiatives"], mfa: true, isSelf: true },
  { key: "p2", rosterId: "r2", userId: "u2", name: "Kyle Sullivan", email: "ksullivan@awayday.com", position: "VP", department: "Ops Excellence", role: "editor", appAccess: ["initiatives"], mfa: true, isSelf: false },
  { key: "p3", rosterId: "r3", userId: "u3", name: "David Reed", email: "dreed@awayday.com", position: "CFO", department: "Finance / FP&A", role: "user", appAccess: [], mfa: false, isSelf: false },
  { key: "p4", rosterId: "r4", userId: null, name: "Adam Hamdan", email: "ahamdan@awayday.com", position: "VP HR", department: "HR / Talent", role: null, appAccess: [], mfa: false, isSelf: false },
];
const ok = async (message: string): Promise<AdminResult> => {
  await new Promise((r) => setTimeout(r, 500));
  return { ok: true, message } as AdminResult;
};
/** Mock admin actions: succeed after a short delay, change nothing. */
export const MOCK_PEOPLE_ACTIONS: PeopleActions = {
  adminCreateUser: () => ok("Mock: login created (nothing was saved)."),
  adminSetRole: () => ok("Mock: role updated (nothing was saved)."),
  adminSetPassword: () => ok("Mock: password set (nothing was saved)."),
  adminResetMfa: () => ok("Mock: MFA reset (nothing was saved)."),
  adminRemoveUser: () => ok("Mock: login revoked (nothing was saved)."),
  adminSetAppAccess: () => ok("Mock: app access saved (nothing was saved)."),
  upsertPersonDetails: () => ok("Mock: details saved."),
};

/* ---------- Phase 2: checkboxes & radios ---------- */

/** Real FY27 milestones and action items (SI-001 tuck-in M&A machine). */
export const MOCK_MY_ITEMS: MyItem[] = [
  { id: "i1", text: "Tuck-in pipeline review with brand presidents", due: "2026-10-15", dueLabel: "Oct 15", done: false, pastDue: true },
  { id: "i2", text: "Integration playbook v1 signed off", due: "2026-11-01", dueLabel: "Nov 1", done: false, pastDue: false },
  { id: "i3", text: "Hire integration lead", due: "2026-09-30", dueLabel: "Sep 30", done: true, pastDue: false },
];
