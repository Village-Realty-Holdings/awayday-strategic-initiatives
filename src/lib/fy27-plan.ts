import charters from "./fy27-charters.json";

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

/**
 * One SI's charter page, as transcribed from the deck (src/lib/fy27-charters.json):
 * text verbatim, blank cells null, due dates as written. A status of null means
 * the slide left the "On track / At risk / Off track" choice unmarked.
 */
export type Fy27Charter = {
  code: string;
  page: number;
  name: string;
  aopObjective: string | null;
  eltSponsor: string;
  siLead: string;
  status: "On track" | "At risk" | "Off track" | "Not started" | null;
  objective: string | null;
  metric: string | null;
  baseline: string | null;
  target: string | null;
  ebitdaValue: string | null;
  investmentCost: string | null;
  risks: { risk: string; mitigation: string | null; owner: string | null }[];
  dependencies: { need: string; fromWhom: string | null; byWhen: string | null }[];
  milestones: { title: string; owner: string | null; due: string | null }[];
  notes: string | null;
};

export type Fy27Initiative = Fy27Charter & { sourceKey: string; areaCode: string };

const CHARTERS = new Map((charters as Fy27Charter[]).map((c) => [c.code, c]));

// Stable code and source key per SI, and the area it sits under.
const INDEX = [
    { code: "FY27-SI-001", sourceKey: "m-and-a:build-tuck-in-machine", areaCode: "M&A" },
    { code: "FY27-SI-002", sourceKey: "m-and-a:org-planning-and-talent", areaCode: "M&A" },
    { code: "FY27-SI-003", sourceKey: "grow-new-units:bdm-coaching-and-enablement", areaCode: "GROW" },
    { code: "FY27-SI-004", sourceKey: "grow-new-units:bd-measurement", areaCode: "GROW" },
    { code: "FY27-SI-005", sourceKey: "grow-new-units:brand-optimization-via-growth-systems", areaCode: "GROW" },
    { code: "FY27-SI-006", sourceKey: "owner-retention:talent-upgrades", areaCode: "RETENTION" },
    { code: "FY27-SI-007", sourceKey: "owner-retention:scorecard-and-gbv-churn", areaCode: "RETENTION" },
    { code: "FY27-SI-008", sourceKey: "owner-retention:underperforming-brand-interventions", areaCode: "RETENTION" },
    { code: "FY27-SI-009", sourceKey: "trevpar:ai-revenue-manager", areaCode: "TREVPAR" },
    { code: "FY27-SI-010", sourceKey: "trevpar:listing-optimization", areaCode: "TREVPAR" },
    { code: "FY27-SI-011", sourceKey: "trevpar:channel-unit-economics", areaCode: "TREVPAR" },
    { code: "FY27-SI-012", sourceKey: "margin:awayday-wide-pi", areaCode: "MARGIN" },
    { code: "FY27-SI-013", sourceKey: "margin:bottoms-up-pi", areaCode: "MARGIN" },
    { code: "FY27-SI-015", sourceKey: "talent:org-design", areaCode: "TALENT" },
    { code: "FY27-SI-016", sourceKey: "talent:internal-talent-management", areaCode: "TALENT" },
    { code: "FY27-SI-017", sourceKey: "talent:external-pipeline", areaCode: "TALENT" },
    { code: "FY27-SI-018", sourceKey: "talent:incentives", areaCode: "TALENT" },
    { code: "FY27-SI-019", sourceKey: "talent:culture", areaCode: "TALENT" },
    { code: "FY27-SI-020", sourceKey: "finance:accounting-transformation", areaCode: "FINANCE" },
    { code: "FY27-SI-021", sourceKey: "finance:equity-for-all", areaCode: "FINANCE" },
    { code: "FY27-SI-022", sourceKey: "finance:improved-predictability", areaCode: "FINANCE" },
    { code: "FY27-SI-023", sourceKey: "finance:user-experience", areaCode: "FINANCE" },
    { code: "FY27-SI-024", sourceKey: "marketing:talent-upgrade", areaCode: "MARKETING" },
    { code: "FY27-SI-025", sourceKey: "marketing:seo-optimization-via-ai", areaCode: "MARKETING" },
    { code: "FY27-SI-026", sourceKey: "marketing:conversion-rate-optimization", areaCode: "MARKETING" },
    { code: "FY27-SI-027", sourceKey: "guest:conduit-rollout", areaCode: "GUEST" },
    { code: "FY27-SI-028", sourceKey: "tech:guest-relations-conduit-rollout", areaCode: "TECH" },
    { code: "FY27-SI-029", sourceKey: "tech:tuck-in-machine", areaCode: "TECH" },
    { code: "FY27-SI-030", sourceKey: "tech:security-program", areaCode: "TECH" },
    { code: "FY27-SI-031", sourceKey: "tech:owner-relations", areaCode: "TECH" },
    { code: "FY27-SI-032", sourceKey: "owner-retention:onboarding-experience", areaCode: "RETENTION" },
];

