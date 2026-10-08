import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { parseRecipients } from "@/lib/recipients";

// Monthly AI spend guardrail (Mohan, 9/9: "if anything goes rogue we don't end
// up consuming tokens much beyond what it should, the system ideally should
// stop functioning and trigger a notification").
//
// Posture, in priority order:
//   1. A breach PAUSES AI: assertAiBudget() throws before any Anthropic call,
//      and every caller already degrades to its non-AI path (the same path it
//      takes when ANTHROPIC_API_KEY is missing). Everything else keeps working.
//   2. The guardrail itself never breaks the product: a missing or malformed
//      budget means "no cap", and a DB error while checking means "allow and
//      log". Blocking every AI feature because the budget row is unreadable
//      would be the outage Mohan is trying to avoid, not the protection.
//   3. Alerts are best-effort (mirrors src/lib/audit.ts): they never throw and
//      never block the invocation that triggered them.
//
// No schema: the budget, the recipients and the per-month alert dedupe all
// live in the existing Setting key/value table; spend is SUM(costUsd) over
// ai_invocation for the current UTC month (recorded since 2026-08-31).
//
// Import discipline: this module may import prisma, email, and pure helpers
// ONLY. ai-telemetry.ts imports it, and ai.ts imports ai-telemetry.ts, so
// importing either from here would create a cycle.

/** Setting override for the monthly cap in USD (admin-editable on /admin/ai-telemetry). */
export const AI_BUDGET_KEY = "ai.monthly_budget_usd";
/** Setting holding a comma-separated alert recipient list. */
export const AI_BUDGET_RECIPIENTS_KEY = "ai.budget_alert_recipients";
/** Used when neither the Setting row nor env AI_MONTHLY_BUDGET_USD is set. */
export const DEFAULT_AI_MONTHLY_BUDGET_USD = 250;
/** Prefix of the per-month, per-threshold dedupe keys: ai.budget_alert.<YYYY-MM>.<pct>. */
export const AI_BUDGET_ALERT_KEY_PREFIX = "ai.budget_alert";

/**
 * The user-facing message. Talent surfaces `e.message` directly and the deal
 * page renders it in a "review failed" pill, so it must read like product copy,
 * not an internal error. No em dashes (house style).
 */
export const AI_BUDGET_EXCEEDED_MESSAGE =
  "AI features are paused for the rest of the month: the monthly AI budget has been reached. Everything else keeps working.";

export const ALERT_THRESHOLDS = [80, 100] as const;
export type AlertThreshold = (typeof ALERT_THRESHOLDS)[number];

export class AiBudgetExceededError extends Error {
  name = "AiBudgetExceededError";
  constructor(message: string = AI_BUDGET_EXCEEDED_MESSAGE) {
    super(message);
  }
}

/** The UTC calendar month containing `now`: [start, end) plus a YYYY-MM label. */
export function monthWindow(now: Date = new Date()): { start: Date; end: Date; label: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 1));
  return { start, end, label: `${y}-${String(m + 1).padStart(2, "0")}` };
}

