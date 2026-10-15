// All V2 mock data lives here (plus review-content.ts for the review pages).
// Static TypeScript only: no Prisma reads or writes. SIs come from FY27_PLAN so
// the mock always uses the real 26 FY27 initiatives.
import { FY27_PLAN } from "@/lib/fy27-plan";
import type {
  EltAsk,
  InitiativeUpdate,
  MockActionItem,
  MockArea,
  MockMilestone,
  MockSi,
  Person,
  SiStatus,
  UpdateState,
} from "./types";

/** Fixed "today" so the mock renders identically on server and client. */
export const MOCK_TODAY = "2026-10-14";

/** The signed-in person the personal pages pretend to be. */
export const MOCK_CURRENT_USER_ID = "kyle-sullivan";

export const PEOPLE: Person[] = [
  { id: "ryan-mckendry", name: "Ryan McKendry", kind: "person" },
  { id: "ryan-olin", name: "Ryan Olin", kind: "person" },
  { id: "dan-yankley", name: "Dan Yankley", kind: "person" },
  { id: "justin-ridgeway", name: "Justin Ridgeway", kind: "person" },
  { id: "danny-bradford", name: "Danny Bradford", kind: "person" },
  { id: "tom-chess", name: "Tom Chess", kind: "person" },
  { id: "dave-galford", name: "Dave Galford", kind: "person" },
  { id: "david-reed", name: "David Reed", kind: "person" },
  { id: "curt-stark", name: "Curt Stark", kind: "person" },
  { id: "bart-williams", name: "Bart Williams", kind: "person" },
  { id: "david-jensen", name: "David Jensen", kind: "person" },
  { id: "kyle-sullivan", name: "Kyle Sullivan", kind: "person" },
  { id: "carter-achilles", name: "Carter Achilles", kind: "person" },
  { id: "mohan-chandolu", name: "Mohan Chandolu", kind: "person" },
  { id: "adam-hamdan", name: "Adam Hamdan", kind: "person" },
  { id: "kyle-campbell", name: "Kyle Campbell", kind: "person" },
  { id: "lee-sims", name: "Lee Sims", kind: "person" },
  { id: "brett-hawks", name: "Brett Hawks", kind: "person" },
  { id: "alex-bevington", name: "Alex Bevington", kind: "person" },
  { id: "jester", name: "Jester", kind: "person" },
  { id: "millares", name: "Millares", kind: "person" },
  { id: "nelson", name: "Nelson", kind: "person" },
  { id: "jakob", name: "Jakob", kind: "person" },
  { id: "jazzy", name: "Jazzy", kind: "person" },
  { id: "hannah", name: "Hannah (FP&A)", kind: "person" },
  { id: "fpa", name: "FP&A", kind: "team" },
  { id: "pi-working-group", name: "PI working group", kind: "team" },
];

const PEOPLE_BY_ID = new Map(PEOPLE.map((p) => [p.id, p]));
const PEOPLE_BY_NAME = new Map(PEOPLE.map((p) => [p.name, p]));

export function personById(id: string | null | undefined): Person | undefined {
  return id ? PEOPLE_BY_ID.get(id) : undefined;
}
export function personName(id: string | null | undefined): string {
  return personById(id)?.name ?? "TBD";
}

// ---------------------------------------------------------------- areas

const AREA_OWNERS: Record<string, { elt: string[]; leads: string[]; number?: number }> = {
  "M&A": { elt: ["ryan-mckendry"], leads: ["curt-stark", "bart-williams"], number: 1 },
  GROW: { elt: ["ryan-olin"], leads: ["david-jensen"], number: 2 },
  RETENTION: { elt: ["dan-yankley", "justin-ridgeway"], leads: ["kyle-sullivan"], number: 3 },
  TREVPAR: { elt: ["danny-bradford"], leads: ["carter-achilles"], number: 4 },
  MARGIN: { elt: ["dan-yankley", "justin-ridgeway"], leads: ["kyle-sullivan"], number: 5 },
  TECH: { elt: ["tom-chess"], leads: ["mohan-chandolu"] },
  TALENT: { elt: ["dave-galford", "adam-hamdan"], leads: ["dave-galford", "adam-hamdan"] },
  FINANCE: { elt: ["david-reed"], leads: ["kyle-campbell"] },
  MARKETING: { elt: ["danny-bradford"], leads: ["lee-sims"] },
  GUEST: { elt: ["dan-yankley", "justin-ridgeway"], leads: ["kyle-sullivan"] },
};

