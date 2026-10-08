import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The shared complete() helper is the platform-wide telemetry choke point:
// every call must produce exactly one record (success OR failure), carrying
// usage, latency, and the caller's classification tag — and telemetry must
// never change what the caller sees (same return value, same thrown error).

const { messagesCreate, recordMock, classifyMock, assertBudgetMock } = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
  recordMock: vi.fn<(data: Record<string, unknown>) => Promise<string | null>>(),
  classifyMock: vi.fn<(e: unknown) => { outcome: string; errorClass: string | null }>(),
  assertBudgetMock: vi.fn<() => Promise<void>>(),
}));

const lastRecord = () => recordMock.mock.calls.at(-1)![0];

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: messagesCreate };
  },
}));

vi.mock("@/lib/ai-telemetry", () => ({
  recordAiInvocation: recordMock,
  classifyAiError: classifyMock,
}));

// The budget gate is mocked at the module boundary; its real behaviour is
// covered in ai-budget.test.ts. The error class is defined inside the mock so
// `instanceof` in ai.ts and here refer to the same constructor.
vi.mock("@/lib/ai-budget", () => {
  class AiBudgetExceededError extends Error {
    name = "AiBudgetExceededError";
  }
  return { assertAiBudget: assertBudgetMock, AiBudgetExceededError };
});

import { complete, AI_MODEL, thinkingParams, canonicalModelName } from "./ai";
import { AiBudgetExceededError } from "@/lib/ai-budget";

