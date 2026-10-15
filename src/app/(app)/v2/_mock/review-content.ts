// Static content for the monthly review pages. September 2026 uses the real
// numbers from the MVP doc; August 2026 is illustrative mock data (derived or
// invented) so the month switcher has something to switch to.
import type {
  FinanceTable,
  ReviewPeriod,
  ReviewPillar,
  ReviewSoWhat,
} from "./types";

export const MOCK_HEADER = {
  mission: "To Perfect the Vacation Rental Experience",
  target: "$300M EBITDA by 12/31/28",
  fy27Budget: "$180M",
  bhag: "$200M",
  values: ["Servant Leadership", "Ownership Mentality", "Local", "Excellence"],
};

export const REVIEW_PERIODS: ReviewPeriod[] = [
  {
    id: "2026-09",
    label: "September 2026",
    monthName: "September",
    status: "DRAFT",
    dataAsOf: "13 Oct 2026",
    preparedBy: "Strategy (Alex Bevington)",
    financeSource: "September Flash Results, base business",
    meetingDate: "2026-10-20",
    updatesDueDate: "2026-10-16",
    tiles: [
      { label: "Sept Adj. EBITDA (base business)", value: "$2.4M", sub: "-1.1% vs budget · +95.5% vs PY" },
      { label: "YTD Adj. EBITDA", value: "$81.0M", sub: "+5.9% vs budget · +10.8% vs PY" },
      { label: "LTM PF Lender EBITDA, Sep-26", value: "$134.1M", sub: "$86.4M at Dec-25 · 2026 goal $120M passed in Aug" },
      { label: "Sept Shop NOI", value: "$7.2M", sub: "+17.0% vs budget · +78.6% vs PY" },
    ],
    sources: [
      "Awayday 2026-09 Results (Internal), Flash P&L vFinal 12 Oct: P&L, KPIs, bridge, NOI by region and shop, LTM EBITDA",
      "2026-09 Shop Ranking Report vFinal: LTM Sep-26 shop and region ranks",
      "2026-09 National Financial Review vDraft: TRevPAR vs market, ORM scorecard",
      "260930 Awayday SI Refresh v1: pillars, targets, SI names, charters (the SI pages here mirror the charter slides)",
      "Awayday August 2026 Results Review: 2026 goals, August baselines, guest scores",
      "M&A Leadership Update 13 Oct 2026: closed deals, pipeline, LOIs, integration",
      "260929 Internal ELT MOR: org timeline, AI strategy, BD measurement, Summit",
      "AwayDNA dbt Semantic Layer: TRevPAR, ADR, paid occupancy, unit adds, unit churn, on-platform units by brand, Sept 2025 and 2026",
      "M&A FY27 stretch of $47M, org design owners and Curt Stark as owner of every tuck-in machine milestone per Alex Bevington, 14 Oct 2026 (not yet in the SI deck)",
    ],
    dataNotes: [
      "Two TRevPAR bases: Finance $136.4 (includes OTA fees and other revenue) vs AwayDNA $121.9 (PMS). Finance is the measure.",
      "Two margin bases: reported (OTA gross) and ex-OTA. The 2026 goal was set ex-OTA; FY27 should say which.",
      "Two churn views: base business (13.2% TTM at Aug) and enterprise (12.7%). Flash annualized YTD 12.4% used here.",
      "Organic adds (~270 in Sept) is derived: Finance total minus tuck-in units. Finance to add an organic line.",
      "Brand churn rates are AwayDNA September churn x 12 over current bookable units, rolled up by brand (Meredith = three shops). The ORM scorecard uses shop codes and LTM, so the two lists will not match one to one.",
      "Not measured monthly yet: September review score, direct GBV growth, properties per FTE, any Talent metric.",
      "EBITDA frame: house says $150M by 12/31/27; SI deck says FY27 budget $180M, BHAG $200M. This page uses the SI deck.",
      "Unit base: 15,684 active and bookable units on platform, 392 active not bookable, 1,447 inactive (AwayDNA, 13 Oct).",
    ],
    sourcesFooter:
      "Prepared by Strategy for ELT discussion. Highly confidential. Numbers tie to the September Flash Results pack unless labelled AwayDNA or derived. SI status comes from owner updates; TBD means no submitted update.",
  },
  {
    id: "2026-08",
    label: "August 2026",
    monthName: "August",
    status: "PUBLISHED",
    dataAsOf: "9 Sep 2026",
    preparedBy: "Strategy (Alex Bevington)",
    financeSource: "August Flash Results, base business (mock figures)",
    meetingDate: "2026-09-22",
    updatesDueDate: "2026-09-16",
    publishedAt: "2026-09-21",
    tiles: [
      { label: "Aug Adj. EBITDA (base business)", value: "$11.9M", sub: "+2.4% vs budget · +9.1% vs PY" },
      { label: "YTD Adj. EBITDA", value: "$78.6M", sub: "+6.7% vs budget · +9.4% vs PY" },
      { label: "LTM PF Lender EBITDA, Aug-26", value: "$124.6M", sub: "2026 goal $120M passed in Aug" },
      { label: "Aug Shop NOI", value: "$18.1M", sub: "+6.2% vs budget · +14.8% vs PY" },
    ],
    sources: [
      "Awayday August 2026 Results Review: 2026 goals, August baselines, guest scores",
      "260930 Awayday SI Refresh v1: pillars, targets, SI names",
      "AwayDNA dbt Semantic Layer: TRevPAR, ADR, unit adds, unit churn",
    ],
    dataNotes: [
      "August figures on this page are illustrative mock data to demonstrate the month switcher. Only September uses the real MVP numbers.",
    ],
    sourcesFooter: "Mock month for the V2 preview. Published 21 Sep 2026.",
  },
];