export const AREAS: MockArea[] = FY27_PLAN.areas.map((a) => ({
  code: a.code,
  name: a.name,
  kind: a.kind,
  number: AREA_OWNERS[a.code]?.number,
  goal: a.goal,
  kpiName: "kpiName" in a ? a.kpiName : undefined,
  kpiTarget: "kpiTarget" in a ? a.kpiTarget : undefined,
  eltOwnerIds: AREA_OWNERS[a.code]?.elt ?? [],
  siLeadIds: AREA_OWNERS[a.code]?.leads ?? [],
}));

// ------------------------------------------------------------------ SIs

const EXTRA_RISKS: Record<string, string[]> = {
  "FY27-SI-003": ["BDM turnover during the Summit org changes could reset coaching baselines"],
  "FY27-SI-008": ["Intervention list is based on one month of churn; small shops swing wildly"],
  "FY27-SI-012": ["Cost data is not yet de-averaged by shop, so targets could be set on the wrong base"],
  "FY27-SI-014": ["Value capture depends on shops actually redeploying freed capacity"],
  "FY27-SI-025": ["No stated return goal for the Conduit investment yet"],
};

const DEPENDENCIES: Record<string, { siCode?: string; text: string }[]> = {
  "FY27-SI-001": [
    { siCode: "FY27-SI-015", text: "Tuck-in Automation delivers the pre-LOI module and portal intake" },
    { siCode: "FY27-SI-002", text: "M&A hiring list gates capacity on large deals" },
  ],
  "FY27-SI-002": [{ siCode: "FY27-SI-001", text: "Hiring plan assumes tuck-in volume scales as targeted" }],
  "FY27-SI-003": [{ siCode: "FY27-SI-004", text: "Call scoring needs the BD scorecard metric definitions" }],
  "FY27-SI-004": [{ text: "Domo dashboard rebuild (Data team)" }],
  "FY27-SI-007": [{ siCode: "FY27-SI-008", text: "Brand interventions are chosen from the scorecard" }],
  "FY27-SI-008": [{ siCode: "FY27-SI-007", text: "Needs the monthly scorecard to target the right shops" }],
  "FY27-SI-010": [{ siCode: "FY27-SI-009", text: "Listing hygiene feeds the pricing anomaly model" }],
  "FY27-SI-012": [
    { siCode: "FY27-SI-013", text: "Needs the validated, de-averaged cost base" },
    { siCode: "FY27-SI-022", text: "Regional FP&A model supports shop-level targets" },
  ],
  "FY27-SI-013": [{ text: "FP&A cost data de-averaged by shop and cost line (7 Nov)" }],
  "FY27-SI-014": [{ siCode: "FY27-SI-025", text: "Shares the Conduit rollout waves with Guest Experience" }],
  "FY27-SI-015": [{ siCode: "FY27-SI-001", text: "Built to the tuck-in process M&A is standing up" }],
  "FY27-SI-025": [{ siCode: "FY27-SI-014", text: "Value capture measure sits with Tech & AI" }],
};

function ownerIdFor(name: string): string | null {
  return PEOPLE_BY_NAME.get(name)?.id ?? null;
}

export const SIS: MockSi[] = FY27_PLAN.initiatives.map((i) => {
  const valueMetric = "valueMetric" in i ? i.valueMetric : undefined;
  const valueTarget = "valueTarget" in i ? i.valueTarget : undefined;
  const risks: string[] = "risks" in i && i.risks ? [...i.risks] : [];
  risks.push(...(EXTRA_RISKS[i.code] ?? []));
  return {
    code: i.code,
    name: i.name,
    areaCode: i.areaCode,
    objective: i.objective,
    goingFor: valueMetric
      ? `${valueMetric}${valueTarget ? `: ${valueTarget}` : " (target to be defined)"}`
      : "Metric and target not yet defined. Owner to propose before the November review.",
    valueMetric,
    valueTarget,
    ownerId: ownerIdFor(i.owner),
    sponsorLabel: i.sponsor,
    risks,
    dependencies: DEPENDENCIES[i.code] ?? [],
  };
});

// ------------------------------------------------------- monthly updates

function upd(
  siCode: string,
  period: string,
  state: UpdateState,
  status: SiStatus | null,
  latestProgress: string,
  whatNext: string,
  when?: string,
): InitiativeUpdate {
  const owner = SIS.find((s) => s.code === siCode)?.ownerId ?? null;
  return {
    id: `${period}:${siCode}`,
    siCode,
    period,
    authorId: owner,
    status,
    latestProgress,
    whatNext,
    state,
    submittedAt: state === "SUBMITTED" ? when : undefined,
    updatedAt: when,
  };
}

