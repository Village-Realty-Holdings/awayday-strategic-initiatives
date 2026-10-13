import type { InitiativeStatus } from "@/generated/prisma/client";

export type Fy27Area = {
  code: string;
  kind: "VALUE_DRIVER" | "ENABLER";
  name: string;
  goal: string;
  kpiName?: string;
  kpiTarget?: string;
  owner: string;
  order: number;
};

export type Fy27Initiative = {
  code: string;
  sourceKey: string;
  name: string;
  areaCode: string;
  objective: string;
  valueMetric?: string;
  valueTarget?: string;
  owner: string;
  sponsor: string;
  status: InitiativeStatus;
  risks?: string[];
  milestones?: { title: string; dueAt?: string; owner?: string }[];
};

export const FY27_PLAN = {
  code: "FY27",
  title: "Awayday Strategic Initiatives — FY27",
  sourceFileName: "260930 Awayday SI Refresh_v1.pdf",
  areas: [
    { code: "M&A", kind: "VALUE_DRIVER", name: "M&A", goal: "Deepen our moat as the acquirer of choice in the industry, through the fastest and easiest acquisition process.", kpiName: "Acquired EBITDA closed", kpiTarget: "$26M total; $11M via tuck-ins", owner: "Ryan McKendry / Curt Stark", order: 1 },
    { code: "GROW", kind: "VALUE_DRIVER", name: "Grow New Units", goal: "Build the highest skilled, best trained and tech-enabled salesforce and sales management capability.", kpiName: "Gross unit adds", kpiTarget: "23% budget; 28% stretch", owner: "Ryan Olin / David Jensen", order: 2 },
    { code: "RETENTION", kind: "VALUE_DRIVER", name: "Owner Retention", goal: "Do the basics brilliantly to create the best owner experience, with an upskilled team that focuses on revenue, property care and owner comms every day.", kpiName: "Owner unit churn (TTM)", kpiTarget: "11% budget; 9% stretch", owner: "Dan Yankley / Justin Ridgeway / Kyle Sullivan", order: 3 },
    { code: "TREVPAR", kind: "VALUE_DRIVER", name: "TRevPAR Expansion", goal: "Deliver above market revenue outcomes for owners, that make them the best advocates for our brands.", kpiName: "TRevPAR growth", kpiTarget: "1% budget; 5% stretch", owner: "Danny Bradford / Carter Achilles", order: 4 },
    { code: "MARGIN", kind: "VALUE_DRIVER", name: "Margin Expansion", goal: "Create a day one cost culture with a winning ownership mindset in every part of Awayday, that makes us the most cost competitive business by managing to unit-level profitability.", kpiName: "Shop NOI margin vs PY", kpiTarget: "+0.25% budget; +1% stretch", owner: "Dan Yankley / Justin Ridgeway / Kyle Sullivan", order: 5 },
    { code: "TECH", kind: "ENABLER", name: "Tech & AI", goal: "Put frontier technology and AI in the hands of every team, so Awayday runs on a platform built for a $300M business.", owner: "Tom Chess / Mohan Chandolu", order: 1 },
    { code: "TALENT", kind: "ENABLER", name: "Talent", goal: "Build the strongest team in the industry, with the incentives, development and org design a $300M business needs.", owner: "Dave Galford / Adam Hamdan", order: 2 },
    { code: "FINANCE", kind: "ENABLER", name: "Finance", goal: "Close faster and give every leader numbers they can act on, underwriting industry-leading incentives that support our ambitions.", owner: "David Reed / Kyle Campbell", order: 3 },
    { code: "MARKETING", kind: "ENABLER", name: "Marketing", goal: "Build direct demand and brand strength that lowers what it costs us to win owners and guests.", kpiName: "Direct GBV growth (YoY)", kpiTarget: "40% YoY", owner: "Danny Bradford / Lee Sims", order: 4 },
    { code: "GUEST", kind: "ENABLER", name: "Guest Experience", goal: "Make every stay one a guest would book again, and tell someone about.", kpiName: "Guest satisfaction score", kpiTarget: "4.65 average; no brand under 4.5", owner: "Dan Yankley / Justin Ridgeway / Kyle Sullivan", order: 5 },
  ] satisfies Fy27Area[],
  initiatives: [
    { code: "FY27-SI-001", sourceKey: "m-and-a:tuck-in-machine", name: "Build tuck-in M&A machine", areaCode: "M&A", objective: "Cut analysis to close from 70–120 days down to 30–45 by year end so tuck-in volume, underwriting quality, conversion rates and post-integration outcomes improve.", valueMetric: "Analysis to close days", valueTarget: "30 days", owner: "Curt Stark", sponsor: "Ryan McKendry", status: "IN_PROGRESS", risks: ["Cycle time and deal quality may move in opposite directions", "Integration capacity may not scale with deal volume"], milestones: [{ title: "Pre-LOI module live for deal analysis", dueAt: "2026-10-30" }, { title: "First deals run end to end through the new process", dueAt: "2026-11-15" }, { title: "Analysis to close at 30 to 45 days", dueAt: "2026-12-31" }] },
    { code: "FY27-SI-002", sourceKey: "m-and-a:org-planning-talent", name: "Org planning and talent acquisition", areaCode: "M&A", objective: "Redesign the M&A organization and hire key roles so the team is not at capacity on large deals while tuck-in volume scales.", valueMetric: "# new M&A hires landed", valueTarget: "4 hired", owner: "Curt Stark", sponsor: "Ryan McKendry", status: "IN_PROGRESS", milestones: [{ title: "Job hiring list locked", dueAt: "2026-10-20", owner: "Ryan McKendry" }, { title: "Searches kicked off", dueAt: "2026-11-01", owner: "Ryan McKendry" }] },
    { code: "FY27-SI-003", sourceKey: "grow-new-units:bdm-enablement", name: "Talent: BDM and enablement leadership", areaCode: "GROW", objective: "Hire enablement leadership, upgrade BD manager talent, and improve call quality through coaching, call scoring and battlecards.", owner: "David Jensen", sponsor: "Ryan Olin", status: "IN_PROGRESS", milestones: [{ title: "Battle cards built and tailored to each brand", dueAt: "2026-10-15" }, { title: "Training and AI roleplay live", dueAt: "2026-11-15" }] },
    { code: "FY27-SI-004", sourceKey: "grow-new-units:bd-measurement", name: "BD measurement: leading and lagging scorecards", areaCode: "GROW", objective: "Create a balanced scorecard of leading and lagging quantitative and qualitative metrics so BD can identify what is working and proactively improve conversion.", valueMetric: "Leading indicators and conversion", owner: "David Jensen", sponsor: "Ryan Olin", status: "NOT_STARTED" },
    { code: "FY27-SI-005", sourceKey: "grow-new-units:brand-optimization", name: "BD Brand Optimization", areaCode: "GROW", objective: "Standardize and optimize growth channels including owner referrals, win-back programs, for-sale unit programs and employee referrals.", owner: "David Jensen", sponsor: "Ryan Olin", status: "NOT_STARTED" },
    { code: "FY27-SI-006", sourceKey: "owner-retention:talent-upgrades", name: "Talent upgrades", areaCode: "RETENTION", objective: "Upgrade owner-relations talent because top-grade ORMs are the single biggest lever on churn.", owner: "Kyle Sullivan", sponsor: "Dan Yankley / Justin Ridgeway", status: "IN_PROGRESS", milestones: [{ title: "Complete the rollout already underway" }] },
    { code: "FY27-SI-007", sourceKey: "owner-retention:scorecard", name: "Scorecard and GBV churn measurement", areaCode: "RETENTION", objective: "Distribute one monthly scorecard that correlates with retention so every shop can see where it stands and what to do.", valueMetric: "GBV churn (TTM)", valueTarget: "To be defined", owner: "Kyle Sullivan", sponsor: "Dan Yankley / Justin Ridgeway", status: "IN_PROGRESS" },
    { code: "FY27-SI-008", sourceKey: "owner-retention:brand-interventions", name: "Underperforming brand interventions", areaCode: "RETENTION", objective: "Fix the small number of shops carrying most of the churn through targeted, high-NOI-impact interventions.", owner: "Kyle Sullivan", sponsor: "Dan Yankley / Justin Ridgeway", status: "NOT_STARTED" },
    { code: "FY27-SI-009", sourceKey: "trevpar:listing-optimization", name: "Listing page optimization", areaCode: "TREVPAR", objective: "Systematically fix listing hygiene across 18,000 units using the listing performance dashboard, starting with the highest-GBV listings.", owner: "Carter Achilles", sponsor: "Danny Bradford", status: "IN_PROGRESS" },
    { code: "FY27-SI-010", sourceKey: "trevpar:ai-revenue-manager", name: "AI revenue manager", areaCode: "TREVPAR", objective: "Increase revenue manager capacity and performance by finding pricing anomalies, optimizing gap nights and providing elasticity insight.", valueMetric: "Properties per FTE", valueTarget: "1:600", owner: "Carter Achilles", sponsor: "Danny Bradford", status: "IN_PROGRESS" },
    { code: "FY27-SI-011", sourceKey: "trevpar:channel-unit-economics", name: "Channel unit economics optimization", areaCode: "TREVPAR", objective: "Improve channel-level unit economics and prioritization across the portfolio.", owner: "Carter Achilles", sponsor: "Danny Bradford", status: "NOT_STARTED" },
    { code: "FY27-SI-012", sourceKey: "margin:shop-level-pi", name: "Shop-level PI programs", areaCode: "MARGIN", objective: "Run zero-based labor, procurement and maintenance programs to manage each shop to unit-level profitability.", owner: "Kyle Sullivan", sponsor: "Dan Yankley / Justin Ridgeway", status: "IN_PROGRESS" },
    { code: "FY27-SI-013", sourceKey: "margin:unit-economics", name: "Drive unit economics / profitability", areaCode: "MARGIN", objective: "Create a day-one cost culture with visibility and accountability for unit-level profitability.", owner: "Kyle Sullivan", sponsor: "Dan Yankley / Justin Ridgeway", status: "NOT_STARTED" },
    { code: "FY27-SI-014", sourceKey: "tech:guest-relations-conduit", name: "Guest Relations: Conduit rollout and value capture", areaCode: "TECH", objective: "Resolve guest messages end to end while turning freed capacity into EBITDA through measurable properties-per-FTE improvement.", valueMetric: "Properties per FTE in guest services and reservations", valueTarget: "1:95", owner: "Mohan Chandolu", sponsor: "Tom Chess", status: "IN_PROGRESS", milestones: [{ title: "Wave 2 shops live", dueAt: "2026-10-05" }, { title: "Conduit scorecard at the October review", dueAt: "2026-10-31" }] },
    { code: "FY27-SI-015", sourceKey: "tech:tuck-in-automation", name: "Tuck-In Automation", areaCode: "TECH", objective: "Run a tuck-in from seller contact to cutover through portal intake, pre-LOI screening, diligence and unit/owner migration.", valueMetric: "Days to integrate a tuck-in", valueTarget: "5 days", owner: "Mohan Chandolu", sponsor: "Tom Chess", status: "IN_PROGRESS", milestones: [{ title: "Working automation tool ready for pilot", dueAt: "2026-10-31" }] },
    { code: "FY27-SI-016", sourceKey: "tech:owner-relations", name: "Owner Relations", areaCode: "TECH", objective: "Automate monthly revenue explanations, revenue questions, admin requests and churn-risk interventions for owners.", valueMetric: "Properties per FTE in owner relations", valueTarget: "1:140", owner: "Mohan Chandolu", sponsor: "Tom Chess", status: "NOT_STARTED" },
    { code: "FY27-SI-017", sourceKey: "tech:foundation-improvements", name: "Foundation improvements", areaCode: "TECH", objective: "Improve the shared technology foundation needed to scale the $300M business.", owner: "Mohan Chandolu", sponsor: "Tom Chess", status: "NOT_STARTED" },
    { code: "FY27-SI-018", sourceKey: "finance:accounting-transformation", name: "Accounting Transformation", areaCode: "FINANCE", objective: "Automate the monthly close and stand up a central Accounting Excellence function.", valueMetric: "Accounting cost as % of revenue / units per Shop Accountant", owner: "Brett Hawks", sponsor: "David Reed", status: "NOT_STARTED" },
    { code: "FY27-SI-019", sourceKey: "finance:equity-for-all", name: "Equity for All", areaCode: "FINANCE", objective: "Implement equity for all with strong enablement so the frontline shares in the value it creates.", owner: "TBD", sponsor: "David Reed", status: "NOT_STARTED" },
    { code: "FY27-SI-020", sourceKey: "finance:predictability", name: "Predictability / Forecasting accuracy", areaCode: "FINANCE", objective: "Improve forecast accuracy and make financial information actionable for every leader.", valueMetric: "Forecast accuracy", owner: "TBD", sponsor: "David Reed", status: "NOT_STARTED" },
    { code: "FY27-SI-021", sourceKey: "finance:user-experience", name: "User Experience", areaCode: "FINANCE", objective: "Improve how financial information is analyzed, understood and used by leaders.", owner: "Kyle Campbell", sponsor: "David Reed", status: "NOT_STARTED" },
    { code: "FY27-SI-022", sourceKey: "finance:regional-transition", name: "Regional Finance transition", areaCode: "FINANCE", objective: "Transition FP&A toward a regional partnership model while building Accounting Excellence.", owner: "TBD", sponsor: "David Reed", status: "NOT_STARTED" },
    { code: "FY27-SI-023", sourceKey: "marketing:talent-upgrade", name: "Talent upgrade", areaCode: "MARKETING", objective: "Raise the bar in the marketing team through 9-boxing, coach-or-exit paths and targeted external hiring.", owner: "Lee Sims", sponsor: "Danny Bradford", status: "IN_PROGRESS" },
    { code: "FY27-SI-024", sourceKey: "marketing:seo-ai", name: "SEO optimization via AI integration", areaCode: "MARKETING", objective: "Scale the proven SEO methodology across the portfolio using an AI audit agent as the business acquires more brands.", owner: "Lee Sims", sponsor: "Danny Bradford", status: "IN_PROGRESS" },
    { code: "FY27-SI-025", sourceKey: "guest:conduit-rollout", name: "Conduit rollout", areaCode: "GUEST", objective: "Roll Conduit across the company and define the return expected from the investment.", owner: "Kyle Sullivan", sponsor: "Dan Yankley / Justin Ridgeway", status: "IN_PROGRESS", milestones: [{ title: "Wave 2 shops live", dueAt: "2026-10-05" }, { title: "Conduit scorecard at October review", dueAt: "2026-10-31" }] },
    { code: "FY27-SI-026", sourceKey: "guest:cleaning-maintenance", name: "Cleaning and maintenance standards", areaCode: "GUEST", objective: "Set and manage cleaning and maintenance standards so every stay is one a guest would book again.", owner: "Kyle Sullivan", sponsor: "Dan Yankley / Justin Ridgeway", status: "NOT_STARTED" },
  ] satisfies Fy27Initiative[],
} as const;
