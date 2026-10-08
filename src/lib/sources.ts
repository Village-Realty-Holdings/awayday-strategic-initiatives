// Strategy reference data (source: Awayday_Strategic_Initiatives_Tracker.xlsx +
// 2026-05 reporting pack + 4/10/26 board deck). CIM/SI codes link to those records.

// EBITDA build to $150M (2026-05 reporting pack — Trended LTM PF EBITDA).
export const EBITDA_BUILD = {
  asOf: "May 2026",
  lender: 111.3,
  valuation: 101.1,
  target2026: 126,
  target2027: 150,
  ytdGrowth: 24.9,
  netLeverage: 5.18,
  units: 13833,
  ttmChurn: 12.9,
  bridge: [
    { label: "PF Base Business Adj. EBITDA", value: 76.5 },
    { label: "+ 2026 Acquisitions (Beach-Head + Fill-In)", value: 22.8 },
    { label: "+ Tuck-ins", value: 1.8 },
    { label: "LTM PF Valuation EBITDA", value: 101.1, subtotal: true },
    { label: "+ Identified VC & PI (run-rate)", value: 2.2 },
    { label: "+ New Unit Run-Rate Adj.", value: 8.0 },
    { label: "LTM PF Lender EBITDA", value: 111.3, total: true },
  ] as { label: string; value: number; subtotal?: boolean; total?: boolean }[],
  trend: [
    { m: "Dec", v: 86.4 },
    { m: "Jan", v: 87.0 },
    { m: "Feb", v: 104.2 },
    { m: "Mar", v: 104.3 },
    { m: "Apr", v: 109.3 },
    { m: "May", v: 111.3 },
  ],
};

// The Value Creation "house" (4/10/26 board deck).
export const VALUE_CREATION = {
  mission: "To Perfect the Vacation Rental Experience",
  objective: "$150M EBITDA by 12/31/27 · Guest CSAT > 4.65",
  valueDrivers: ["Grow new units", "Owner retention", "Margin expansion", "TrevPAR expansion", "M&A engine"],
  keyEnablers: ["Talent", "Technology", "Service"],
  values: ["Servant leadership", "Ownership mentality", "Local", "Excellence"],
  source: "4/10/26 board deck",
};

export type GoalColor = "green" | "amber" | "red" | "grey";

// 2026 cultural pillars (the bright future) — each item links to CIM risks + SIs.
export type PillarItem = { id: string; name: string; desc: string; cim: string[]; sis: string[] };
export type Pillar = { id: string; name: string; icon: string; headline: string; items: PillarItem[] };

export const PILLARS_2026: Pillar[] = [
  {
    id: "P1", name: "Strongest Team in the Industry", icon: "👥", headline: "Great businesses are built by great people",
    items: [
      { id: "P1-1", name: "HR Bar Raising", desc: "Hire / onboard CHRO", cim: ["CIM-09"], sis: ["TLT-01"] },
      { id: "P1-2", name: "Talent Engine", desc: "Best-in-class HRBP team", cim: ["CIM-09"], sis: ["TLT-02"] },
      { id: "P1-3", name: "Culture", desc: "Track ENPS, tie to manager performance, reporting, and M&A", cim: ["CIM-09"], sis: ["TLT-02"] },
      { id: "P1-4", name: "Celebrate Excellence", desc: "Shine a light on great work so it's seen and valued", cim: ["CIM-09"], sis: [] },
      { id: "P1-5", name: "L&D", desc: "Stand up v1.0 of L&D function", cim: ["CIM-09"], sis: ["TLT-03"] },
      { id: "P1-6", name: "Performance Mgmt", desc: "360 reviews 2x/yr", cim: ["CIM-09"], sis: ["TLT-04"] },
      { id: "P1-7", name: "Support", desc: "Dept talent plans (recruiting, L&D, engagement)", cim: ["CIM-09"], sis: ["SVC-01", "TLT-02"] },
    ],
  },
  {
    id: "P2", name: "Empowering smarter decisions through technology", icon: "💻", headline: "Speed, simplicity, and tools drive scale",
    items: [
      { id: "P2-1", name: "Reporting", desc: "Clear, real-time visibility into KPIs that drive faster decisions", cim: ["CIM-08"], sis: ["TEC-01"] },
      { id: "P2-2", name: "Best Practices", desc: "Written playbooks for key areas (e.g. cleaning) empower teams to act on data", cim: ["CIM-15"], sis: ["MRG-02"] },
      { id: "P2-3", name: "AI", desc: "Surfaces insights, automates workflows, answers questions", cim: ["CIM-16", "CIM-14"], sis: ["TEC-02", "BRD-02"] },
      { id: "P2-4", name: "Support", desc: "Department plans to use tech to improve performance & productivity", cim: ["CIM-08"], sis: ["TEC-03"] },
    ],
  },
  {
    id: "P3", name: "Building a Culture of Service (Team, Owner, Guest)", icon: "🤝", headline: "Customer satisfaction speeds the flywheel",
    items: [
      { id: "P3-1", name: "Service-First Talent", desc: "Great people provide great service (Support Leadership, Owner Relations, Guest Services)", cim: ["CIM-09"], sis: ["SVC-01"] },
      { id: "P3-2", name: "Speed Wins", desc: "Build culture of rapid, collaborative response", cim: [], sis: ["SVC-02"] },
      { id: "P3-3", name: "Tech-Enabled Service", desc: "Measure, simplify, automate", cim: ["CIM-14"], sis: ["SVC-02", "RET-04"] },
      { id: "P3-4", name: "Simplicity", desc: "KISS for service", cim: [], sis: ["SVC-02"] },
    ],
  },
];