export const FY27_PLAN = {
  code: "FY27",
  title: "Awayday Strategic Initiatives — FY27",
  sourceFileName: "260930 Awayday SI Refresh_v1.pdf",
  areas: [
    { code: "M&A", kind: "VALUE_DRIVER", name: "M&A", goal: "Deepen our moat as the acquirer of choice in the industry, through the fastest and easiest acquisition process in the industry.", kpiName: "Acquired EBITDA closed", kpiTarget: "$26M total; $11M via tuck-ins; $47M stretch", owner: "Ryan McKendry / Curt Stark / Bart Williams", order: 1 },
    { code: "GROW", kind: "VALUE_DRIVER", name: "Grow New Units", goal: "Build the highest skilled, best trained and tech-enabled salesforce and sales management capability.", kpiName: "Gross unit adds", kpiTarget: "23% budget; 28% stretch", owner: "Ryan Olin / David Jensen", order: 2 },
    { code: "RETENTION", kind: "VALUE_DRIVER", name: "Owner Retention", goal: "Do the basics brilliantly to create the best owner experience, with an upskilled team that focuses on revenue, property care and owner comms every day.", kpiName: "Owner unit churn (TTM)", kpiTarget: "11% budget; 9% stretch", owner: "Dan Yankley / Justin Ridgeway / Kyle Sullivan", order: 3 },
    { code: "TREVPAR", kind: "VALUE_DRIVER", name: "TRevPAR Expansion", goal: "Beat the market on TRevPAR: deliver 5% YoY growth against a roughly 2.9% market forecast, while scaling revenue-management capacity toward 1,000 units per RM.", kpiName: "TRevPAR growth (YoY)", kpiTarget: "1% budget; 5% stretch", owner: "Danny Bradford / Carter Achilles", order: 4 },
    { code: "MARGIN", kind: "VALUE_DRIVER", name: "Margin Expansion", goal: "Create a day 1 cost culture with a winning ownership mindset in every part of Awayday, that makes us the most cost competitive business by managing to unit-level profitability.", kpiName: "Shop NOI margin vs PY", kpiTarget: "+0.25% budget; +1% stretch", owner: "Dan Yankley / Justin Ridgeway / Kyle Sullivan", order: 5 },
    { code: "TECH", kind: "ENABLER", name: "Tech & AI", goal: "Put frontier technology and AI in the hands of every team, so Awayday runs on a platform built for a $300M business.", kpiName: "Properties per FTE in use-case functions; tool adoption", owner: "Tom Chess / Mohan Chandolu", order: 1 },
    { code: "TALENT", kind: "ENABLER", name: "Talent", goal: "Build the strongest team in the industry, with the incentives, development and org design a $300M business needs.", owner: "Dave Galford / Adam Hamdan", order: 2 },
    { code: "FINANCE", kind: "ENABLER", name: "Finance", goal: "By the end of 2027, Finance runs a standardized, largely automated close and forecast process, with FP&A partnered regionally, supporting a $300M EBITDA business.", owner: "David Reed / Kyle Campbell", order: 3 },
    { code: "MARKETING", kind: "ENABLER", name: "Marketing", goal: "Build direct demand and brand strength that lowers what it costs us to win owners and guests.", kpiName: "Direct GBV growth (YoY)", kpiTarget: "TBD", owner: "Danny Bradford / Lee Sims", order: 4 },
    { code: "GUEST", kind: "ENABLER", name: "Guest Experience", goal: "Make every stay one a guest would book again, and tell someone about, by tackling issues proactively.", kpiName: "Guest satisfaction score", kpiTarget: "75% target; 80% stretch", owner: "Dan Yankley / Justin Ridgeway / Kyle Sullivan", order: 5 },
  ] satisfies Fy27Area[],
  initiatives: INDEX.map((item): Fy27Initiative => {
    const charter = CHARTERS.get(item.code);
    if (!charter) throw new Error(`No charter transcribed for ${item.code}`);
    return { ...charter, ...item };
  }),
} as const;
