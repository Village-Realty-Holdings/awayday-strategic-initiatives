import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unit tests with prisma mocked: the telemetry writer must be fire-and-forget
// (never throws to callers), honor the AI_TELEMETRY kill switch, price the
// call at write time, and classify SDK errors without leaking message bodies.

const { createMock, updateManyMock, statusMock, alertMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateManyMock: vi.fn(),
  statusMock: vi.fn(),
  alertMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { aiInvocation: { create: createMock, updateMany: updateManyMock } },
}));

// The budget module is mocked: the writer only needs to hand each priced
// write's status to the alerter, fire-and-forget.
vi.mock("@/lib/ai-budget", () => ({
  getAiBudgetStatus: statusMock,
  maybeAlertAiBudget: alertMock,
}));

import { recordAiInvocation, updateAiAcceptance, classifyAiError, telemetryEnabled } from "./ai-telemetry";

const STATUS = { budget: 250, spent: 10, ratio: 0.04, allowed: true, month: "2026-09" };
const flush = () => new Promise((r) => setImmediate(r));

const BASE = {
  module: "INITIATIVES" as const,
  feature: "ask-board",
  model: "claude-sonnet-5",
  latencyMs: 1234.6,
  inputTokens: 1000,
  outputTokens: 500,
  outcome: "OK" as const,
  userId: "user_1",
};