const SEP = "2026-09";
const AUG = "2026-08";

export const INITIATIVE_UPDATES: InitiativeUpdate[] = [
  // ---- September 2026 (period in draft: updates are due 16 Oct)
  upd("FY27-SI-001", SEP, "SUBMITTED", "ON_TRACK", "Four closes in September (942 units, $6.8M). Three tuck-in LOIs went out in the first two weeks of October. Median LOI-to-close still ~77 days.", "Pre-LOI module live 30 Oct; first deals run end to end through the new process by 15 Nov.", "2026-10-12"),
  upd("FY27-SI-002", SEP, "SUBMITTED", "ON_TRACK", "Role scorecards agreed with Ryan; two search firms shortlisted.", "Lock the M&A hiring list 20 Oct and kick off searches 1 Nov.", "2026-10-11"),
  upd("FY27-SI-003", SEP, "SUBMITTED", "AT_RISK", "Battle cards 80% built; coaching baseline slipped a week because of BDM travel. CAC is the open issue ($7,639 vs $4,938 budget).", "Finish battle cards by 15 Oct, then AI roleplay and weekly coaching live 15 Nov.", "2026-10-13"),
  upd("FY27-SI-004", SEP, "DRAFT", "ON_TRACK", "V1 metric definitions drafted; waiting on Domo dashboard rebuild.", "Review definitions with Ryan Olin and publish the scorecard by rep 15 Nov.", "2026-10-13"),
  upd("FY27-SI-006", SEP, "SUBMITTED", "ON_TRACK", "ORM talent rollout continues: 11 of 14 planned role changes complete.", "Close out the remaining three role changes before the Summit.", "2026-10-12"),
  upd("FY27-SI-007", SEP, "DRAFT", "ON_TRACK", "Scorecard v1 built from the ORM data; correlation with retention is being tested.", "Agree the GBV churn definition with Finance and circulate the first monthly scorecard.", "2026-10-13"),
  upd("FY27-SI-009", SEP, "SUBMITTED", "ON_TRACK", "Listing performance dashboard live; highest-GBV 2,000 listings audited, 61% fixed.", "Extend the audit to the next 4,000 listings and report conversion lift.", "2026-10-10"),
  upd("FY27-SI-010", SEP, "SUBMITTED", "AHEAD", "AI revenue manager pilot data set built a week early; first anomaly detections look credible.", "30-day pilot live 31 Oct; host in the Awayday environment by 31 Dec.", "2026-10-11"),
  upd("FY27-SI-012", SEP, "SUBMITTED", "AT_RISK", "Zero-based labor review started in six shops; cost base is still averaged so targets cannot be set per shop.", "Five PI priorities sized and target agreed 23 Nov; shop PI targets set by 31 Dec.", "2026-10-13"),
  upd("FY27-SI-013", SEP, "DRAFT", "ON_TRACK", "Validated cost base for 40 of 64 shops.", "Finish all shops and cost lines by 24 Oct, then publish unit-level profitability view.", "2026-10-13"),
  upd("FY27-SI-014", SEP, "SUBMITTED", "ON_TRACK", "Wave 2 shops live; properties per FTE in guest services now 1:78 in wave 1 shops.", "Conduit scorecard at the October review; sequence next wave in November.", "2026-10-09"),
  upd("FY27-SI-015", SEP, "SUBMITTED", "AHEAD", "Portal intake and pre-LOI screening both demoed to M&A.", "Working automation tool ready for pilot 31 Oct.", "2026-10-12"),
  upd("FY27-SI-018", SEP, "DRAFT", "ON_TRACK", "Close automation scoped; Accounting Excellence org design in review.", "Confirm vendor choice and resourcing.", "2026-10-12"),
  upd("FY27-SI-023", SEP, "SUBMITTED", "ON_TRACK", "9-box complete for the marketing team; two coach-or-exit conversations held.", "Open the two external hires approved for Q4.", "2026-10-08"),
  upd("FY27-SI-024", SEP, "DRAFT", "ON_TRACK", "AI audit agent running on three brands.", "Roll to the next ten brands and track organic traffic.", "2026-10-12"),
  upd("FY27-SI-025", SEP, "SUBMITTED", "AT_RISK", "Wave 2 went live 5 Oct for 12 brands (7 live, 18 in rollout). Benefit is uneven and there is still no stated return goal.", "Agree the return goal with Dan and Justin; Conduit scorecard 31 Oct.", "2026-10-13"),
  // ---- August 2026 (published)
  upd("FY27-SI-001", AUG, "SUBMITTED", "ON_TRACK", "Three closes in August; pipeline rebuilt after the Summer slowdown.", "Stand up the pre-LOI module and cut median days to close.", "2026-09-14"),
  upd("FY27-SI-002", AUG, "SUBMITTED", "ON_TRACK", "Org options reviewed with Ryan; roles drafted.", "Agree scorecards and shortlist search firms.", "2026-09-13"),
  upd("FY27-SI-003", AUG, "SUBMITTED", "ON_TRACK", "Battle card format agreed; Domo rebuild requested.", "Build brand-specific cards and set the coaching baseline.", "2026-09-15"),
  upd("FY27-SI-006", AUG, "SUBMITTED", "ON_TRACK", "Eight of 14 role changes done.", "Complete the remaining role changes by October.", "2026-09-14"),
  upd("FY27-SI-007", AUG, "SUBMITTED", "AT_RISK", "Data pull from ORM tooling slower than planned.", "Build scorecard v1 in September.", "2026-09-15"),
  upd("FY27-SI-009", AUG, "SUBMITTED", "ON_TRACK", "Dashboard in UAT; audit approach agreed.", "Audit the first 2,000 listings.", "2026-09-12"),
  upd("FY27-SI-010", AUG, "SUBMITTED", "ON_TRACK", "Vendor and data requirements confirmed.", "Build the pilot data set.", "2026-09-12"),
  upd("FY27-SI-012", AUG, "SUBMITTED", "ON_TRACK", "Procurement and labor workstreams scoped.", "Start zero-based labor reviews in six shops.", "2026-09-15"),
  upd("FY27-SI-014", AUG, "SUBMITTED", "ON_TRACK", "Wave 1 results on track.", "Launch wave 2.", "2026-09-10"),
  upd("FY27-SI-015", AUG, "SUBMITTED", "ON_TRACK", "Requirements signed off by M&A.", "Demo portal intake and screening.", "2026-09-11"),
  upd("FY27-SI-023", AUG, "SUBMITTED", "ON_TRACK", "9-box in progress.", "Complete 9-box and open external roles.", "2026-09-09"),
  upd("FY27-SI-025", AUG, "SUBMITTED", "ON_TRACK", "Wave 1 complete; wave 2 brands confirmed.", "Go live with wave 2 on 5 Oct.", "2026-09-14"),
];