const OK_MSG = {
  model: "claude-sonnet-5",
  content: [{ type: "text", text: "  answer  " }],
  usage: { input_tokens: 1200, output_tokens: 340 },
};

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  messagesCreate.mockReset().mockResolvedValue(OK_MSG);
  recordMock.mockReset().mockResolvedValue("inv_1");
  classifyMock.mockReset().mockReturnValue({ outcome: "RATE_LIMITED", errorClass: "rate_limit_error" });
  assertBudgetMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("complete() telemetry", () => {
  it("records one OK invocation with usage, served model, and measured latency", async () => {
    const text = await complete({ system: "s", user: "u" });
    expect(text).toBe("answer"); // return value untouched by instrumentation
    expect(recordMock).toHaveBeenCalledTimes(1);
    const rec = lastRecord();
    expect(rec).toMatchObject({
      model: "claude-sonnet-5",
      inputTokens: 1200,
      outputTokens: 340,
      outcome: "OK",
    });
    expect(rec.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("tags from the context bag", async () => {
    await complete({
      system: "s",
      user: "u",
      context: { module: "INITIATIVES", feature: "charter-assist", userId: "user_9" },
    });
    expect(lastRecord()).toMatchObject({
      module: "INITIATIVES",
      feature: "charter-assist",
      userId: "user_9",
      sessionKey: null,
    });
  });

  it("defaults untagged calls to PLATFORM/unknown so old call sites never break", async () => {
    await complete({ system: "s", user: "u" });
    expect(lastRecord()).toMatchObject({
      module: "PLATFORM",
      feature: "unknown",
      userId: null,
    });
  });

  it("records classified failures and rethrows the original error", async () => {
    const boom = Object.assign(new Error("429"), { status: 429 });
    messagesCreate.mockRejectedValue(boom);
    await expect(complete({ system: "s", user: "u", context: { module: "INITIATIVES", feature: "ask-board" } })).rejects.toBe(boom);
    expect(classifyMock).toHaveBeenCalledWith(boom);
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(lastRecord()).toMatchObject({
      module: "INITIATIVES",
      feature: "ask-board",
      outcome: "RATE_LIMITED",
      errorClass: "rate_limit_error",
    });
    // No usage block exists on a failed call.
    expect(lastRecord().inputTokens).toBeUndefined();
  });

  it("never records prompt or completion content", async () => {
    await complete({ system: "the system prompt", user: "the user prompt" });
    const rec = JSON.stringify(lastRecord());
    expect(rec).not.toContain("system prompt");
    expect(rec).not.toContain("user prompt");
    expect(rec).not.toContain("answer");
  });
});

describe("complete() monthly budget guardrail", () => {
  it("refuses before touching the SDK when the budget is exceeded, records a zero-token FALLBACK row, and rethrows", async () => {
    const paused = new AiBudgetExceededError("paused");
    assertBudgetMock.mockRejectedValue(paused);
    await expect(
      complete({ system: "s", user: "u", context: { module: "INITIATIVES", feature: "charter-assist", userId: "user_9" } }),
    ).rejects.toBe(paused);
    expect(messagesCreate).not.toHaveBeenCalled();
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(lastRecord()).toMatchObject({
      module: "INITIATIVES",
      feature: "charter-assist",
      userId: "user_9",
      model: AI_MODEL,
      latencyMs: 0,
      outcome: "FALLBACK",
      errorClass: "budget_exceeded",
    });
    // Nothing was spent, so no usage is recorded (demand stays visible, cost stays zero).
    expect(lastRecord().inputTokens).toBeUndefined();
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("checks the budget before every call and proceeds normally when allowed", async () => {
    const order: string[] = [];
    assertBudgetMock.mockImplementation(async () => {
      order.push("budget");
    });
    messagesCreate.mockImplementation(async () => {
      order.push("sdk");
      return OK_MSG;
    });
    await expect(complete({ system: "s", user: "u" })).resolves.toBe("answer");
    expect(order).toEqual(["budget", "sdk"]);
    expect(lastRecord().outcome).toBe("OK");
  });
});

// Each model accepts a different "no up-front thinking" setting, and the wrong
// one is a 400 that takes every AI feature down (Sonnet 5.5 and Opus 5.5 both
// reject "disabled"). Pin the table.
describe("thinkingParams", () => {
  it("defaults the platform to Sonnet 5.5", () => {
    expect(AI_MODEL).toBe("claude-sonnet-5-5");
  });

  it("Sonnet 5.5 uses between_tools, never disabled", () => {
    expect(thinkingParams("claude-sonnet-5-5")).toEqual({ thinking: { type: "between_tools" } });
  });

  it("Opus 5.5 and Fable omit thinking and run at low effort", () => {
    expect(thinkingParams("claude-opus-5-5")).toEqual({ output_config: { effort: "low" } });
    expect(thinkingParams("claude-fable-5-1")).toEqual({ output_config: { effort: "low" } });
  });

  it("older models keep disabled", () => {
    for (const m of ["claude-sonnet-5", "claude-opus-5", "claude-sonnet-4-6", "claude-opus-4-8"]) {
      expect(thinkingParams(m)).toEqual({ thinking: { type: "disabled" } });
    }
  });

  // Bedrock names the same models differently (a geo prefix, "anthropic.",
  // a version suffix, or a full inference-profile ARN). The table must key
  // on the model, not the provider's spelling, or a Bedrock Sonnet 5.5 read
  // would send "disabled" and 400.
  it("keys on the model inside a Bedrock id or inference-profile ARN", () => {
    for (const id of [
      "anthropic.claude-sonnet-5-5",
      "anthropic.claude-sonnet-5-5-v1:0",
      "us.anthropic.claude-sonnet-5-5-v1:0",
      "global.anthropic.claude-sonnet-5-5-v1:0",
      "arn:aws:bedrock:us-east-1:111122223333:inference-profile/us.anthropic.claude-sonnet-5-5-v1:0",
      "bedrock:us.anthropic.claude-sonnet-5-5-v1:0",
    ]) {
      expect(thinkingParams(id), id).toEqual({ thinking: { type: "between_tools" } });
    }
    expect(thinkingParams("us.anthropic.claude-opus-5-5-v1:0")).toEqual({ output_config: { effort: "low" } });
    expect(thinkingParams("us.anthropic.claude-sonnet-4-6-v1:0")).toEqual({ thinking: { type: "disabled" } });
  });

  it("canonicalModelName strips only the provider's spelling", () => {
    expect(canonicalModelName("claude-sonnet-5-5")).toBe("claude-sonnet-5-5");
    expect(canonicalModelName("eu.anthropic.claude-opus-5-5-v1:0")).toBe("claude-opus-5-5-v1:0");
    expect(canonicalModelName("arn:aws:bedrock:us-west-2:1:inference-profile/us.anthropic.claude-sonnet-5-5-v1:0")).toBe("claude-sonnet-5-5-v1:0");
  });

  it("complete() sends the default model's setting", async () => {
    await complete({ system: "s", user: "u" });
    const body = messagesCreate.mock.calls.at(-1)![0];
    expect(body.model).toBe("claude-sonnet-5-5");
    expect(body.thinking).toEqual({ type: "between_tools" });
  });
});

describe("complete() model override", () => {
  it("defaults to AI_MODEL and uses the override for request, thinking and telemetry", async () => {
    await complete({ system: "s", user: "u" });
    expect(messagesCreate.mock.calls[0][0].model).toBe(AI_MODEL);
    messagesCreate.mockClear();
    messagesCreate.mockResolvedValue({ ...OK_MSG, model: undefined });
    await complete({ system: "s", user: "u", model: "claude-haiku-4-5" });
    const req = messagesCreate.mock.calls[0][0];
    expect(req.model).toBe("claude-haiku-4-5");
    expect(req.thinking).toEqual({ type: "disabled" });
    expect(lastRecord().model).toBe("claude-haiku-4-5");
  });

  it("passes timeout and retries as request options only when given", async () => {
    await complete({ system: "s", user: "u" });
    expect(messagesCreate.mock.calls[0][1]).toBeUndefined();
    messagesCreate.mockClear();
    await complete({ system: "s", user: "u", timeoutMs: 5000, maxRetries: 0 });
    expect(messagesCreate.mock.calls[0][1]).toEqual({ timeout: 5000, maxRetries: 0 });
  });
});