beforeEach(() => {
  createMock.mockReset().mockResolvedValue({ id: "inv_1" });
  updateManyMock.mockReset().mockResolvedValue({ count: 1 });
  statusMock.mockReset().mockResolvedValue(STATUS);
  alertMock.mockReset().mockResolvedValue(undefined);
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("recordAiInvocation", () => {
  it("writes one record and returns its id", async () => {
    const id = await recordAiInvocation(BASE);
    expect(id).toBe("inv_1");
    expect(createMock).toHaveBeenCalledTimes(1);
    const data = createMock.mock.calls[0][0].data;
    expect(data).toMatchObject({
      module: "INITIATIVES",
      feature: "ask-board",
      model: "claude-sonnet-5",
      latencyMs: 1235, // rounded to whole ms
      inputTokens: 1000,
      outputTokens: 500,
      outcome: "OK",
      userId: "user_1",
    });
  });

  it("prices the call at write time (decimal string, 6 places)", async () => {
    await recordAiInvocation(BASE);
    // 1000*$2/1M + 500*$10/1M = 0.007
    expect(createMock.mock.calls[0][0].data.costUsd).toBe("0.007000");
  });

  it("records null cost for unknown models and for calls without usage", async () => {
    await recordAiInvocation({ ...BASE, model: "some-future-model" });
    expect(createMock.mock.calls[0][0].data.costUsd).toBeNull();

    await recordAiInvocation({ ...BASE, inputTokens: null, outputTokens: null, outcome: "ERROR" });
    expect(createMock.mock.calls[1][0].data.costUsd).toBeNull();
    expect(createMock.mock.calls[1][0].data.inputTokens).toBeNull();
  });

  it("swallows writer failures: logs and returns null, never throws", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createMock.mockRejectedValue(new Error("db down"));
    await expect(recordAiInvocation(BASE)).resolves.toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it("kill switch: AI_TELEMETRY=off records nothing", async () => {
    vi.stubEnv("AI_TELEMETRY", "off");
    expect(telemetryEnabled()).toBe(false);
    await expect(recordAiInvocation(BASE)).resolves.toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("defaults on: any other value (or unset) records", () => {
    expect(telemetryEnabled()).toBe(true);
    vi.stubEnv("AI_TELEMETRY", "on");
    expect(telemetryEnabled()).toBe(true);
  });
});

describe("updateAiAcceptance", () => {
  it("updates the originating record by id", async () => {
    await updateAiAcceptance("inv_1", "ACCEPTED", { downstreamAction: "finding-confirmed" });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "inv_1" },
      data: { acceptance: "ACCEPTED", downstreamAction: "finding-confirmed" },
    });
  });

  it("onlyIfNull is first-signal-wins: filters on acceptance null", async () => {
    await updateAiAcceptance("inv_1", "DISMISSED", { onlyIfNull: true });
    expect(updateManyMock.mock.calls[0][0].where).toEqual({ id: "inv_1", acceptance: null });
  });

  it("no-ops on a missing id (recording may have been off or failed)", async () => {
    await updateAiAcceptance(null, "ACCEPTED");
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("swallows failures and honors the kill switch", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    updateManyMock.mockRejectedValue(new Error("db down"));
    await expect(updateAiAcceptance("inv_1", "ACCEPTED")).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();

    updateManyMock.mockReset();
    vi.stubEnv("AI_TELEMETRY", "off");
    await updateAiAcceptance("inv_1", "ACCEPTED");
    expect(updateManyMock).not.toHaveBeenCalled();
  });
});

describe("recordAiInvocation budget alert hook", () => {
  it("after a priced write, checks the budget status and hands it to the alerter exactly once", async () => {
    await recordAiInvocation(BASE);
    await flush();
    expect(statusMock).toHaveBeenCalledTimes(1);
    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(alertMock).toHaveBeenCalledWith(STATUS);
  });

  it("does not run the hook for unpriced rows (failures, budget refusals, unknown models)", async () => {
    await recordAiInvocation({ ...BASE, inputTokens: null, outputTokens: null, outcome: "FALLBACK", errorClass: "budget_exceeded" });
    await recordAiInvocation({ ...BASE, model: "some-future-model" });
    await flush();
    expect(statusMock).not.toHaveBeenCalled();
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("does not run the hook when the write failed or recording is off", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createMock.mockRejectedValue(new Error("db down"));
    await recordAiInvocation(BASE);
    createMock.mockReset().mockResolvedValue({ id: "inv_1" });
    vi.stubEnv("AI_TELEMETRY", "off");
    await recordAiInvocation(BASE);
    await flush();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("a failing hook never surfaces to the caller", async () => {
    statusMock.mockRejectedValue(new Error("budget read failed"));
    await expect(recordAiInvocation(BASE)).resolves.toBe("inv_1");
    await flush();
    statusMock.mockReset().mockResolvedValue(STATUS);
    alertMock.mockRejectedValue(new Error("alert failed"));
    await expect(recordAiInvocation(BASE)).resolves.toBe("inv_1");
    await flush();
  });
});

describe("classifyAiError", () => {
  it("maps a budget refusal to FALLBACK / budget_exceeded (the deterministic path was served instead)", () => {
    const e = Object.assign(new Error("AI features are paused"), { name: "AiBudgetExceededError" });
    expect(classifyAiError(e)).toEqual({ outcome: "FALLBACK", errorClass: "budget_exceeded" });
  });

  it("classifies 429s as RATE_LIMITED", () => {
    expect(classifyAiError({ status: 429, name: "RateLimitError", error: { type: "rate_limit_error" } })).toEqual({
      outcome: "RATE_LIMITED",
      errorClass: "rate_limit_error",
    });
  });

  it("classifies timeouts and aborts as TIMEOUT", () => {
    expect(classifyAiError({ name: "APIConnectionTimeoutError" }).outcome).toBe("TIMEOUT");
    expect(classifyAiError({ name: "AbortError" }).outcome).toBe("TIMEOUT");
  });

  it("keeps the machine class from the API error body (unwrapped shape)", () => {
    expect(classifyAiError({ status: 529, name: "InternalServerError", error: { type: "overloaded_error" } })).toEqual({
      outcome: "ERROR",
      errorClass: "overloaded_error",
    });
  });

  it("unwraps the nested body shape ({type: 'error', error: {type}})", () => {
    expect(
      classifyAiError({ status: 400, error: { type: "error", error: { type: "invalid_request_error" } } }).errorClass,
    ).toBe("invalid_request_error");
  });

  it("falls back to the constructor name, never the message", () => {
    const res = classifyAiError(new Error("secret prompt fragment"));
    expect(res).toEqual({ outcome: "ERROR", errorClass: "Error" });
  });

  it("survives non-error throwables", () => {
    expect(classifyAiError(undefined)).toEqual({ outcome: "ERROR", errorClass: null });
    expect(classifyAiError("boom")).toEqual({ outcome: "ERROR", errorClass: null });
  });
});
