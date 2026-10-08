import Anthropic from "@anthropic-ai/sdk";
import type { AiModule } from "@/generated/prisma/enums";
import { recordAiInvocation, classifyAiError } from "@/lib/ai-telemetry";
import { assertAiBudget } from "@/lib/ai-budget";
import { canonicalModelName } from "@/lib/ai-pricing";

// Lives in ai-pricing.ts (no imports there) so pricing can use it without a
// cycle through ai-telemetry; re-exported here with the per-model settings.
export { canonicalModelName };

// Default to Sonnet for a good quality/cost balance on short strategy copy.
// Override via ANTHROPIC_MODEL to bump the model without a code deploy.
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

/**
 * How to keep thinking out of these short, well-specified generation calls,
 * per model. The models disagree on the setting, and the wrong one is a 400:
 *   Sonnet 5.5          rejects "disabled"; "between_tools" is its lowest
 *                       setting (no up-front thinking; accepted at effort
 *                       low/medium/high).
 *   Opus 5.5, Fable     thinking is always on; "disabled" and budgets are a
 *                       400 at every effort, so omit it and run at low effort.
 *   Sonnet 5, Opus 5,   accept "disabled" (Opus 5 only at effort high or
 *   4.x                 below, which is its default).
 * Exported so the ANTHROPIC_MODEL override stays safe and the table is tested.
 */
export function thinkingParams(rawModel: string): {
  thinking?: Anthropic.ThinkingConfigParam;
  output_config?: Anthropic.OutputConfig;
} {
  const model = canonicalModelName(rawModel);
  // The installed SDK (0.102) predates between_tools in its types; the API
  // accepts it per the Sonnet 5.5 migration guide, so cast rather than bump
  // the SDK as a side effect of a model change.
  if (model.startsWith("claude-sonnet-5-5")) {
    return { thinking: { type: "between_tools" } as unknown as Anthropic.ThinkingConfigParam };
  }
  if (model.startsWith("claude-opus-5-5") || model.startsWith("claude-fable")) {
    return { output_config: { effort: "low" } };
  }
  return { thinking: { type: "disabled" } };
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI is not configured. Add ANTHROPIC_API_KEY to the environment.");
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// House style for everything the model writes — this copy lands in a client-facing
// board tool, so it must read like a sharp chief of staff and never use em dashes.
export const HOUSE_STYLE =
  "You are the chief of staff for Awayday, a PE-backed vacation-rental operator (~16,000 units) " +
  "driving toward a $150M EBITDA exit by end of 2027. Write concise, concrete, board-ready prose. " +
  "No filler, no hype, no markdown headers unless asked. Never use em dashes; use periods, commas, " +
  "colons, or parentheses instead.";

// Telemetry classification for a call (docs/ai-telemetry-schema.md). Optional
// and backward-compatible: an untagged call records as PLATFORM / "unknown"
// rather than breaking. Classification only — never put content in here.
export type AiContext = {
  module?: AiModule;
  feature?: string;
  userId?: string | null;
  sessionKey?: string | null;
};

export async function complete({
  system,
  user,
  maxTokens = 700,
  context,
  model: modelOverride,
  timeoutMs,
  maxRetries,
}: {
  system: string;
  user: string;
  maxTokens?: number;
  context?: AiContext;
  /** Per-call model override (e.g. a cheap model for bulk extraction). Defaults to AI_MODEL. */
  model?: string;
  /** Per-request timeout. Omitted: the SDK default applies, as before. */
  timeoutMs?: number;
  /** Per-request retry count. Omitted: the SDK default applies, as before. */
  maxRetries?: number;
}): Promise<string> {
  const model = modelOverride ?? AI_MODEL;
  const label = model;
  const tag = {
    module: context?.module ?? ("PLATFORM" as AiModule),
    feature: context?.feature ?? "unknown",
    userId: context?.userId ?? null,
    sessionKey: context?.sessionKey ?? null,
  };
  // Monthly spend guardrail (src/lib/ai-budget.ts). Over budget, the call is
  // refused BEFORE the SDK is touched and the caller sees the same thrown
  // error path it already handles for an outage, so every feature degrades to
  // its non-AI behaviour. The refusal is still recorded (zero tokens, FALLBACK
  // / budget_exceeded) so demand during the pause stays visible in telemetry.
  // assertAiBudget only ever throws AiBudgetExceededError; a DB or config
  // failure inside it logs and allows the call.
  try {
    await assertAiBudget();
  } catch (e) {
    void recordAiInvocation({ ...tag, model: label, latencyMs: 0, outcome: "FALLBACK", errorClass: "budget_exceeded" });
    throw e;
  }
  const requestOptions: Anthropic.RequestOptions | undefined =
    timeoutMs !== undefined || maxRetries !== undefined
      ? { ...(timeoutMs !== undefined ? { timeout: timeoutMs } : {}), ...(maxRetries !== undefined ? { maxRetries } : {}) }
      : undefined;
  const started = performance.now();
  let msg: Anthropic.Message;
  try {
    msg = await getClient().messages.create({
      model,
      max_tokens: maxTokens,
      // These are short, well-specified generation tasks. Keep thinking out so
      // the full max_tokens budget goes to the visible output (the current
      // models think by default when the field is omitted, which would eat into
      // these budgets and risk truncating output). thinkingParams() picks the
      // setting each model accepts.
      ...thinkingParams(model),
      system,
      messages: [{ role: "user", content: user }],
    }, requestOptions);
  } catch (e) {
    // One record per invocation including failures. Fire-and-forget (never
    // blocks or fails the caller), then rethrow the original error untouched.
    const { outcome, errorClass } = classifyAiError(e);
    void recordAiInvocation({
      ...tag,
      model: label,
      latencyMs: performance.now() - started,
      outcome,
      errorClass,
    });
    throw e;
  }
  void recordAiInvocation({
    ...tag,
    // msg.model is the id the API actually served, which is what cost keys on.
    model: msg.model ?? label,
    latencyMs: performance.now() - started,
    inputTokens: msg.usage?.input_tokens ?? null,
    outputTokens: msg.usage?.output_tokens ?? null,
    outcome: "OK",
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
