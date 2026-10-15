// Section-level detail for the September 2026 review: charts, M&A, region and
// shop tables, brand lists, guest tracking and enabler measures. Figures come
// from the MVP doc. Anything the MVP does not give is marked `mock: true` (or
// `derived`) and rendered with a label. August has no detail in the mock.

// ------------------------------------------------------------- banner

export const READ_FIRST = {
  title: "Read this first: this is a working MVP of the SI dashboard",
  points: [
    { label: "What this is", body: "A top-level sheet with a status line for every SI. The ELT discusses off this page each month." },
    { label: "What it will be", body: "Each pillar and SI is clickable and opens the detail on where that SI stands (charter, milestones, risks, dependencies). Clicking an SI here already opens its charter." },
    { label: "Status", body: "Every SI is shown as TBD. In the final dashboard, owners fill in their own status and recent updates before the meeting; nothing here is a judgement on any initiative." },
    { label: "Coming", body: "An individual inbox where each leader sees their own action items, and a \"below the line\" view per function showing the smaller projects junior teams run that feed the SIs above." },
  ],
  credit:
    "The real version is being built by Tom Chess's team, who are also carrying the engineering for the tuck-in tool and OwnerKnown. Thank you, Tom and team.",
};

// ------------------------------------------------------------- charts

/** Monthly LTM series. Dec-25 and Aug/Sep-26 (and the base business endpoints) are MVP figures; months between are mock shape. */
export type LtmPoint = { month: string; pf: number; base: number; mock: boolean };

export const LTM_SERIES: LtmPoint[] = [
  { month: "Dec-25", pf: 86.4, base: 69.4, mock: false },
  { month: "Jan-26", pf: 90.2, base: 70.1, mock: true },
  { month: "Feb-26", pf: 94.1, base: 70.9, mock: true },
  { month: "Mar-26", pf: 98.3, base: 71.7, mock: true },
  { month: "Apr-26", pf: 103.0, base: 72.6, mock: true },
  { month: "May-26", pf: 108.4, base: 73.6, mock: true },
  { month: "Jun-26", pf: 113.9, base: 74.8, mock: true },
  { month: "Jul-26", pf: 118.2, base: 76.1, mock: true },
  { month: "Aug-26", pf: 124.6, base: 77.3, mock: true },
  { month: "Sep-26", pf: 134.1, base: 78.5, mock: false },
];

export const LTM_GOAL_2026 = 120;

export const LTM_BRIDGE = {
  start: { label: "Dec-25 LTM", value: 86.4 },
  baseGrowth: { label: "Base business Adj. EBITDA", value: 9.1, note: "$69.4M to $78.5M" },
  other: { label: "Acquired EBITDA, executed PI, new-unit run rate", value: 38.6, note: "Derived: total movement less base business" },
  end: { label: "Sep-26 LTM", value: 134.1 },
};

export const LTM_CAPTION =
  "$86.4M at Dec-25 to $134.1M at Sep-26. Base business Adj. EBITDA (dashed) moved $69.4M to $78.5M; the rest is acquired EBITDA, executed PI and new-unit run rate.";

export const LTM_SO_WHAT = [
  { headline: "Rent drove the beat.", body: "Commission revenue +$1.3M on rent 22% over budget." },
  { headline: "Maintenance is losing money faster than planned.", body: "Margin -33% vs -12% budget (-$0.2M)." },
  { headline: "Support ate the beat.", body: "Support labor and other -$0.9M; shop BD -$0.3M." },
  { headline: "Regions behind YTD:", body: "CO -$1.2M, CH -$1.1M, SC -$0.8M, SW -$0.2M. Ahead: NEFL +$5.8M, NWFL +$2.3M." },
];

/** TRevPAR by month, AwayDNA PMS basis. Only September 2026 ($121.9) is an MVP figure; the rest is an invented, plausible seasonal shape. */
export type TrevparPoint = { month: string; value: number; mock: boolean };

export const TREVPAR_MONTHLY: TrevparPoint[] = [
  { month: "Aug-25", value: 164.0, mock: true },
  { month: "Sep-25", value: 102.4, mock: true },
  { month: "Oct-25", value: 98.6, mock: true },
  { month: "Nov-25", value: 92.1, mock: true },
  { month: "Dec-25", value: 118.5, mock: true },
  { month: "Jan-26", value: 112.4, mock: true },
  { month: "Feb-26", value: 122.7, mock: true },
  { month: "Mar-26", value: 158.3, mock: true },
  { month: "Apr-26", value: 131.6, mock: true },
  { month: "May-26", value: 142.8, mock: true },
  { month: "Jun-26", value: 186.9, mock: true },
  { month: "Jul-26", value: 201.7, mock: true },
  { month: "Aug-26", value: 172.4, mock: true },
  { month: "Sep-26", value: 121.9, mock: false },
];

