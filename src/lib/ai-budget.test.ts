import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The monthly AI budget is the platform's spend guardrail (Mohan, 9/9: "if
// anything goes rogue ... the system should stop functioning and trigger a
// notification"). It must fail SAFE in both directions: a breach pauses AI
// features (callers already degrade to their non-AI paths), while a missing
// or broken config, a DB error, or an email failure must never block a call.

const { settingFindUnique, settingUpsert, aggregateMock, sendEmailMock } = vi.hoisted(() => ({
  settingFindUnique: vi.fn(),
  settingUpsert: vi.fn(),
  aggregateMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: settingFindUnique, upsert: settingUpsert },
    aiInvocation: { aggregate: aggregateMock },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
  emailConfigured: () => true,
}));

import {
  AI_BUDGET_KEY,
  AI_BUDGET_RECIPIENTS_KEY,
  AI_BUDGET_EXCEEDED_MESSAGE,
  DEFAULT_AI_MONTHLY_BUDGET_USD,
  AiBudgetExceededError,
  alertThresholdsCrossed,
  assertAiBudget,
  getAiBudgetStatus,
  getAiBudgetUsd,
  getAlertRecipients,
  getMonthToDateSpendUsd,
  maybeAlertAiBudget,
  monthWindow,
  parseBudget,
  parseBudgetInput,
  parseRecipientsInput,
  type BudgetStatus,
} from "./ai-budget";

/** In-memory Setting table so dedupe behaves like the real upsert-if-absent. */
function useSettingStore(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  settingFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
    const value = store.get(where.key);
    return value === undefined ? null : { key: where.key, value };
  });
  settingUpsert.mockImplementation(
    async ({ where, create }: { where: { key: string }; create: { key: string; value: string } }) => {
      if (!store.has(where.key)) store.set(where.key, create.value);
      return { key: where.key, value: store.get(where.key)! };
    },
  );
  return store;
}