type SoWhatInput = [scope: string, headline: string, body: string];

function soWhats(periodId: string, rows: SoWhatInput[]): ReviewSoWhat[] {
  const counters = new Map<string, number>();
  return rows.map(([scope, headline, body]) => {
    const order = (counters.get(scope) ?? 0) + 1;
    counters.set(scope, order);
    return { id: `${periodId}:${scope}:${order}`, periodId, scope, order, headline, body };
  });
}

export const REVIEW_SO_WHATS: ReviewSoWhat[] = [
  ...soWhats("2026-09", [
    ["SUMMARY", "Shops beat, centre spent it.", "Shop NOI was $1.0M over budget; Support (+$0.9M) and BD (+$0.3M) took it all, so Adj. EBITDA missed by $30K."],
    ["SUMMARY", "M&A is the year's engine.", "20 deals and $34.5M closed, 50% over the $23M goal. Tuck-ins are only $3.9M of it, and FY27 needs $11M from tuck-ins."],
    ["SUMMARY", "Retention had its best month, still behind on the year.", "10.4% annualized in September vs 12.4% YTD against a 10.7% budget."],
    ["SUMMARY", "CAC is the number nobody has explained.", "$7,639 in September, 55% over budget, third month running over."],
    ["M&A", "Four closes in September.", "Liquid Life (800 units, $5.7M, 11.8x), Sunshine, Stay at 30A, Elysian. 942 units, $6.8M."],
    ["M&A", "Pipeline is full.", "8 under LOI ($7.6M), 6 offers out ($4.1M), 16 in analysis or data gathering ($18.6M). Three tuck-in LOIs went out in the first two weeks of October."],
    ["M&A", "Speed is the constraint.", "Median LOI-to-close ~77 days this year; the machine targets 30-45 by December."],
    ["M&A", "Two big inbounds want senior time.", "Natural Retreats (~$23M NOI, $100-125M ask) and Parrish in Kauai (~$22M strawman). Either would move FY27 toward the $47M stretch. The 2025 vintage is still flat at 102% of close."],
    ["GROW", "CAC is the problem, not volume.", "$7,639 vs $4,938 budget in September; $6,470 YTD vs $5,390. BD spend is $2.3M over YTD."],
    ["GROW", "September organic was on budget, not ahead.", "The three tuck-ins brought 142 units, so organic adds were ~270 (derived)."],
    ["GROW", "Adding most.", "RealJoy 47, Resort Rentals 22, Pristine 19, Great Ocean Condos 16, Stay Winter Park 16 (AwayDNA)."],
    ["GROW", "Adding one or none.", "Beach Retreats, Winter Park Lodging, Stay Local Austin, Carolina Beach, Pensacola Beach, Sedona."],
    ["RETENTION", "September was the best month of the year.", "137 units churned (AwayDNA, 10.5% annualized on 15,684 bookable units, which ties to Finance's 10.4%). Twenty brands churned zero."],
    ["RETENTION", "Worst September churn rates (annualized, AwayDNA).", "Avada 43% (13 of 364 units), Carolina Beach 25%, Village Realty 22%, Meredith Lodging 19%, Sunset Rentals 17%, All Seasons 16%. RealJoy lost the most units (20) but that is 12.5% on 1,922."],
    ["RETENTION", "LTM worst (ORM scorecard).", "Stay Local Austin 58%, Scottsdale 53%, Avada 47%, Emerald Coast Retreats 30%, Carolina Beach 27%. Three of those five churned zero in September, which is a large part of why the month looks good; they are small shops, so one month is not a trend. Avada is the one that is bad on both views."],
    ["RETENTION", "Leading signal.", "ORMs spend 70-80% of time on tickets; only ~2% of Zendesk tickets are revenue disputes, yet revenue is the stated churn driver."],
    ["TREVPAR", "Growth is fees and occupancy, not rate.", "Ex-OTA, YTD TRevPAR is +0.9% and 0.5% under budget. YTD ADR is down 4.7%."],
    ["TREVPAR", "September occupancy did the work.", "38.7% vs 33.3% PY. Paid occupancy rose at 38 of 42 brands (AwayDNA); ADR fell at 23."],
    ["TREVPAR", "Beating market.", "Stay Winter Park +86% vs 12%, Arrived +82% vs 9%, SummitCove +61% vs -3%, Pristine +63% vs 15%."],
    ["TREVPAR", "Trailing market.", "All Seasons Park City -21% vs +55%, Resort Rentals -1% vs +46%, Bach Bros -11% vs +16%, Luxury Beach +6% vs +28%."],
    ["MARGIN", "Shop margin is doing its job.", "September ex-OTA 25.2% vs 20.0% PY; labor improved as a share of revenue."],
    ["MARGIN", "The leak is below shop NOI.", "Support $27.5M YTD, +6.8% vs budget; Adj. EBITDA margin 24.7% vs 28.4% PY. SupportCo sits outside shop PI."],
    ["MARGIN", "Maintenance and OTA margins miss.", "Maintenance -33% vs -12% budget; OTA 2.9% vs 4.5%. No September read on whether the Track markup fix landed in the six negative-OTA shops."],
    ["MARGIN", "Shops furthest under NOI budget YTD.", "Luxury Beach -$0.8M, Park City Rental Properties -$0.7M, Avada -$0.5M, Great Western -$0.5M, Rent Branson -$0.4M."],
    ["GUEST", "No September score in the package.", "This needs a standing line in the Flash."],
    ["GUEST", "Most shops at standard.", "43 of 64 shops at or above 4.65 on a trailing year; Carolina Beach climbed 4.32 to 4.53 YTD."],
    ["GUEST", "Conduit uplift is uneven.", "18 brands in rollout (7 live), several seeing limited benefit, and no stated goal for the investment yet."],
  ]),
  ...soWhats("2026-08", [
    ["SUMMARY", "Shops ahead of budget.", "Mock: Shop NOI was $1.1M over budget in August and the centre held its cost line."],
    ["SUMMARY", "M&A pace is strong.", "Mock: 16 deals and $27.7M closed YTD against a $23M goal."],
    ["SUMMARY", "Retention still the gap.", "Mock: 12.7% annualized YTD against a 10.7% budget."],
    ["SUMMARY", "Guest score holds at standard.", "Mock: 4.65 YTD, with five brands under the 4.5 floor."],
    ["M&A", "Three closes in August.", "Mock: pipeline rebuilt after the summer slowdown."],
    ["GROW", "Adds ahead of budget.", "Mock: 2,829 gross adds YTD vs 1,834 budget."],
    ["RETENTION", "Churn flat month on month.", "Mock: 12.7% YTD; Avada and Carolina Beach are the outliers."],
    ["TREVPAR", "Rate soft, occupancy firm.", "Mock: +3.9% YTD vs +3.3% budget."],
    ["MARGIN", "Ex-OTA margin on goal.", "Mock: +0.7 pt vs PY ex-OTA."],
    ["GUEST", "Five brands under floor.", "Mock: Beach Retreats 4.06 is the weakest."],
  ]),
];

