export type ReviewTone = "good" | "warn" | "risk" | "neutral";

export type ReviewInitiative = {
  code: string;
  name: string;
  pillar: string;
  owner: string;
  sponsor: string;
  what: string;
  goal: string;
  ask?: string;
  status: ReviewTone;
  milestones: string[];
  latestUpdate?: string;
};

export type ReviewPillar = {
  id: string;
  number: number;
  name: string;
  owner: string;
  measure: string;
  actual: string;
  target: string;
  status: ReviewTone;
  headline: string;
  soWhat: string[];
  initiatives: ReviewInitiative[];
};

export type ReviewSnapshot = {
  meta: Omit<typeof REVIEW_META, "asOf"> & { asOf: string };
  pillars: ReviewPillar[];
  enablers: typeof REVIEW_ENABLERS;
  summaryTiles: readonly (readonly [string, string, string, string])[];
  financeRows: readonly (readonly string[])[];
  kpiRows: readonly (readonly string[])[];
  ebitdaTrend: readonly { m: string; v: number }[];
  initiativeLinks: { code: string; id: string }[];
};

export const REVIEW_META = {
  title: "September 2026 Strategy Review",
  eyebrow: "September 2026 results · for ELT discussion",
  preparedBy: "Strategy (Alex Bevington)",
  asOf: "Data as of 13 Oct 2026",
  finance: "Finance figures: September Flash Results, base business",
} as const;