function spend(total: number | null) {
  aggregateMock.mockResolvedValue({ _sum: { costUsd: total == null ? null : { toString: () => String(total) } } });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  settingFindUnique.mockReset().mockResolvedValue(null);
  settingUpsert.mockReset();
  aggregateMock.mockReset();
  sendEmailMock.mockReset().mockResolvedValue({ ok: true, id: "em_1" });
  spend(0);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("monthWindow", () => {
  it("spans the UTC calendar month containing `now`", () => {
    const w = monthWindow(new Date("2026-09-09T15:30:00Z"));
    expect(w.start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(w.label).toBe("2026-09");
  });

  it("rolls the year over in December and is exclusive at the end boundary", () => {
    const w = monthWindow(new Date("2026-12-31T23:59:59.999Z"));
    expect(w.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(w.label).toBe("2026-12");
    // The first instant of the next month belongs to the next window.
    expect(monthWindow(w.end).label).toBe("2027-01");
  });
});

describe("parseBudget", () => {
  it.each([
    ["250", 250],
    [" 250.50 ", 250.5],
    ["$1,000", 1000],
    ["0", null],
    ["off", null],
    ["OFF", null],
    ["abc", null],
    ["-5", null],
    ["", null],
    [null, null],
    [undefined, null],
  ])("parseBudget(%j) -> %j", (raw, expected) => {
    expect(parseBudget(raw)).toBe(expected);
  });
});

describe("getAiBudgetUsd precedence", () => {
  it("uses the Setting row over the env var", async () => {
    useSettingStore({ [AI_BUDGET_KEY]: "400" });
    vi.stubEnv("AI_MONTHLY_BUDGET_USD", "100");
    await expect(getAiBudgetUsd()).resolves.toBe(400);
  });

  it("falls back to the env var when no Setting row exists", async () => {
    vi.stubEnv("AI_MONTHLY_BUDGET_USD", "100");
    await expect(getAiBudgetUsd()).resolves.toBe(100);
  });

  it("falls back to the code default when neither is set", async () => {
    await expect(getAiBudgetUsd()).resolves.toBe(DEFAULT_AI_MONTHLY_BUDGET_USD);
  });

  it("an explicit 'off' in the Setting removes the cap even when env has a value", async () => {
    useSettingStore({ [AI_BUDGET_KEY]: "off" });
    vi.stubEnv("AI_MONTHLY_BUDGET_USD", "100");
    await expect(getAiBudgetUsd()).resolves.toBeNull();
  });

  it("a broken config means no cap, never a block", async () => {
    settingFindUnique.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getAiBudgetUsd()).resolves.toBeNull();
  });
});

describe("getMonthToDateSpendUsd", () => {
  it("sums costUsd over the month window", async () => {
    spend(12.345678);
    const now = new Date("2026-09-09T12:00:00Z");
    await expect(getMonthToDateSpendUsd(now)).resolves.toBeCloseTo(12.345678, 6);
    const arg = aggregateMock.mock.calls[0][0];
    expect(arg._sum).toEqual({ costUsd: true });
    expect(arg.where.occurredAt.gte.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(arg.where.occurredAt.lt.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("is 0 when there are no priced rows (SUM returns null)", async () => {
    spend(null);
    await expect(getMonthToDateSpendUsd()).resolves.toBe(0);
  });
});

describe("getAiBudgetStatus", () => {
  it("reports budget, spend, ratio, and allowed", async () => {
    useSettingStore({ [AI_BUDGET_KEY]: "200" });
    spend(50);
    const st = await getAiBudgetStatus(new Date("2026-09-09T00:00:00Z"));
    expect(st).toEqual({ budget: 200, spent: 50, ratio: 0.25, allowed: true, month: "2026-09" });
  });

  it("ratio is null and allowed is true when uncapped", async () => {
    useSettingStore({ [AI_BUDGET_KEY]: "off" });
    spend(99999);
    const st = await getAiBudgetStatus();
    expect(st.budget).toBeNull();
    expect(st.ratio).toBeNull();
    expect(st.allowed).toBe(true);
  });
});

describe("assertAiBudget", () => {
  it("throws AiBudgetExceededError with the user-facing message when spend >= budget", async () => {
    useSettingStore({ [AI_BUDGET_KEY]: "100" });
    spend(100);
    const err = await assertAiBudget().catch((e) => e);
    expect(err).toBeInstanceOf(AiBudgetExceededError);
    expect(err.name).toBe("AiBudgetExceededError");
    expect(err.message).toBe(AI_BUDGET_EXCEEDED_MESSAGE);
    expect(err.message).not.toContain("—");
  });

  it("allows below the budget", async () => {
    useSettingStore({ [AI_BUDGET_KEY]: "100" });
    spend(99.99);
    await expect(assertAiBudget()).resolves.toBeUndefined();
  });

  it("allows when the budget is off", async () => {
    useSettingStore({ [AI_BUDGET_KEY]: "0" });
    spend(1e9);
    await expect(assertAiBudget()).resolves.toBeUndefined();
  });

  it("allows (and logs) when the database throws: a guardrail outage never blocks AI", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    aggregateMock.mockRejectedValue(new Error("db down"));
    await expect(assertAiBudget()).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
  });
});

describe("alertThresholdsCrossed", () => {
  it.each<[number, number, Array<80 | 100>]>([
    [0, 0.5, []],
    [0, 0.8, [80]],
    [0.79, 0.81, [80]],
    [0.8, 0.9, []],
    [0.9, 1.0, [100]],
    [0, 1.2, [80, 100]],
    [1.0, 1.5, []],
    [0.5, 0.5, []],
  ])("prev=%s now=%s -> %j", (prev, now, expected) => {
    expect(alertThresholdsCrossed(prev, now)).toEqual(expected);
  });
});

describe("maybeAlertAiBudget", () => {
  const status = (ratio: number, budget = 250): BudgetStatus => ({
    budget,
    spent: budget * ratio,
    ratio,
    allowed: ratio < 1,
    month: "2026-09",
  });

  it("sends the 80% alert once per month to every recipient, deduped by a Setting key", async () => {
    const store = useSettingStore({ [AI_BUDGET_RECIPIENTS_KEY]: "a@awayday.com, b@awayday.com" });
    await maybeAlertAiBudget(status(0.82));
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock.mock.calls.map((c) => c[0].to).sort()).toEqual(["a@awayday.com", "b@awayday.com"]);
    const mail = sendEmailMock.mock.calls[0][0];
    expect(mail.subject).toBe("Awayday AI spend at 80% of the monthly budget");
    expect(mail.text).toContain("$205.00");
    expect(mail.text).toContain("$250.00");
    expect(mail.text).toMatch(/September 2026/);
    expect(mail.text).toMatch(/pause automatically/i);
    expect(mail.html).toContain("80%");
    expect(mail.text + mail.html + mail.subject).not.toContain("—");
    expect(store.has("ai.budget_alert.2026-09.80")).toBe(true);

    // Second invocation in the same month: already alerted, nothing sent.
    await maybeAlertAiBudget(status(0.9));
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("sends the 100% alert (and the 80% one if it never fired) when the budget is reached", async () => {
    useSettingStore({ [AI_BUDGET_RECIPIENTS_KEY]: "a@awayday.com" });
    await maybeAlertAiBudget(status(1.01));
    const subjects = sendEmailMock.mock.calls.map((c) => c[0].subject);
    expect(subjects).toEqual([
      "Awayday AI spend at 80% of the monthly budget",
      "Awayday AI spend at 100% of the monthly budget",
    ]);
    expect(sendEmailMock.mock.calls[1][0].text).toMatch(/paused/i);
  });

  it("does nothing below 80% or when uncapped", async () => {
    useSettingStore({ [AI_BUDGET_RECIPIENTS_KEY]: "a@awayday.com" });
    await maybeAlertAiBudget(status(0.5));
    await maybeAlertAiBudget({ budget: null, spent: 5000, ratio: null, allowed: true, month: "2026-09" });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(settingUpsert).not.toHaveBeenCalled();
  });

  it("does not burn the dedupe key when there are no recipients, so adding one later still alerts", async () => {
    const store = useSettingStore({});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await maybeAlertAiBudget(status(0.85));
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(store.has("ai.budget_alert.2026-09.80")).toBe(false);
  });

  it("swallows send and database failures", async () => {
    useSettingStore({ [AI_BUDGET_RECIPIENTS_KEY]: "a@awayday.com" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    sendEmailMock.mockRejectedValue(new Error("resend down"));
    await expect(maybeAlertAiBudget(status(0.85))).resolves.toBeUndefined();

    settingUpsert.mockRejectedValue(new Error("db down"));
    await expect(maybeAlertAiBudget(status(1.5))).resolves.toBeUndefined();
  });
});

describe("getAlertRecipients", () => {
  it("prefers the Setting row over the env var and validates addresses", async () => {
    useSettingStore({ [AI_BUDGET_RECIPIENTS_KEY]: "a@awayday.com, not-an-email, A@awayday.com" });
    vi.stubEnv("AI_BUDGET_ALERT_TO", "env@awayday.com");
    await expect(getAlertRecipients()).resolves.toEqual(["a@awayday.com"]);
  });

  it("falls back to AI_BUDGET_ALERT_TO, then to an empty list", async () => {
    vi.stubEnv("AI_BUDGET_ALERT_TO", "env@awayday.com,two@awayday.com");
    await expect(getAlertRecipients()).resolves.toEqual(["env@awayday.com", "two@awayday.com"]);
    vi.stubEnv("AI_BUDGET_ALERT_TO", "");
    await expect(getAlertRecipients()).resolves.toEqual([]);
  });

  it("is empty (never throws) when the database is down", async () => {
    settingFindUnique.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getAlertRecipients()).resolves.toEqual([]);
  });
});

// Form parsers used by the admin actions (src/app/(app)/admin/actions.ts).
// Pure, so the validation copy and the stored normal form are pinned here.
describe("parseBudgetInput (admin form)", () => {
  it("normalizes a dollar amount to the stored value", () => {
    expect(parseBudgetInput("250")).toEqual({ ok: true, store: "250", budget: 250 });
    expect(parseBudgetInput(" $1,000.50 ")).toEqual({ ok: true, store: "1000.5", budget: 1000.5 });
  });
  it("'0' and 'off' store 'off' (no cap)", () => {
    expect(parseBudgetInput("0")).toEqual({ ok: true, store: "off", budget: null });
    expect(parseBudgetInput("OFF")).toEqual({ ok: true, store: "off", budget: null });
  });
  it("blank clears the override so env / default applies again", () => {
    expect(parseBudgetInput("")).toEqual({ ok: true, store: null, budget: null });
    expect(parseBudgetInput("   ")).toEqual({ ok: true, store: null, budget: null });
  });
  it("rejects anything else with product copy (no em dashes)", () => {
    for (const bad of ["abc", "-5", "1e400", "12abc"]) {
      const r = parseBudgetInput(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toMatch(/dollar amount/i);
        expect(r.error).not.toContain("—");
      }
    }
  });
});

describe("parseRecipientsInput (admin form)", () => {
  it("cleans and dedupes a valid list", () => {
    expect(parseRecipientsInput(" a@awayday.com ,b@awayday.com, A@awayday.com ")).toEqual({
      ok: true,
      store: "a@awayday.com, b@awayday.com",
      list: ["a@awayday.com", "b@awayday.com"],
    });
  });
  it("blank is allowed and stores an empty list", () => {
    expect(parseRecipientsInput("")).toEqual({ ok: true, store: "", list: [] });
  });
  it("rejects invalid entries up front instead of silently dropping them", () => {
    const r = parseRecipientsInput("a@awayday.com, nope, also bad");
    expect(r).toEqual({ ok: false, error: "Not a valid email address: nope, also bad. Use a comma-separated list." });
  });
});