type PillarSeed = Omit<ReviewPillar, "periodId">;

const SEP_PILLARS: PillarSeed[] = [
  {
    areaCode: "M&A", label: "Ahead", tone: "ahead", measure: "Acquired EBITDA closed, YTD",
    headline: "$34.5M", headlineNote: "20 deals · 4,771 units · 9.1x total, 7.7x synergized",
    cardSub: "2026 goal $23M · FY27 $26M ($11M tuck-ins), $47M stretch",
    monthValue: "$6.8M", ytdValue: "$34.5M", goal2026: "$23M", fy27: "$26M / $47M",
    goal2026Note: "$23M / 22 deals. EBITDA and units beaten; deal count 2 short with 8 under LOI.",
    fy27Note: "$26M budget ($11M via tuck-ins), $47M stretch. Tuck-ins have delivered $3.9M across 10 deals this year.",
    commentary: "EBITDA and units beaten; deal count 2 short with 8 under LOI.",
  },
  {
    areaCode: "GROW", label: "Ahead · CAC off track", tone: "watch", measure: "Gross unit adds, YTD incl. tuck-ins",
    headline: "3,244", headlineNote: "vs 2,100 budget · 415 in Sept vs 266",
    cardSub: "Budget 2,100 · 2026 goal 23% · FY27 23% (28% stretch)",
    monthValue: "415", ytdValue: "3,244", goal2026: "23%", fy27: "23% / 28%",
    goal2026Note: "23% gross adds; running ~30% TTM at the August pack.",
    fy27Note: "23% budget, 28% stretch: roughly 3,300-4,000 units on a 14,500 base.",
    commentary: "Ahead on adds, but cash CAC has run over budget three months in a row.",
  },
  {
    areaCode: "RETENTION", label: "Behind", tone: "behind", measure: "Annualized unit churn, YTD",
    headline: "12.4%", headlineNote: "vs 10.7% budget · Sept 10.4%, best month of 2026",
    cardSub: "2026 goal <12% · FY27 11% (9% stretch)",
    monthValue: "10.4%", ytdValue: "12.4%", goal2026: "<12%", fy27: "11% / 9%",
    goal2026Note: "Under 12% TTM (13.2% base business at August).",
    fy27Note: "11%, 9% stretch. Hitting budget alone is worth ~$1.5M of annual NOI.",
    commentary: "Behind on the year; best month in September.",
  },
  {
    areaCode: "TREVPAR", label: "On track", tone: "on_track", measure: "TRevPAR growth vs PY, YTD",
    headline: "+4.4%", headlineNote: "$187.0 vs $179.0 · +0.9% vs budget · Sept +19.1% (Labor Day shift)",
    cardSub: "2026 budget +3.3% · FY27 +1% (5% stretch)",
    monthValue: "+19.1%", ytdValue: "+4.4%", goal2026: "+3.3%", fy27: "+1% / 5%",
    goal2026Note: "Flat and above market; budget +3.3%.",
    fy27Note: "+1% budget, 5% stretch, vs a 2.9% market forecast.",
    commentary: "Above goal, but growth is fees and occupancy, not rate.",
    extra: {
      title: "TRevPAR by month, Aug-25 to Sep-26 (AwayDNA, PMS basis)",
      items: ["AwayDNA TRevPAR is on a PMS basis ($121.9 in September) and runs below the Finance figure ($136.4), which includes OTA fees and other revenue. Shape only; the pillar measure is the Finance number."],
    },
  },
  {
    areaCode: "MARGIN", label: "On goal ex-OTA · reported behind", tone: "watch", measure: "Shop NOI margin vs PY, YTD (ex-OTA)",
    headline: "+0.8 pt", headlineNote: "38.5% vs 37.7% PY · reported basis 35.2% vs 36.2% (-1.0 pt)",
    cardSub: "2026 goal +0.7 pt · FY27 +0.25 pt (1 pt stretch)",
    monthValue: "+5.2 pt", ytdValue: "+0.8 pt", goal2026: "+0.7 pt", fy27: "+0.25 / 1 pt",
    goal2026Note: "+0.7 pt vs PY, set on the ex-OTA basis. Met on that basis.",
    fy27Note: "+0.25 pt, 1 pt stretch. Airbnb's host-fee change puts OTA cost gross through the P&L, so the board pack shows -1.0 pt.",
    commentary: "Met on the ex-OTA basis the goal was set on; reported basis is behind.",
  },
  {
    areaCode: "GUEST", label: "At standard · floor breached", tone: "watch", measure: "Guest review score",
    headline: "4.65", headlineNote: "YTD at August · August month 4.59 · September not yet reported",
    cardSub: "Goal 4.65 average, no brand under 4.5",
    monthValue: "n/a", ytdValue: "4.65 (Aug)", goal2026: "4.65", fy27: "4.65",
    goal2026Note: "4.65 average, no brand under 4.5 (2026 and FY27).",
    fy27Note: "Five brands under 4.5 at August: Beach Retreats 4.06, Village Realty 4.38, Amazing Views 4.44, Carolina Beach 4.48, RealJoy PCB 4.49.",
    commentary: "Average at standard but the brand floor is breached.",
  },
  {
    areaCode: "TECH", label: "TBD", tone: "watch", measure: "Candidate: properties per FTE",
    headline: "1:11.8", headlineNote: "today · 1:14.4 stretch", cardSub: "No leading measure yet",
    monthValue: "n/a", ytdValue: "n/a", goal2026: "n/a", fy27: "1:14.4",
    goal2026Note: "", fy27Note: "", commentary: "No leading measure yet.",
    enablerNote: "ELT Tom Chess · SI lead Mohan Chandolu · candidate measure: properties per FTE (1:11.8 today, 1:14.4 stretch)",
    extra: {
      title: "Also in flight (AI strategy, 29 Sept MOR)",
      items: [
        "Three tiger teams: Guest Services/Conduit (~$10M at 40K units, ~$4M today), M&A tuck-in machine ($4-8M acquired EBITDA a year), Owner Relations (~$6M operating plus $2-8M churn).",
        "Live or landing: Conduit, Zendesk, PriceLabs at Amazing Views; Breezeway lands in November. Head of AI hired.",
      ],
    },
  },
  {
    areaCode: "TALENT", label: "TBD", tone: "watch", measure: "Not yet set",
    headline: "n/a", headlineNote: "", cardSub: "Leading measure not yet set",
    monthValue: "n/a", ytdValue: "n/a", goal2026: "n/a", fy27: "n/a",
    goal2026Note: "", fy27Note: "", commentary: "Leading measure not yet set.",
    enablerNote: "ELT and SI leads Dave Galford, Adam Hamdan · leading measure not yet set",
  },
  {
    areaCode: "FINANCE", label: "TBD", tone: "watch", measure: "Candidate: finance spend % revenue, forecast accuracy",
    headline: "6 days", headlineNote: "close today, 5 by EOY", cardSub: "Candidate measures only",
    monthValue: "n/a", ytdValue: "n/a", goal2026: "n/a", fy27: "5 day close",
    goal2026Note: "", fy27Note: "", commentary: "Candidate measures only.",
    enablerNote: "ELT David Reed · SI lead Kyle Campbell · candidate measures: finance spend % revenue, forecast accuracy · close now 6 days, 5 by EOY",
  },
  {
    areaCode: "MARKETING", label: "TBD", tone: "watch", measure: "Direct GBV growth YoY",
    headline: "FY27 +40%", headlineNote: "FY26 actual not yet reported", cardSub: "FY26 actual not yet reported",
    monthValue: "n/a", ytdValue: "n/a", goal2026: "n/a", fy27: "+40%",
    goal2026Note: "", fy27Note: "", commentary: "FY26 actual not yet reported.",
    enablerNote: "ELT Danny Bradford · SI lead Lee Sims · measure: direct GBV growth YoY, FY27 +40% · FY26 actual not yet reported",
  },
];