export const TREVPAR_CAPTION =
  "AwayDNA TRevPAR is on a PMS basis ($121.9 in September) and runs below the Finance figure ($136.4), which includes OTA fees and other revenue. Shape only; the pillar measure is the Finance number. Months other than September are invented for the mock.";

// ---------------------------------------------------------------- M&A

export type ClosedDeal = {
  name: string;
  units: number;
  ebitdaM: number;
  /** Multiple, only given for Liquid Life. */
  multiple?: string;
  kind: "Large" | "Tuck-in";
  /** The MVP gives only the four-deal total for these three; the split is invented. */
  mock?: boolean;
};

export const SEPT_CLOSES: ClosedDeal[] = [
  { name: "Liquid Life", units: 800, ebitdaM: 5.7, multiple: "11.8x", kind: "Large" },
  { name: "Sunshine", units: 64, ebitdaM: 0.5, kind: "Tuck-in", mock: true },
  { name: "Stay at 30A", units: 48, ebitdaM: 0.4, kind: "Tuck-in", mock: true },
  { name: "Elysian", units: 30, ebitdaM: 0.2, kind: "Tuck-in", mock: true },
];

export const MA_YTD = {
  deals: 20,
  units: 4771,
  ebitdaM: 34.5,
  multipleTotal: "9.1x",
  multipleSynergized: "7.7x",
  goalEbitdaM: 23,
  goalDeals: 22,
  septDeals: 4,
  septUnits: 942,
  septEbitdaM: 6.8,
};

export const MA_PIPELINE = [
  { stage: "Under LOI", count: 8, valueM: 7.6 },
  { stage: "Offers out", count: 6, valueM: 4.1 },
  { stage: "In analysis or data gathering", count: 16, valueM: 18.6 },
];

export const MA_SPEED = { medianLoiToCloseDays: 77, targetLow: 30, targetHigh: 45 };

export const MA_TUCK_INS = {
  deliveredM: 3.9,
  deals: 10,
  fy27TargetM: 11,
  fy27BudgetM: 26,
  fy27StretchM: 47,
  recentLois: "Three tuck-in LOIs went out in the first two weeks of October.",
};

export const MA_INBOUNDS = [
  { name: "Natural Retreats", metric: "~$23M NOI", ask: "$100-125M ask" },
  { name: "Parrish (Kauai)", metric: "~$22M strawman", ask: "Strawman only" },
];

export const MA_INBOUND_NOTE =
  "Either would move FY27 toward the $47M stretch. The 2025 vintage is still flat at 102% of close.";

// -------------------------------------------------- regions and shops

export type NoiVariance = { name: string; varianceM: number };

export const REGION_NOI: NoiVariance[] = [
  { name: "NEFL", varianceM: 5.8 },
  { name: "NWFL", varianceM: 2.3 },
  { name: "SW", varianceM: -0.2 },
  { name: "SC", varianceM: -0.8 },
  { name: "CH", varianceM: -1.1 },
  { name: "CO", varianceM: -1.2 },
];

export const SHOPS_UNDER_NOI: NoiVariance[] = [
  { name: "Luxury Beach", varianceM: -0.8 },
  { name: "Park City Rental Properties", varianceM: -0.7 },
  { name: "Avada", varianceM: -0.5 },
  { name: "Great Western", varianceM: -0.5 },
  { name: "Rent Branson", varianceM: -0.4 },
];

export type ChurnRow = {
  brand: string;
  /** Annualized churn %. */
  rate: number;
  detail?: string;
  /** True when the brand is on both the September and LTM worst lists. */
  both?: boolean;
};

export const CHURN_SEPT: ChurnRow[] = [
  { brand: "Avada", rate: 43, detail: "13 of 364 units", both: true },
  { brand: "Carolina Beach", rate: 25, both: true },
  { brand: "Village Realty", rate: 22 },
  { brand: "Meredith Lodging", rate: 19, detail: "Three shops rolled up" },
  { brand: "Sunset Rentals", rate: 17 },
  { brand: "All Seasons", rate: 16 },
];

export const CHURN_SEPT_NOTE =
  "RealJoy lost the most units (20) but that is 12.5% on 1,922. Twenty brands churned zero. AwayDNA September churn x 12 over bookable units.";

export const CHURN_LTM: ChurnRow[] = [
  { brand: "Stay Local Austin", rate: 58, detail: "0 churned in Sept (derived)" },
  { brand: "Scottsdale", rate: 53, detail: "0 churned in Sept (derived)" },
  { brand: "Avada", rate: 47, detail: "43% in Sept", both: true },
  { brand: "Emerald Coast Retreats", rate: 30, detail: "0 churned in Sept (derived)" },
  { brand: "Carolina Beach", rate: 27, detail: "25% in Sept", both: true },
];

export const CHURN_LTM_NOTE =
  "ORM scorecard, LTM, shop codes. Three of the five churned zero in September, which is a large part of why the month looks good; they are small shops, so one month is not a trend. The two lists will not match one to one.";