// Financial & Operating Scorecard — the measurable 2026 goals.
export type Goal = {
  id: string; category: string; name: string; goal: string; ltm: string; ytdBud: string;
  status: string; color: GoalColor; owner: string; cim: string[]; sis: string[]; notes: string;
};

export const GOALS_2026: Goal[] = [
  { id: "G2026-01", category: "Unit Goals", name: "Gross Adds", goal: "25.0%", ltm: "28.9%", ytdBud: "22.5%", status: "Above goal", color: "green", owner: "Chief Revenue Officer", cim: ["CIM-01"], sis: ["GRW-01", "GRW-02", "GRW-03", "GRW-04", "GRW-05"], notes: "Excludes tuck-in adds. Above goal — protect via BD productivity and retention discipline." },
  { id: "G2026-02", category: "Unit Goals", name: "Owner Churn %", goal: "<11.0%", ltm: "12.9%", ytdBud: "12.0%", status: "-1.9pp off", color: "red", owner: "VP Owner Experience", cim: ["CIM-02"], sis: ["RET-01", "RET-02", "RET-03", "RET-04", "RET-05"], notes: "Owner Churn System (RET-01) is the central lever. System-not-heroics retention." },
  { id: "G2026-03", category: "Revenue Goals", name: "TrevPAR vs PY", goal: "+3.3%", ltm: "-0.8%", ytdBud: "3.3%", status: "-2.9pp off", color: "red", owner: "VP Revenue Management", cim: ["CIM-11"], sis: ["TRV-01", "TRV-02", "TRV-03", "TRV-04", "TRV-05", "RET-03"], notes: "Off plan. Recover via Pricing, Listing merch, OTA, and Revenue Value Creation." },
  { id: "G2026-04", category: "NOI Goals", name: "NOI Margin Impr vs PY (Excl OTA)", goal: "+1.0%", ltm: "-0.4%", ytdBud: "-1.3%", status: "YTD -1.5pp", color: "amber", owner: "CFO + VP Operations", cim: ["CIM-15"], sis: ["MRG-01", "MRG-02", "MRG-03", "MRG-04"], notes: "Tracking vs YTD bud. FY bud of 0.8%." },
  { id: "G2026-05", category: "NOI Goals", name: "NOI $ Growth vs PY (Base Bus)", goal: "+12.5%", ltm: "9.7%", ytdBud: "1.7%", status: "YTD +6.2pp", color: "green", owner: "CFO + VP Operations", cim: ["CIM-15"], sis: ["MRG-01", "MRG-02", "MRG-03", "MRG-04", "BRD-01"], notes: "Tracking vs YTD bud. FY bud of 11%. Strong YTD performance." },
  { id: "G2026-06", category: "PI Goals", name: "PI bps (Base Business)", goal: "50bps", ltm: "N/A", ytdBud: "41bps", status: "On track to bud", color: "amber", owner: "CFO", cim: ["CIM-15"], sis: ["BRD-01"], notes: "BRD-01 1H2026 PI Program drives this. ~$1.77M in opportunities to capture." },
  { id: "G2026-07", category: "M&A / VCP Goals", name: "Acquired EBITDA", goal: "$27.5M", ltm: "N/A", ytdBud: "$23.0M", status: "$18.1M PY pace", color: "amber", owner: "Head of M&A", cim: ["CIM-04", "CIM-05"], sis: ["M&A-01", "M&A-02", "M&A-04"], notes: "YTD pace. M&A Engine + Tuck-In Machine driving." },
  { id: "G2026-08", category: "M&A / VCP Goals", name: "Margin of Safety", goal: "25%", ltm: "N/A", ytdBud: "20%", status: "35% YTD", color: "green", owner: "Head of M&A", cim: ["CIM-04"], sis: ["M&A-02"], notes: "Above goal. Diligence discipline working." },
  { id: "G2026-09", category: "M&A / VCP Goals", name: "2025 Cohort EBITDA @ Close", goal: "120%", ltm: "93%", ytdBud: "115%", status: "-27pp off", color: "red", owner: "VP Value Creation", cim: ["CIM-07"], sis: ["M&A-03"], notes: "Off goal. Scale VC Capability is the critical lever — repeatable post-close playbook needed." },
  { id: "G2026-10", category: "Customer Experience", name: "Guest CSAT (company avg)", goal: "≥4.65 (no brand <4.5)", ltm: "populate", ytdBud: "—", status: "—", color: "grey", owner: "VP Customer Experience", cim: [], sis: ["SVC-01", "SVC-02"], notes: "Track ENPS too per cultural pillars. Service-First Talent + Tech-Enabled Service." },
];