/** "2026-09" -> "September 2026", for email and page copy. */
export function formatMonthLabel(label: string): string {
  const [y, m] = label.split("-").map(Number);
  if (!y || !m) return label;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Parse a budget value. A positive finite number caps spend; "0", "off",
 * blank, or anything unparseable means no cap (null). Accepts "$1,000".
 */
export function parseBudget(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s || s === "off" || s === "none") return null;
  const n = Number(s.replace(/^\$/, "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/**
 * Effective monthly budget in USD, or null when uncapped.
 * Precedence: Setting row (when present, even if it says "off") > env
 * AI_MONTHLY_BUDGET_USD (when set) > DEFAULT_AI_MONTHLY_BUDGET_USD.
 * A read failure resolves to null (no cap) and logs; see posture note 2.
 */
export async function getAiBudgetUsd(): Promise<number | null> {
  try {
    const stored = await readSetting(AI_BUDGET_KEY);
    if (stored != null && stored.trim() !== "") return parseBudget(stored);
    const env = process.env.AI_MONTHLY_BUDGET_USD;
    if (env != null && env.trim() !== "") return parseBudget(env);
    return DEFAULT_AI_MONTHLY_BUDGET_USD;
  } catch (e) {
    console.error("ai budget: could not read budget setting; treating as uncapped", e);
    return null;
  }
}

/** SUM(costUsd) over ai_invocation rows in the current UTC month; 0 when none. */
export async function getMonthToDateSpendUsd(now: Date = new Date()): Promise<number> {
  const { start, end } = monthWindow(now);
  const agg = await prisma.aiInvocation.aggregate({
    _sum: { costUsd: true },
    where: { occurredAt: { gte: start, lt: end } },
  });
  // Prisma returns a Decimal (or null when no priced rows). String round-trip
  // keeps the 6-place precision regardless of the Decimal implementation.
  const raw = agg._sum.costUsd;
  const n = raw == null ? 0 : Number(String(raw));
  return Number.isFinite(n) ? n : 0;
}

export type BudgetStatus = {
  budget: number | null; // null = uncapped
  spent: number;
  ratio: number | null; // spent / budget; null when uncapped
  allowed: boolean;
  month: string; // YYYY-MM (UTC)
};

export async function getAiBudgetStatus(now: Date = new Date()): Promise<BudgetStatus> {
  const [budget, spent] = await Promise.all([getAiBudgetUsd(), getMonthToDateSpendUsd(now)]);
  const ratio = budget == null ? null : spent / budget;
  return { budget, spent, ratio, allowed: budget == null || spent < budget, month: monthWindow(now).label };
}

/**
 * Gate for every Anthropic call. Throws AiBudgetExceededError when month-to-
 * date spend has reached the budget. NEVER throws for any other reason: a
 * database or config failure logs and allows the call (posture note 2).
 */
export async function assertAiBudget(): Promise<void> {
  let status: BudgetStatus;
  try {
    status = await getAiBudgetStatus();
  } catch (e) {
    console.error("ai budget: check failed; allowing the call", e);
    return;
  }
  if (!status.allowed) throw new AiBudgetExceededError();
}

/** Pure: which thresholds (80, 100) lie in (prevRatio, ratio]. */
export function alertThresholdsCrossed(prevRatio: number, ratio: number): AlertThreshold[] {
  return ALERT_THRESHOLDS.filter((pct) => prevRatio < pct / 100 && ratio >= pct / 100);
}

/** Alert recipients. Precedence: Setting row > env AI_BUDGET_ALERT_TO > []. Never throws. */
export async function getAlertRecipients(): Promise<string[]> {
  try {
    const stored = await readSetting(AI_BUDGET_RECIPIENTS_KEY);
    if (stored != null && stored.trim() !== "") return parseRecipients(stored);
    return parseRecipients(process.env.AI_BUDGET_ALERT_TO);
  } catch (e) {
    console.error("ai budget: could not read alert recipients", e);
    return [];
  }
}

/** Raw Setting values for the admin forms ("" when never set). Never throw. */
export async function getAiBudgetSettingRaw(): Promise<string> {
  try {
    return (await readSetting(AI_BUDGET_KEY)) ?? "";
  } catch {
    return "";
  }
}
export async function getAlertRecipientsSettingRaw(): Promise<string> {
  try {
    return (await readSetting(AI_BUDGET_RECIPIENTS_KEY)) ?? "";
  } catch {
    return "";
  }
}

// ── Admin form parsers (pure) ────────────────────────────────────────────────
// Used by adminSetAiBudget / adminSetAiBudgetRecipients. Invalid input is
// rejected with product copy rather than silently coerced.

export type BudgetInput =
  | { ok: true; store: string | null; budget: number | null } // store null = clear the override
  | { ok: false; error: string };

export function parseBudgetInput(raw: string): BudgetInput {
  const s = raw.trim();
  if (!s) return { ok: true, store: null, budget: null };
  const lower = s.toLowerCase();
  const cleaned = lower.replace(/^\$/, "").replace(/,/g, "");
  if (lower === "off" || lower === "none" || (cleaned !== "" && Number(cleaned) === 0)) {
    return { ok: true, store: "off", budget: null };
  }
  const n = parseBudget(s);
  if (n == null) return { ok: false, error: "Enter a dollar amount (for example 250), or 0 / off to remove the cap." };
  return { ok: true, store: String(n), budget: n };
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecipientsInput = { ok: true; store: string; list: string[] } | { ok: false; error: string };

export function parseRecipientsInput(raw: string): RecipientsInput {
  const entered = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const invalid = entered.filter((e) => !EMAIL_SHAPE.test(e));
  if (invalid.length > 0) {
    return { ok: false, error: `Not a valid email address: ${invalid.join(", ")}. Use a comma-separated list.` };
  }
  const list = parseRecipients(raw);
  return { ok: true, store: list.join(", "), list };
}

const usd = (n: number) => `$${n.toFixed(2)}`;

export function buildBudgetAlertEmail(status: BudgetStatus, pct: AlertThreshold): { subject: string; text: string; html: string } {
  const month = formatMonthLabel(status.month);
  const budget = status.budget ?? 0;
  const subject = `Awayday AI spend at ${pct}% of the monthly budget`;
  const state =
    pct >= 100
      ? `AI features are now paused for the rest of ${month}. All non-AI functionality continues as normal. Raise the budget on the admin page to resume AI features this month.`
      : `AI features pause automatically when spend reaches 100% of the budget. All non-AI functionality continues as normal.`;
  const lines = [
    `AI spend on the Awayday platform for ${month} has reached ${pct}% of the monthly budget.`,
    "",
    `Spent so far: ${usd(status.spent)}`,
    `Monthly budget: ${usd(budget)}`,
    "",
    state,
    "",
    "To change the budget or these recipients, open Admin, then AI telemetry (/admin/ai-telemetry) in the Awayday platform.",
  ];
  const text = lines.join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2933">` +
    `<p>${esc(lines[0])}</p>` +
    `<p><strong>Spent so far:</strong> ${usd(status.spent)}<br/><strong>Monthly budget:</strong> ${usd(budget)}</p>` +
    `<p>${esc(state)}</p>` +
    `<p style="color:#52606d;font-size:13px">${esc(lines[lines.length - 1])}</p>` +
    `</div>`;
  return { subject, text, html };
}

/**
 * Send the 80% / 100% alerts for the month when reached, at most once per
 * threshold per month. Safe to call after every invocation. Dedupe is a
 * Setting row per (month, threshold), claimed with upsert-if-absent: the row
 * is created with a per-call token and only the caller whose token survives
 * sends, so two concurrent invocations cannot both alert. Swallows everything.
 */
export async function maybeAlertAiBudget(status: BudgetStatus): Promise<void> {
  if (status.budget == null || status.ratio == null) return;
  const due = alertThresholdsCrossed(0, status.ratio);
  if (due.length === 0) return;
  try {
    const recipients = await getAlertRecipients();
    if (recipients.length === 0) {
      // Leave the dedupe keys unclaimed so the alert fires once a recipient is set.
      console.warn("ai budget: threshold reached but no alert recipients configured", { month: status.month, due });
      return;
    }
    for (const pct of due) {
      const key = `${AI_BUDGET_ALERT_KEY_PREFIX}.${status.month}.${pct}`;
      const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const row = await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value: token } });
      if (row.value !== token) continue; // already alerted this month
      const mail = buildBudgetAlertEmail(status, pct);
      for (const to of recipients) {
        const res = await sendEmail({ to, ...mail });
        if (!res.ok) console.error("ai budget: alert email failed", { to, pct, error: res.error });
      }
    }
  } catch (e) {
    console.error("ai budget: alert failed", e);
  }
}