const AUG_PILLARS: PillarSeed[] = [
  { ...SEP_PILLARS[0], headline: "$27.7M", headlineNote: "16 deals · 3,829 units (mock)", monthValue: "$4.1M", ytdValue: "$27.7M", commentary: "Mock: ahead of the $23M goal." },
  { ...SEP_PILLARS[1], headline: "2,829", headlineNote: "vs 1,834 budget (mock)", monthValue: "389", ytdValue: "2,829", label: "Ahead", tone: "ahead", commentary: "Mock: ahead on adds; CAC drifting." },
  { ...SEP_PILLARS[2], headline: "12.7%", headlineNote: "vs 10.7% budget (mock)", monthValue: "13.0%", ytdValue: "12.7%", commentary: "Mock: behind; no change in trend." },
  { ...SEP_PILLARS[3], headline: "+3.9%", headlineNote: "vs +3.3% budget (mock)", monthValue: "+2.1%", ytdValue: "+3.9%", commentary: "Mock: on track." },
  { ...SEP_PILLARS[4], headline: "+0.7 pt", headlineNote: "ex-OTA (mock)", monthValue: "+0.9 pt", ytdValue: "+0.7 pt", label: "On goal ex-OTA", tone: "on_track", commentary: "Mock: on goal ex-OTA." },
  { ...SEP_PILLARS[5], headline: "4.65", headlineNote: "YTD · August month 4.59", monthValue: "4.59", ytdValue: "4.65", commentary: "Mock: five brands under the floor." },
  { ...SEP_PILLARS[6] },
  { ...SEP_PILLARS[7] },
  { ...SEP_PILLARS[8] },
  { ...SEP_PILLARS[9] },
];