export function updatesForSi(siCode: string): InitiativeUpdate[] {
  return INITIATIVE_UPDATES.filter((u) => u.siCode === siCode).sort((a, b) => b.period.localeCompare(a.period));
}

export function updateFor(siCode: string, period: string): InitiativeUpdate | undefined {
  return INITIATIVE_UPDATES.find((u) => u.siCode === siCode && u.period === period);
}

// ------------------------------------------------------------ milestones

let mid = 0;
function ms(
  kind: MockMilestone["kind"],
  pillar: string,
  title: string,
  date: string,
  ownerIds: string[],
  extra: Partial<MockMilestone> = {},
): MockMilestone {
  mid += 1;
  return { id: `m-${String(mid).padStart(2, "0")}`, kind, pillar, title, date, ownerIds, done: false, ...extra };
}

export const MILESTONES: MockMilestone[] = [
  ms("SI", "GUEST", "Conduit Wave 2 live, 12 brands", "2026-10-05", ["kyle-sullivan"], { siCode: "FY27-SI-025" }),
  ms("SI_PROCESS", "ALL", "Phase 1 complete: 2027 goals, one objective and metric per area", "2026-10-08", ["alex-bevington", "dan-yankley", "ryan-mckendry"], { done: true }),
  ms("SI", "M&A", "CooperWynn PM close; Stay Newport seller kickoff", "2026-10-13", ["curt-stark"], { siCode: "FY27-SI-001" }),
  ms("SI", "GROW", "Battle cards; coaching baseline; Domo dashboard rebuilt; V1 metric definitions", "2026-10-15", ["jester", "millares", "nelson"], { siCode: "FY27-SI-003" }),
  ms("ALL", "TALENT", "Wave 2 (Regional VP roles) interviews and offers begin", "2026-10-16", ["adam-hamdan"]),
  ms("SI", "M&A", "M&A hiring list locked", "2026-10-20", ["ryan-mckendry"], { siCode: "FY27-SI-002" }),
  ms("ALL", "TALENT", "1:1s with directly affected leaders ahead of Summit", "2026-10-23", ["dan-yankley"]),
  ms("SI", "MARGIN", "Validated cost base, all shops and cost lines", "2026-10-24", ["jazzy", "hannah"], { siCode: "FY27-SI-013" }),
  ms("ALL", "ALL", "Awayday Summit; org design and Regional President / SVP appointments 28 Oct; Equity for All announced", "2026-10-27", ["jakob", "dan-yankley", "alex-bevington", "david-reed"], { endDate: "2026-10-29" }),
  ms("SI", "TREVPAR", "Vrbo flat 12% commission takes effect for PMS-connected hosts", "2026-10-29", ["danny-bradford"], { siCode: "FY27-SI-011" }),
  ms("SI", "M&A", "Tuck-in pre-LOI module live", "2026-10-30", ["curt-stark", "mohan-chandolu"], { siCode: "FY27-SI-001" }),
  ms("SI", "TREVPAR", "AI revenue manager 30-day pilot live", "2026-10-31", ["carter-achilles"], { siCode: "FY27-SI-010" }),
  ms("SI_PROCESS", "ALL", "Phase 2 complete: every SI on a charter", "2026-10-31", ["alex-bevington"]),
  ms("SI", "TECH", "Conduit scorecard at the October review", "2026-10-31", ["mohan-chandolu"], { siCode: "FY27-SI-014" }),
  ms("SI", "TECH", "Working automation tool ready for pilot", "2026-10-31", ["mohan-chandolu"], { siCode: "FY27-SI-015" }),
  ms("SI", "M&A", "M&A searches kicked off", "2026-11-01", ["ryan-mckendry"], { siCode: "FY27-SI-002" }),
  ms("SI_PROCESS", "ALL", "Phase 3: charters in the SI tool; bi-weekly ELT SI review starts", "2026-11-01", ["alex-bevington"]),
  ms("SI", "M&A", "CT Brothers close; Escape to Blue Ridge targeting early November", "2026-11-03", ["curt-stark"], { siCode: "FY27-SI-001" }),
  ms("SI", "MARGIN", "Cost data de-averaged by shop and cost line", "2026-11-07", ["fpa"], { siCode: "FY27-SI-013" }),
  ms("SI", "M&A", "First deals end to end through the tuck-in process", "2026-11-15", ["curt-stark"], { siCode: "FY27-SI-001" }),
  ms("SI", "GROW", "BD scorecard live by rep", "2026-11-15", ["millares"], { siCode: "FY27-SI-004" }),
  ms("SI", "GROW", "AI roleplay and weekly coaching live", "2026-11-15", ["nelson"], { siCode: "FY27-SI-003" }),
  ms("ALL", "TALENT", "Regional SVP offers", "2026-11-20", ["jakob", "dan-yankley"]),
  ms("SI", "MARGIN", "Five PI priorities sized and target number agreed", "2026-11-23", ["pi-working-group"], { siCode: "FY27-SI-012" }),
  ms("SI", "GUEST", "Conduit next wave sequenced; Breezeway lands", "2026-11-30", ["kyle-sullivan"], { siCode: "FY27-SI-025", approxLabel: "Nov" }),
  ms("SI", "FINANCE", "Regional FP&A go-ahead; Board update", "2026-11-30", ["kyle-campbell"], { siCode: "FY27-SI-022", approxLabel: "Nov" }),
  ms("SI", "GROW", "Call Scores live; 10 hrs/week per BDM reclaimed; scorecard correlated to conversion", "2026-12-15", ["nelson", "jester"], { siCode: "FY27-SI-003" }),
  ms("SI", "M&A", "Analysis-to-close at 30 to 45 days", "2026-12-31", ["curt-stark"], { siCode: "FY27-SI-001" }),
  ms("SI", "MARGIN", "Shop PI targets set", "2026-12-31", ["kyle-sullivan"], { siCode: "FY27-SI-012" }),
  ms("ALL", "TALENT", "TA team and 4 HRBPs in place", "2026-12-31", ["dave-galford"]),
  ms("SI", "TREVPAR", "AI revenue manager hosted in Awayday environment", "2026-12-31", ["carter-achilles"], { siCode: "FY27-SI-010" }),
  ms("SI", "RETENTION", "Complete the ORM talent rollout already underway", "2026-10-30", ["kyle-sullivan"], { siCode: "FY27-SI-006" }),
  ms("SI", "RETENTION", "First monthly retention scorecard circulated", "2026-11-10", ["kyle-sullivan"], { siCode: "FY27-SI-007" }),
];