// CIM register item (CIM-01…) → its measurable KPIs, derived from the goal↔CIM
// links above. Powers "KPIs tied to the CIM item" on the initiative form
// (Jakob, 2026-06-15: tie KPIs to the CIM backward item, not the broad driver).
export function cimKpiMap(): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const g of GOALS_2026) {
    for (const code of g.cim) {
      (m[code] ??= []).push(`${g.name} → ${g.goal}`);
    }
  }
  return m;
}

// Q2 2026 board initiatives — same shape as goals (owner/CIM/SI).
export type BoardItem = { id: string; name: string; desc: string; owner: string; cim: string[]; sis: string[]; color: GoalColor };

export const Q2_BOARD: BoardItem[] = [
  { id: "Q2-1", name: "M&A Engine", desc: "CRM, market mapping, outbound, pipeline productivity, tuck-in v2.", owner: "Head of M&A", cim: ["CIM-04", "CIM-05"], sis: ["M&A-01", "M&A-02", "M&A-03", "M&A-04"], color: "amber" },
  { id: "Q2-2", name: "Owner Churn System", desc: "Build the system that produces retention. No heroics. Define metrics, root-cause, address gaps.", owner: "VP Owner Experience", cim: ["CIM-02"], sis: ["RET-01"], color: "red" },
  { id: "Q2-3", name: "Revenue Value Creation", desc: "Win the first 90–180 days post-partnership. Win out of the gate on revenue.", owner: "Chief Revenue Officer", cim: ["CIM-11"], sis: ["TRV-01", "RET-03"], color: "amber" },
  { id: "Q2-4", name: "1H2026 PI", desc: "~$1.5M opportunities in the business + SupportCo $270K target.", owner: "CFO", cim: ["CIM-15"], sis: ["BRD-01"], color: "green" },
  { id: "Q2-5", name: "AI / Tech Roadmap", desc: "Strong AI / Tech roadmap that shows where we're going and how.", owner: "CTO", cim: ["CIM-08", "CIM-14", "CIM-16"], sis: ["BRD-02", "TEC-01", "TEC-02", "RET-04", "TRV-02", "SVC-02"], color: "green" },
];
