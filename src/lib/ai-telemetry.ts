import { prisma } from "@/lib/prisma";
import type { AiModule, AiOutcome, AiAcceptance } from "@/generated/prisma/enums";
import { computeCostUsd } from "@/lib/ai-pricing";
import { getAiBudgetStatus, maybeAlertAiBudget } from "@/lib/ai-budget";

// AI invocation telemetry writer (docs/ai-telemetry-schema.md). Best-effort by
// design, mirroring src/lib/audit.ts: a telemetry write must never fail, slow,
// or block the user-facing AI call. Classification and measurement only; no
// prompts, no responses, no PII ever pass through here.
//
// Dark-launched: recording is on by default and switched off with
// AI_TELEMETRY=off. Nothing in the product UI reads the table.

export type AiInvocationData = {
  module: AiModule;
  feature: string;
  model: string;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  outcome: AiOutcome;
  errorClass?: string | null;
  userId?: string | null;
  sessionKey?: string | null;
};

export function telemetryEnabled(): boolean {
  return process.env.AI_TELEMETRY !== "off";
}

/**
 * Classify a thrown model-call error into an outcome + machine error class.
 * Duck-typed on the Anthropic SDK error shape (status code + API error type)
 * so it needs no SDK import and stays pure/testable. Never returns message
 * bodies: errorClass is a type slug like "overloaded_error" or a constructor
 * name, nothing more.
 */
export function classifyAiError(e: unknown): { outcome: AiOutcome; errorClass: string | null } {
  const err = e as
    | {
        status?: number;
        name?: string;
        error?: { type?: string; error?: { type?: string } };
      }
    | null
    | undefined;
  const name = typeof err?.name === "string" ? err.name : null;
  // Anthropic APIError.error is the body's error field; tolerate both the
  // unwrapped ({type: "overloaded_error"}) and wrapped ({type: "error",
  // error: {type: ...}}) shapes.
  const apiType =
    (err?.error?.type && err.error.type !== "error" ? err.error.type : null) ?? err?.error?.error?.type ?? null;
  const errorClass = apiType ?? name;

  // Monthly budget refusal (src/lib/ai-budget.ts): no model call was made and
  // the caller served its deterministic path, which is the FALLBACK outcome.
  if (name === "AiBudgetExceededError") return { outcome: "FALLBACK", errorClass: "budget_exceeded" };
  if (name && /Timeout|AbortError/i.test(name)) return { outcome: "TIMEOUT", errorClass };
  if (err?.status === 429 || apiType === "rate_limit_error") return { outcome: "RATE_LIMITED", errorClass };
  return { outcome: "ERROR", errorClass };
}

/**
 * Write one telemetry record. Returns the record id (so acceptance can be
 * linked later) or null when recording is off or the write failed. Swallows
 * every error: callers may safely `void` or `await` this.
 */
export async function recordAiInvocation(data: AiInvocationData): Promise<string | null> {
  if (!telemetryEnabled()) return null;
  try {
    const cost = computeCostUsd(data.model, data.inputTokens, data.outputTokens);
    const row = await prisma.aiInvocation.create({
      data: {
        module: data.module,
        feature: data.feature,
        model: data.model,
        latencyMs: Math.max(0, Math.round(data.latencyMs)),
        inputTokens: data.inputTokens ?? null,
        outputTokens: data.outputTokens ?? null,
        costUsd: cost == null ? null : cost.toFixed(6),
        outcome: data.outcome,
        errorClass: data.errorClass ?? null,
        userId: data.userId ?? null,
        sessionKey: data.sessionKey ?? null,
      },
      select: { id: true },
    });
    // Spend just moved: let the budget alerter decide whether an 80% / 100%
    // email is due. Detached and swallowed, like the write itself. Unpriced
    // rows (failures, refusals, unknown models) cannot move spend, so skip.
    if (cost != null) void getAiBudgetStatus().then(maybeAlertAiBudget).catch(() => {});
    return row.id;
  } catch (e) {
    console.error("ai telemetry write failed", { module: data.module, feature: data.feature }, e);
    return null;
  }
}

/**
 * Follow-up update on the originating record when a human accepts, edits, or
 * dismisses AI output (spec rule 4: an update, never a second record).
 * `onlyIfNull` makes the update first-signal-wins, e.g. so dismissing a second
 * finding does not overwrite the ACCEPTED set by confirming the first.
 * Best-effort like the writer; never throws.
 */
export async function updateAiAcceptance(
  id: string | null | undefined,
  acceptance: AiAcceptance,
  opts: { downstreamAction?: string; onlyIfNull?: boolean } = {},
): Promise<void> {
  if (!id || !telemetryEnabled()) return;
  try {
    await prisma.aiInvocation.updateMany({
      where: { id, ...(opts.onlyIfNull ? { acceptance: null } : {}) },
      data: { acceptance, ...(opts.downstreamAction ? { downstreamAction: opts.downstreamAction } : {}) },
    });
  } catch (e) {
    console.error("ai telemetry acceptance update failed", { id, acceptance }, e);
  }
}