export const ACTION_ITEMS: MockActionItem[] = [
  { id: "a-01", siCode: "FY27-SI-025", ownerId: "kyle-sullivan", text: "Draft the return goal for the Conduit investment and share with Dan and Justin", due: "2026-10-22", done: false },
  { id: "a-02", siCode: "FY27-SI-008", ownerId: "kyle-sullivan", text: "List the six worst churn shops with an intervention owner for each", due: "2026-10-28", done: false },
  { id: "a-03", siCode: "FY27-SI-007", ownerId: "kyle-sullivan", text: "Confirm GBV churn definition with Finance", due: "2026-10-20", done: false },
  { id: "a-04", siCode: "FY27-SI-012", ownerId: "kyle-sullivan", text: "Review Track markup fix result in the six negative-OTA shops", due: "2026-10-16", done: false },
  { id: "a-05", siCode: "FY27-SI-026", ownerId: "kyle-sullivan", text: "Draft cleaning and maintenance standard v0 for the Summit", due: "2026-10-25", done: false },
  { id: "a-06", siCode: "FY27-SI-006", ownerId: "kyle-sullivan", text: "Send updated ORM role map to People team", due: "2026-10-09", done: true },
  { id: "a-07", siCode: "FY27-SI-003", ownerId: "david-jensen", text: "Explain CAC variance ($7,639 vs $4,938) at the review", due: "2026-10-20", done: false },
  { id: "a-08", siCode: "FY27-SI-001", ownerId: "curt-stark", text: "Brief ELT on Natural Retreats and Parrish inbound approach", due: "2026-10-20", done: false },
  { id: "a-09", siCode: "FY27-SI-009", ownerId: "carter-achilles", text: "Share the listing audit method with Marketing", due: "2026-10-21", done: false },
  { id: "a-10", siCode: "FY27-SI-018", ownerId: "brett-hawks", text: "Draft the Accounting Excellence org chart", due: "2026-10-30", done: false },
];

