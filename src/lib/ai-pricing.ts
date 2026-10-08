// Versioned Anthropic price table for AI invocation telemetry cost computation.
// USD per MILLION tokens, first-party API rates. Keyed by model-id prefix so
// dated snapshots (e.g. a hypothetical claude-sonnet-5-2026xxxx) still price.
// Longest matching prefix wins, so "claude-opus-5" beats "claude-opus-4".
//
// Rates verified 2026-08-30 (5.5 rows 2026-10-01) against Anthropic's published pricing. When rates
// change, append the new effective date and update the numbers; costUsd is
// computed at write time, so historical rows keep the price they were billed at.

export const PRICE_TABLE_VERSION = "2026-10-01";

export type ModelPrice = {
  prefix: string;
  inputPerMTok: number; // USD per 1M input tokens
  outputPerMTok: number; // USD per 1M output tokens
  effective: string; // date these rates were verified
};

export const PRICES: readonly ModelPrice[] = [
  // Longest prefix wins, so these 5.5 rows take precedence over the 5 rows below.
  { prefix: "claude-opus-5-5", inputPerMTok: 4.0, outputPerMTok: 20.0, effective: "2026-10-01" },
  { prefix: "claude-sonnet-5-5", inputPerMTok: 2.0, outputPerMTok: 10.0, effective: "2026-10-01" },
  { prefix: "claude-opus-5", inputPerMTok: 5.0, outputPerMTok: 25.0, effective: "2026-08-30" },
  { prefix: "claude-sonnet-5", inputPerMTok: 2.0, outputPerMTok: 10.0, effective: "2026-08-30" },
  { prefix: "claude-sonnet-4-6", inputPerMTok: 3.0, outputPerMTok: 15.0, effective: "2026-08-30" },
  { prefix: "claude-haiku-4-5", inputPerMTok: 1.0, outputPerMTok: 5.0, effective: "2026-08-30" },
  // Opus 4.6/4.7/4.8 all bill at the same rate; one family prefix covers them.
  { prefix: "claude-opus-4", inputPerMTok: 5.0, outputPerMTok: 25.0, effective: "2026-08-30" },
];

/**
 * The Anthropic model name inside a provider's id. Bedrock spells the same
 * model as "anthropic.<name>", with a geo prefix for a cross-region inference
 * profile ("us.", "eu.", "apac.", "us-gov.", "global."), or as a full inference-profile ARN; the
 * telemetry label "bedrock:<id>" is accepted too. A first-party id comes back
 * unchanged. Used so pricing and per-model settings key on the model, not the
 * provider's spelling.
 */
export function canonicalModelName(model: string): string {
  let id = model.startsWith("bedrock:") ? model.slice("bedrock:".length) : model;
  if (id.startsWith("arn:")) id = id.slice(id.lastIndexOf("/") + 1);
  // Geo prefixes: us., eu., apac., global., and hyphenated ones like us-gov.
  return id.replace(/^(?:[a-z]{2,8}(?:-[a-z]{2,8})?\.)?anthropic\./, "");
}

/** Longest-prefix match into the price table; null for unknown models. */
export function priceFor(rawModel: string): ModelPrice | null {
  // Bedrock bills Awayday's AWS account and its rates may differ; Bedrock ids price at the direct-API rate as a conservative stand-in.
  const model = canonicalModelName(rawModel);
  let best: ModelPrice | null = null;
  for (const p of PRICES) {
    if (model.startsWith(p.prefix) && (!best || p.prefix.length > best.prefix.length)) best = p;
  }
  return best;
}

/**
 * Cost of one invocation in USD, or null when the model is unknown or usage
 * is missing (failed calls). Never throws: telemetry must not break on a new
 * model id, it just records a null cost until the table learns the rate.
 */
export function computeCostUsd(
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): number | null {
  if (inputTokens == null || outputTokens == null) return null;
  const price = priceFor(model);
  if (!price) return null;
  return (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1_000_000;
}