export const REVIEW_PILLARS: ReviewPillar[] = [
  ...SEP_PILLARS.map((p) => ({ ...p, periodId: "2026-09" })),
  ...AUG_PILLARS.map((p) => ({ ...p, periodId: "2026-08" })),
];

export const FINANCIALS: Record<string, { pnl: FinanceTable; kpis: FinanceTable }> = {
  "2026-09": {
    pnl: {
      title: "P&L, September MTD and YTD ($M)",
      columns: ["Line", "Sept", "vs Bud", "vs PY", "YTD", "vs Bud", "vs PY"],
      rows: [
        { line: "Revenue", cells: ["31.4", "+19.1%", "+43.7%", "328.5", "+7.8%", "+27.5%"] },
        { line: "Cost of sales", cells: ["(19.7)", "-22.9%", "-44.2%", "(174.5)", "-10.4%", "-39.7%"] },
        { line: "Shop opex", cells: ["(4.6)", "-8.0%", "-8.8%", "(38.3)", "+1.7%", "+2.6%"] },
        { line: "Shop NOI", cells: ["7.2", "+17.0%", "+78.6%", "115.7", "+7.3%", "+23.9%"], bold: true },
        { line: "SupportCo", cells: ["(3.8)", "-29.5%", "-79.6%", "(27.5)", "-6.8%", "-61.2%"] },
        { line: "Business development", cells: ["(1.3)", "-34.7%", "-36.6%", "(11.0)", "-26.7%", "-87.0%"] },
        { line: "Interest income", cells: ["0.4", "+51.2%", "+25.5%", "3.8", "+21.4%", "+40.2%"] },
        { line: "Adj. EBITDA", cells: ["2.4", "-1.1%", "+95.5%", "81.0", "+5.9%", "+10.8%"], bold: true },
        { line: "Shop NOI margin", cells: ["22.8%", "-0.4 pt", "+4.5 pt", "35.2%", "-0.2 pt", "-1.0 pt"] },
        { line: "Support % of revenue", cells: ["10.1%", "+0.7 pt", "-0.2 pt", "7.4%", "+0.2 pt", "-0.2 pt"] },
      ],
    },
    kpis: {
      title: "KPIs, September MTD and YTD",
      columns: ["KPI", "Sept", "Budget", "PY", "YTD", "Budget", "PY"],
      rows: [
        { line: "TRevPAR", cells: ["$136.4", "$119.3", "$114.5", "$187.0", "$185.2", "$179.0"] },
        { line: "TRevPAR ex-OTA", cells: ["$128.6", "$114.0", "$112.1", "$176.8", "$177.7", "$175.2"] },
        { line: "ADR", cells: ["$225.8", "$221.8", "$226.6", "$309.1", "$318.4", "$324.4"] },
        { line: "Occupancy", cells: ["38.7%", "34.2%", "33.3%", "42.6%", "42.1%", "41.2%"] },
        { line: "GBV ($M)", cells: ["59.2", "48.9", "42.0", "695.8", "667.4", "566.8"] },
        { line: "Take rate", cells: ["49.2%", "49.9%", "48.5%", "44.3%", "43.0%", "41.9%"] },
        { line: "Average units", cells: ["14,475", "13,667", "12,209", "13,632", "13,200", "11,596"] },
        { line: "Unit adds (incl. tuck-ins)", cells: ["415", "266", "341", "3,244", "2,100", "2,521"] },
        { line: "Annualized churn", cells: ["10.4%", "13.7%", "14.9%", "12.4%", "10.7%", "12.7%"] },
        { line: "Cash CAC (excl. SMQ, tuck-ins)", cells: ["$7,639", "$4,938", "$5,497", "$6,470", "$5,390", "$4,495"] },
      ],
    },
  },
};
