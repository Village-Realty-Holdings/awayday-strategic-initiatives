// Typed models for the V2 Strategy Review mock. They deliberately mirror the
// schema planned for the real tool (ReviewPeriod, ReviewSoWhat, ReviewPillar,
// ReviewSiSnapshot, InitiativeUpdate) but nothing here touches Prisma.

export type Person = {
  id: string;
  name: string;
  /** "team" = a group shown as an owner (FP&A, PI working group). */
  kind: "person" | "team";
};

export type AreaKind = "VALUE_DRIVER" | "ENABLER";

export type MockArea = {
  code: string;
  name: string;
  kind: AreaKind;
  /** 1-5 for the five value-creation pillars. */
  number?: number;
  goal: string;
  kpiName?: string;
  kpiTarget?: string;
  eltOwnerIds: string[];
  siLeadIds: string[];
};

/** The four-step scale owners use when they report on an SI. */
export type SiStatus = "AHEAD" | "ON_TRACK" | "AT_RISK" | "BEHIND";

/** Where an owner's monthly update stands. */
export type UpdateState = "SUBMITTED" | "DRAFT" | "NOT_SUBMITTED";

export type MockSi = {
  code: string;
  name: string;
  areaCode: string;
  /** What it is. */
  objective: string;
  /** What it is going for (metric + target, or a note that it is undefined). */
  goingFor: string;
  valueMetric?: string;
  valueTarget?: string;
  ownerId: string | null;
  sponsorLabel: string;
  risks: string[];
  dependencies: { siCode?: string; text: string }[];
};

/** One owner update for one SI for one review period. */
export type InitiativeUpdate = {
  id: string;
  siCode: string;
  /** Review period id, e.g. "2026-09". */
  period: string;
  authorId: string | null;
  status: SiStatus | null;
  latestProgress: string;
  whatNext: string;
  state: UpdateState;
  submittedAt?: string;
  updatedAt?: string;
};

/** What the review page freezes for one SI: the submitted update, or nothing (TBD). */
export type ReviewSiSnapshot = {
  periodId: string;
  siCode: string;
  status: SiStatus | null;
  latestProgress: string | null;
  whatNext: string | null;
  state: UpdateState;
};

export type MilestoneKind = "SI" | "SI_PROCESS" | "ALL";

export type MockMilestone = {
  id: string;
  kind: MilestoneKind;
  /** Area code, or "ALL" for company-wide items. */
  pillar: string;
  siCode?: string;
  title: string;
  /** ISO date (yyyy-mm-dd). For ranges this is the start. */
  date: string;
  endDate?: string;
  /** Shown instead of a day when the source only gives a month. */
  approxLabel?: string;
  ownerIds: string[];
  done: boolean;
};

export type MockActionItem = {
  id: string;
  siCode: string;
  ownerId: string;
  text: string;
  due: string;
  done: boolean;
};

export type EltAsk = {
  id: string;
  siCode: string;
  fromId: string;
  text: string;
  raisedOn: string;
  due?: string;
  open: boolean;
};

export type PeriodStatus = "DRAFT" | "PUBLISHED";

export type ReviewTile = { label: string; value: string; sub: string };

export type ReviewPeriod = {
  id: string;
  label: string;
  /** Short month name used in headings, e.g. "September". */
  monthName: string;
  status: PeriodStatus;
  dataAsOf: string;
  preparedBy: string;
  financeSource: string;
  meetingDate: string;
  updatesDueDate: string;
  publishedAt?: string;
  tiles: ReviewTile[];
  sources: string[];
  dataNotes: string[];
  sourcesFooter: string;
};

export type ReviewSoWhat = {
  id: string;
  periodId: string;
  /** "SUMMARY" or a pillar/area code. */
  scope: string;
  order: number;
  headline: string;
  body: string;
};

export type PillarTone = "ahead" | "on_track" | "watch" | "behind";

export type ReviewPillar = {
  periodId: string;
  areaCode: string;
  label: string;
  tone: PillarTone;
  measure: string;
  headline: string;
  headlineNote: string;
  /** One-line summary shown on the pillar card. */
  cardSub: string;
  monthValue: string;
  ytdValue: string;
  goal2026: string;
  fy27: string;
  goal2026Note: string;
  fy27Note: string;
  commentary: string;
  /** Enablers: measure/candidate-measure text. */
  enablerNote?: string;
  extra?: { title: string; items: string[] };
};

export type FinanceRow = { line: string; cells: string[]; bold?: boolean };
export type FinanceTable = { title: string; columns: string[]; rows: FinanceRow[] };