export const REVIEW_PILLARS: ReviewPillar[] = [
  {
    id: "ma",
    number: 1,
    name: "M&A",
    owner: "Ryan McKendry · Curt Stark, Bart Williams",
    measure: "Acquired EBITDA closed, YTD",
    actual: "$34.5M",
    target: "2026 $23M · FY27 $26M / $47M stretch",
    status: "good",
    headline: "The year's engine",
    soWhat: [
      "20 deals and $34.5M closed, 50% above the $23M goal.",
      "Pipeline is full: 8 under LOI, 6 offers out and 16 in analysis.",
      "Speed is the constraint: median LOI-to-close is still about 77 days.",
    ],
    initiatives: [
      {
        code: "FY27-SI-001",
        name: "Build tuck-in M&A machine",
        pillar: "M&A",
        owner: "Curt Stark",
        sponsor: "Ryan McKendry",
        what: "Cut analysis-to-close from 70–120 days to 30–45 days through a repeatable tuck-in process.",
        goal: "30-day analysis-to-close target; first deals through the new process by November.",
        ask: "Confirm capacity and escalation path for the December speed target.",
        status: "good",
        milestones: ["Pre-LOI module live · 30 Oct 2026", "First end-to-end deals · 15 Nov 2026", "30–45 day cycle · 31 Dec 2026"],
      },
      {
        code: "FY27-SI-002",
        name: "Org planning and talent acquisition",
        pillar: "M&A",
        owner: "Curt Stark",
        sponsor: "Ryan McKendry",
        what: "Add the sourcing, integration and tuck-in capacity needed to scale while large deals continue.",
        goal: "Four new M&A hires landed in FY27.",
        status: "warn",
        milestones: ["Hiring list locked · 20 Oct 2026", "Searches kicked off · 1 Nov 2026", "New leaders in place · 31 Mar 2027"],
      },
    ],
  },
  {
    id: "units",
    number: 2,
    name: "Grow New Units",
    owner: "Ryan Olin · David Jensen",
    measure: "Gross unit adds, YTD incl. tuck-ins",
    actual: "3,244",
    target: "2,100 budget · 23% FY27 / 28% stretch",
    status: "good",
    headline: "Volume is ahead; CAC is not",
    soWhat: [
      "3,244 gross adds YTD against a 2,100 budget; 415 in September.",
      "September organic adds were about 270 after 142 tuck-in units.",
      "Cash CAC is $7,639 in September, 55% over budget and the third month running over.",
    ],
    initiatives: [
      {
        code: "FY27-SI-003",
        name: "Talent: BDM and enablement leadership",
        pillar: "Grow New Units",
        owner: "David Jensen",
        sponsor: "Ryan Olin",
        what: "Hire enablement leadership, upgrade BD managers and make call coaching routine.",
        goal: "Higher call scores and conversion; reclaim 10 hours per week per BDM.",
        status: "warn",
        milestones: ["Battle cards and baseline · 15 Oct 2026", "Training and AI roleplay · 15 Nov 2026", "VP Sales / Enablement hired · 31 Mar 2027"],
      },
      {
        code: "FY27-SI-004",
        name: "BD measurement: leading and lagging scorecards",
        pillar: "Grow New Units",
        owner: "David Jensen",
        sponsor: "Ryan Olin",
        what: "Put leading indicators next to conversion and units added so BD can intervene before the month is lost.",
        goal: "Conversion from 40% to 42%; 45% stretch.",
        status: "good",
        milestones: ["Metric definitions and dashboard · 15 Oct 2026", "Scorecard live by rep and region · 15 Nov 2026", "Correlated to conversion · 15 Dec 2026"],
      },
    ],
  },
  {
    id: "retention",
    number: 3,
    name: "Owner Retention",
    owner: "Dan Yankley, Justin Ridgeway · Kyle Sullivan",
    measure: "Annualized unit churn, YTD",
    actual: "12.4%",
    target: "2026 <12% · FY27 11% / 9% stretch",
    status: "risk",
    headline: "Best month, still behind on the year",
    soWhat: [
      "September was the best month of 2026 at 10.4% annualized churn; YTD is 12.4%.",
      "Avada is the one shop that is bad on both September and LTM views.",
      "ORMs spend 70–80% of time on tickets; revenue disputes are only about 2% of Zendesk volume.",
    ],
    initiatives: [
      {
        code: "FY27-SI-006",
        name: "Talent upgrades",
        pillar: "Owner Retention",
        owner: "Kyle Sullivan",
        sponsor: "Dan Yankley, Justin Ridgeway",
        what: "Top-grade the ORM team and move administrative work away from owner-facing time.",
        goal: "Complete the rollout already underway; quantify the churn lever.",
        status: "warn",
        milestones: ["Complete rollout already underway · next 1–2 months"],
      },
      {
        code: "FY27-SI-007",
        name: "Scorecard and GBV churn measurement",
        pillar: "Owner Retention",
        owner: "Kyle Sullivan",
        sponsor: "Dan Yankley, Justin Ridgeway",
        what: "Distribute one monthly retention scorecard and measure GBV churn alongside unit churn.",
        goal: "8.1% TTM GBV churn baseline; target to be completed on the charter.",
        status: "warn",
        milestones: ["Scorecard distributed monthly · owner/date TBD"],
      },
    ],
  },
  {
    id: "trevpar",
    number: 4,
    name: "TRevPAR Expansion",
    owner: "Danny Bradford · Carter Achilles",
    measure: "TRevPAR growth vs PY, YTD",
    actual: "+4.4%",
    target: "2026 +3.3% budget · FY27 +1% / 5% stretch",
    status: "good",
    headline: "Occupancy and fees did the work",
    soWhat: [
      "YTD TRevPAR is $187.0 versus $179.0 last year and 0.9% above budget.",
      "Growth is fees and occupancy, not rate: YTD ADR is down 4.7%.",
      "September occupancy rose at 38 of 42 brands while ADR fell at 23.",
    ],
    initiatives: [
      {
        code: "FY27-SI-009",
        name: "Listing page optimization",
        pillar: "TRevPAR Expansion",
        owner: "Carter Achilles",
        sponsor: "Danny Bradford",
        what: "Fix listing hygiene across 18,000 units, starting at the highest GBV listings.",
        goal: "Improve OTA conversion and reduce over-discounting; metric and value to be set.",
        status: "warn",
        milestones: ["Optimization tool tested for 30 days · date TBD", "Sun-state listings optimized · 31 Mar 2027", "Ski-state listings optimized · 30 Jun 2027"],
      },
      {
        code: "FY27-SI-010",
        name: "AI revenue manager",
        pillar: "TRevPAR Expansion",
        owner: "Carter Achilles",
        sponsor: "Danny Bradford",
        what: "Find pricing anomalies, optimize gap nights and give revenue managers elasticity insight.",
        goal: "1:600 properties per FTE; approximately $1M pilot revenue and $4M annual EBITDA.",
        status: "good",
        milestones: ["30-day pilot live · 31 Oct 2026", "Hosted in Awayday control environment · 31 Dec 2026", "Approve/deny phase · 28 Feb 2027", "Full rollout · 31 Mar 2027"],
      },
    ],
  },
  {
    id: "margin",
    number: 5,
    name: "Margin Expansion",
    owner: "Dan Yankley, Justin Ridgeway · Kyle Sullivan",
    measure: "Shop NOI margin vs PY, YTD (ex-OTA)",
    actual: "+0.8 pt",
    target: "2026 +0.7 pt · FY27 +0.25 pt / 1 pt stretch",
    status: "warn",
    headline: "On goal ex-OTA; reported margin is down",
    soWhat: [
      "Ex-OTA shop NOI margin is +0.8 point YTD against a +0.7 point goal.",
      "Reported margin is down 1.0 point versus prior year, with OTA mix masking the shop result.",
      "The Awayday-wide PI program has identified $12M+ gross and approximately $7M net.",
    ],
    initiatives: [
      {
        code: "FY27-SI-012",
        name: "Awayday-wide PI",
        pillar: "Margin Expansion",
        owner: "Kyle Sullivan",
        sponsor: "Dan Yankley, Justin Ridgeway",
        what: "Set top-down cost targets across BD spend, cleaning, maintenance, guest services and procurement.",
        goal: "$12M+ gross identified; approximately $7M net to the P&L in FY27.",
        status: "warn",
        milestones: ["Cost base validated · 24 Oct 2026", "Five priorities sized · 23 Nov 2026", "Targets cascaded · 28 Feb 2027", "Run-rate landed in P&L · 30 Jun 2027"],
      },
      {
        code: "FY27-SI-013",
        name: "Drive unit economics / profitability",
        pillar: "Margin Expansion",
        owner: "Kyle Sullivan",
        sponsor: "Dan Yankley, Justin Ridgeway",
        what: "Shift the portfolio toward units that make money and reduce the break-even tail.",
        goal: "Charter to be completed once the PI program lands.",
        status: "neutral",
        milestones: ["Complete charter once PI is landed · H2 2027"],
      },
    ],
  },
];

