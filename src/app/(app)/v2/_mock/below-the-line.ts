// "Below the line": the smaller projects junior teams run that feed the SIs.
// The MVP only promises this view ("coming"), so every project here is
// invented for the mock. Owners are roles, not named people.

export type BtlStatus = "NOT_STARTED" | "ON_TRACK" | "AT_RISK" | "BLOCKED" | "DONE";

export type BtlProject = {
  id: string;
  /** Area code (pillar or enabler). */
  areaCode: string;
  name: string;
  /** SI this feeds. Null where the area has no SI yet (Talent). */
  siCode: string | null;
  /** One line on how it feeds the SI. */
  feeds: string;
  team: string;
  owner: string;
  status: BtlStatus;
  /** ISO date of the next checkpoint or due date. */
  due: string;
};

let n = 0;
function p(
  areaCode: string,
  siCode: string | null,
  name: string,
  feeds: string,
  team: string,
  owner: string,
  status: BtlStatus,
  due: string,
): BtlProject {
  n += 1;
  return { id: `btl-${String(n).padStart(2, "0")}`, areaCode, siCode, name, feeds, team, owner, status, due };
}

export const BTL_PROJECTS: BtlProject[] = [
  // M&A
  p("M&A", "FY27-SI-001", "Deal-room data checklist template", "Standardises diligence requests so pre-LOI screening takes days, not weeks", "M&A analysts", "Senior analyst", "ON_TRACK", "2026-10-23"),
  p("M&A", "FY27-SI-001", "Seller kickoff pack and FAQ", "Cuts the back-and-forth in the first week after an LOI", "M&A analysts", "Associate", "DONE", "2026-10-09"),
  p("M&A", "FY27-SI-001", "Day-one integration checklist v2", "Feeds the integration-time target for tuck-ins", "Integration team", "Integration manager", "AT_RISK", "2026-11-06"),
  p("M&A", "FY27-SI-002", "Recruiter shortlist tracker", "Keeps the four M&A hires on one view during searches", "M&A analysts", "Associate", "ON_TRACK", "2026-11-01"),
  // Grow New Units
  p("GROW", "FY27-SI-003", "Brand battle-card refresh (12 brands)", "Content for the battle cards milestone due 15 Oct", "BD enablement", "Enablement specialist", "ON_TRACK", "2026-10-15"),
  p("GROW", "FY27-SI-003", "Call-scoring prompt tuning", "Raises accuracy before Call Scores go live in December", "BD enablement", "Sales ops analyst", "AT_RISK", "2026-11-20"),
  p("GROW", "FY27-SI-004", "CRM lead-source tagging cleanup", "Clean source data for the BD scorecard by rep", "Sales ops", "CRM admin", "ON_TRACK", "2026-10-30"),
  p("GROW", "FY27-SI-004", "Domo BD funnel tiles", "Funnel view the scorecard needs", "Data team", "BI developer", "BLOCKED", "2026-11-15"),
  p("GROW", "FY27-SI-005", "Owner referral one-pager", "First asset for the standardised referral programme", "BD enablement", "Enablement specialist", "NOT_STARTED", "2026-12-01"),
  // Owner Retention
  p("RETENTION", "FY27-SI-006", "ORM onboarding playbook v1", "Speeds up new-hire ramp as role changes land", "Owner relations", "ORM team lead", "DONE", "2026-10-02"),
  p("RETENTION", "FY27-SI-007", "Zendesk tagging for revenue disputes", "Tests whether revenue really is the main churn driver", "Support ops", "Support analyst", "ON_TRACK", "2026-10-30"),
  p("RETENTION", "FY27-SI-007", "Churn-reason capture form", "Gives the scorecard a reason code per churned unit", "Owner relations", "ORM team lead", "NOT_STARTED", "2026-11-10"),
  p("RETENTION", "FY27-SI-008", "Avada owner-call sprint", "First targeted intervention on the worst churn brand", "Owner relations", "Regional ORM", "AT_RISK", "2026-10-28"),
  // TRevPAR
  p("TREVPAR", "FY27-SI-009", "Photo-order audit, top 2,000 listings", "Part of the listing hygiene fix", "Revenue management", "Revenue analyst", "ON_TRACK", "2026-10-31"),
  p("TREVPAR", "FY27-SI-009", "Minimum-stay rule cleanup", "Removes stale restrictions that suppress occupancy", "Revenue management", "Revenue analyst", "DONE", "2026-10-06"),
  p("TREVPAR", "FY27-SI-010", "Gap-night pricing test in 3 markets", "Evidence for the AI revenue manager pilot", "Revenue management", "Pricing analyst", "ON_TRACK", "2026-10-31"),
  p("TREVPAR", "FY27-SI-011", "Vrbo 12% commission impact model", "Sizes the channel mix effect before 29 Oct", "Revenue management", "Pricing analyst", "AT_RISK", "2026-10-27"),
  // Margin
  p("MARGIN", "FY27-SI-012", "Cleaning labor hours per turn benchmark", "Baseline for the zero-based labor programme", "Shop finance", "Shop accountant", "ON_TRACK", "2026-11-06"),
  p("MARGIN", "FY27-SI-012", "Linen supplier price comparison", "Procurement programme quick win", "Procurement", "Procurement analyst", "AT_RISK", "2026-11-13"),
  p("MARGIN", "FY27-SI-013", "Maintenance margin report by shop", "Shows where maintenance loses money (-33% vs -12% budget)", "FP&A", "FP&A analyst", "ON_TRACK", "2026-10-30"),
  p("MARGIN", "FY27-SI-013", "Cost-line mapping, first 12 shops", "Needs the de-averaged cost data due 7 Nov", "FP&A", "FP&A analyst", "BLOCKED", "2026-11-07"),
  // Tech & AI
  p("TECH", "FY27-SI-014", "Conduit wave 3 shop readiness checklist", "Gates which shops can go live next", "Product ops", "Product ops manager", "ON_TRACK", "2026-11-20"),
  p("TECH", "FY27-SI-015", "Portal intake form v1", "Seller-facing intake for the tuck-in tool", "Engineering", "Software engineer", "ON_TRACK", "2026-10-30"),
  p("TECH", "FY27-SI-016", "Owner statement explainer prompt tests", "First test set for automated revenue explanations", "Engineering", "ML engineer", "NOT_STARTED", "2026-12-01"),
  p("TECH", "FY27-SI-017", "Single sign-on cleanup for ops tools", "Removes shared logins from the shared foundation", "IT", "IT engineer", "AT_RISK", "2026-11-27"),
  // Talent (no SIs in the plan yet)
  p("TALENT", null, "Regional VP job descriptions", "Supports the Wave 2 interviews starting 16 Oct", "People team", "HR business partner", "DONE", "2026-10-09"),
  p("TALENT", null, "HRBP intake and triage process", "Needed before the four HRBPs start", "People team", "People ops lead", "ON_TRACK", "2026-11-13"),
  p("TALENT", null, "ORM role map hand-off", "Feeds the Summit org design", "People team", "People ops lead", "DONE", "2026-10-09"),
  p("TALENT", null, "1:1 scheduling for affected leaders", "Ahead of the Summit on 27-29 Oct", "People team", "Coordinator", "ON_TRACK", "2026-10-23"),
  // Finance
  p("FINANCE", "FY27-SI-018", "Bank reconciliation templates", "First step in automating the close (6 days to 5)", "Accounting", "Staff accountant", "ON_TRACK", "2026-11-06"),
  p("FINANCE", "FY27-SI-020", "Forecast variance report prototype", "Baseline for forecast accuracy", "FP&A", "FP&A analyst", "NOT_STARTED", "2026-11-20"),
  p("FINANCE", "FY27-SI-021", "Leader dashboard feedback sessions", "Finds what leaders cannot act on in today's numbers", "FP&A", "FP&A analyst", "ON_TRACK", "2026-11-10"),
  p("FINANCE", "FY27-SI-022", "Regional FP&A role scoping", "Waiting on the Summit org decisions", "FP&A", "FP&A manager", "BLOCKED", "2026-11-03"),
  // Marketing
  p("MARKETING", "FY27-SI-023", "9-box calibration sheet", "Output of the team 9-box review", "Marketing", "Marketing ops lead", "DONE", "2026-10-08"),
  p("MARKETING", "FY27-SI-024", "SEO audit agent prompt library", "Prompts the audit agent runs on each new brand", "Marketing", "SEO specialist", "ON_TRACK", "2026-10-30"),
  p("MARKETING", "FY27-SI-024", "Direct-booking landing page tests", "Supports direct GBV growth (FY27 +40%)", "Marketing", "Web analyst", "NOT_STARTED", "2026-11-17"),
  // Guest experience
  p("GUEST", "FY27-SI-025", "Conduit uplift tracking sheet by brand", "Shows which brands see benefit (uneven today)", "Guest services", "Guest services analyst", "ON_TRACK", "2026-10-31"),
  p("GUEST", "FY27-SI-025", "Review score feed into the Flash", "Fixes the missing September score", "FP&A", "FP&A analyst", "AT_RISK", "2026-11-09"),
  p("GUEST", "FY27-SI-026", "Beach Retreats review reply sprint", "Weakest brand at 4.06, under the 4.5 floor", "Guest services", "Guest services lead", "AT_RISK", "2026-10-30"),
  p("GUEST", "FY27-SI-026", "Cleaning inspection checklist pilot", "Draft of the cleaning standard for the Summit", "Operations", "Regional ops coordinator", "NOT_STARTED", "2026-11-12"),
];

export const BTL_STATUS_LABEL: Record<BtlStatus, string> = {
  NOT_STARTED: "Not started",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  BLOCKED: "Blocked",
  DONE: "Done",
};