export type MarketRow = { brand: string; trevpar: number; market: number };

export const TREVPAR_BEATING: MarketRow[] = [
  { brand: "Stay Winter Park", trevpar: 86, market: 12 },
  { brand: "Arrived", trevpar: 82, market: 9 },
  { brand: "Pristine", trevpar: 63, market: 15 },
  { brand: "SummitCove", trevpar: 61, market: -3 },
];

export const TREVPAR_TRAILING: MarketRow[] = [
  { brand: "All Seasons Park City", trevpar: -21, market: 55 },
  { brand: "Resort Rentals", trevpar: -1, market: 46 },
  { brand: "Luxury Beach", trevpar: 6, market: 28 },
  { brand: "Bach Bros", trevpar: -11, market: 16 },
];

export type UnitAddRow = { brand: string; adds?: number };

export const UNIT_ADDS_TOP: UnitAddRow[] = [
  { brand: "RealJoy", adds: 47 },
  { brand: "Resort Rentals", adds: 22 },
  { brand: "Pristine", adds: 19 },
  { brand: "Great Ocean Condos", adds: 16 },
  { brand: "Stay Winter Park", adds: 16 },
];

/** "Adding one or none": the MVP gives no counts. */
export const UNIT_ADDS_LOW: UnitAddRow[] = [
  { brand: "Beach Retreats" },
  { brand: "Winter Park Lodging" },
  { brand: "Stay Local Austin" },
  { brand: "Carolina Beach" },
  { brand: "Pensacola Beach" },
  { brand: "Sedona" },
];

export const UNIT_ADDS_NOTE =
  "September organic adds were ~270 (derived): Finance total 415 less 142 tuck-in units. AwayDNA brand counts.";

// ------------------------------------------------------ guest tracking

export const GUEST = {
  goal: 4.65,
  floor: 4.5,
  ytdAugust: 4.65,
  augustMonth: 4.59,
  shopsAtGoal: 43,
  shopsTotal: 64,
  underFloor: [
    { brand: "Beach Retreats", score: 4.06 },
    { brand: "Village Realty", score: 4.38 },
    { brand: "Amazing Views", score: 4.44 },
    { brand: "Carolina Beach", score: 4.48 },
    { brand: "RealJoy PCB", score: 4.49 },
  ],
  conduit: {
    brandsInRollout: 18,
    brandsLive: 7,
    wave2: "Wave 2 live 5 Oct for 12 brands",
    note: "Uplift is uneven, several brands see limited benefit, and there is no stated goal for the investment yet.",
  },
  septemberNote:
    "No September review score is in the package. This needs a standing line in the Flash.",
};

// ---------------------------------------------------- enabler measures

export type EnablerMeasure = {
  areaCode: string;
  measureName: string;
  /** Short status chip. */
  state: "Candidate" | "Set (FY26 not reported)" | "Not yet set";
  current?: string;
  target?: string;
  targetLabel?: string;
  notes: string[];
  candidates?: string[];
  bullets?: { title: string; items: string[] };
};

export const ENABLER_MEASURES: EnablerMeasure[] = [
  {
    areaCode: "TECH",
    measureName: "Properties per FTE",
    state: "Candidate",
    current: "1:11.8",
    target: "1:14.4",
    targetLabel: "stretch",
    notes: ["Today 1:11.8, stretch 1:14.4: about 22% more properties per FTE. No month-by-month read yet."],
    bullets: {
      title: "AI tiger teams (29 Sept MOR)",
      items: [
        "Guest Services/Conduit: ~$10M at 40K units, ~$4M today.",
        "M&A tuck-in machine: $4-8M acquired EBITDA a year.",
        "Owner Relations: ~$6M operating plus $2-8M churn.",
        "Live or landing: Conduit, Zendesk, PriceLabs at Amazing Views; Breezeway lands in November. Head of AI hired.",
      ],
    },
  },
  {
    areaCode: "FINANCE",
    measureName: "Month-end close time",
    state: "Candidate",
    current: "6 days",
    target: "5 days",
    targetLabel: "by EOY",
    notes: ["Close is 6 days today; the ask is 5 by end of year."],
    candidates: ["Finance spend as % of revenue", "Forecast accuracy"],
  },
  {
    areaCode: "MARKETING",
    measureName: "Direct GBV growth, YoY",
    state: "Set (FY26 not reported)",
    current: "n/a",
    target: "+40%",
    targetLabel: "FY27",
    notes: ["FY27 target is +40% YoY. The FY26 actual has not been reported, so there is no baseline to track against yet."],
  },
  {
    areaCode: "TALENT",
    measureName: "Leading measure",
    state: "Not yet set",
    notes: ["Not yet set. Talent has no strategic initiatives in the FY27 plan yet; its milestones are shown below so the ELT can still track delivery."],
  },
];