export const REVIEW_ENABLERS = [
  ["Tech & AI", "Tom Chess · Mohan Chandolu", "tech"],
  ["Talent", "Dave Galford · Adam Hamdan", "talent"],
  ["Finance", "David Reed · Kyle Campbell", "finance"],
  ["Marketing", "Danny Bradford · Lee Sims", "marketing"],
  ["Guest Experience", "Dan Yankley · Kyle Sullivan", "guest"],
] as const;

export const SUMMARY_TILES = [
  ["Sept Adj. EBITDA", "$2.4M", "−1.1% vs budget · +95.5% vs PY", "risk"],
  ["YTD Adj. EBITDA", "$81.0M", "+5.9% vs budget · +10.8% vs PY", "good"],
  ["LTM PF lender EBITDA", "$134.1M", "$86.4M at Dec-25 · goal passed in Aug", "good"],
  ["Sept Shop NOI", "$7.2M", "+17.0% vs budget · +78.6% vs PY", "good"],
] as const;

export const FINANCE_ROWS = [
  ["Revenue", "31.4", "+19.1%", "+43.7%", "328.5", "+7.8%", "+27.5%"],
  ["Cost of sales", "(19.7)", "−22.9%", "−44.2%", "(174.5)", "−10.4%", "−39.7%"],
  ["Shop opex", "(4.6)", "−8.0%", "−8.8%", "(38.3)", "+1.7%", "+2.6%"],
  ["Shop NOI", "7.2", "+17.0%", "+78.6%", "115.7", "+7.3%", "+23.9%"],
  ["SupportCo", "(3.8)", "−29.5%", "−79.6%", "(27.5)", "−6.8%", "−61.2%"],
  ["Business development", "(1.3)", "−34.7%", "−36.6%", "(11.0)", "−26.7%", "−87.0%"],
  ["Adj. EBITDA", "2.4", "−1.1%", "+95.5%", "81.0", "+5.9%", "+10.8%"],
  ["Shop NOI margin", "22.8%", "−0.4 pt", "+4.5 pt", "35.2%", "−0.2 pt", "−1.0 pt"],
] as const;

export const KPI_ROWS = [
  ["TRevPAR", "$136.4", "$119.3", "$114.5", "$187.0", "$185.2", "$179.0"],
  ["ADR", "$225.8", "$221.8", "$226.6", "$309.1", "$318.4", "$324.4"],
  ["Occupancy", "38.7%", "34.2%", "33.3%", "42.6%", "42.1%", "41.2%"],
  ["GBV ($M)", "59.2", "48.9", "42.0", "695.8", "667.4", "566.8"],
  ["Average units", "14,475", "13,667", "12,209", "13,632", "13,200", "11,596"],
  ["Unit adds", "415", "266", "341", "3,244", "2,100", "2,521"],
  ["Annualized churn", "10.4%", "13.7%", "14.9%", "12.4%", "10.7%", "12.7%"],
  ["Cash CAC", "$7,639", "$4,938", "$5,497", "$6,470", "$5,390", "$4,495"],
] as const;