export const ELT_ASKS: EltAsk[] = [
  { id: "k-01", siCode: "FY27-SI-025", fromId: "dan-yankley", text: "What return do we expect from Conduit, and how will we know by Q1? We need a number before wave 3.", raisedOn: "2026-10-08", due: "2026-10-22", open: true },
  { id: "k-02", siCode: "FY27-SI-008", fromId: "justin-ridgeway", text: "Avada is bad on both churn views (43% annualized in Sept, 47% LTM). What is the plan?", raisedOn: "2026-10-09", due: "2026-10-28", open: true },
  { id: "k-03", siCode: "FY27-SI-012", fromId: "dan-yankley", text: "Size the five PI priorities and agree the target number by 23 Nov.", raisedOn: "2026-10-09", due: "2026-11-23", open: true },
  { id: "k-04", siCode: "FY27-SI-007", fromId: "dan-yankley", text: "Show that the scorecard correlates with retention before we distribute it.", raisedOn: "2026-10-09", due: "2026-11-10", open: true },
  { id: "k-05", siCode: "FY27-SI-003", fromId: "ryan-olin", text: "Own the CAC explanation: third month running over budget.", raisedOn: "2026-10-10", due: "2026-10-20", open: true },
  { id: "k-06", siCode: "FY27-SI-001", fromId: "ryan-mckendry", text: "What senior time do Natural Retreats and Parrish need, and what would each add to FY27?", raisedOn: "2026-10-10", due: "2026-10-20", open: true },
  { id: "k-07", siCode: "FY27-SI-010", fromId: "danny-bradford", text: "Define the success measure for the 30-day pilot before it starts.", raisedOn: "2026-10-12", due: "2026-10-30", open: true },
  { id: "k-08", siCode: "FY27-SI-018", fromId: "david-reed", text: "Confirm close time path: 6 days now, 5 by EOY.", raisedOn: "2026-10-12", due: "2026-10-30", open: true },
  { id: "k-09", siCode: "FY27-SI-014", fromId: "tom-chess", text: "Publish properties-per-FTE for wave 1 and 2 shops side by side.", raisedOn: "2026-10-05", due: "2026-10-31", open: true },
  { id: "k-10", siCode: "FY27-SI-026", fromId: "justin-ridgeway", text: "Propose a standard that ties to review score, with a floor.", raisedOn: "2026-10-07", open: false },
];
