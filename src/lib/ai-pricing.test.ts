import { describe, it, expect } from "vitest";
import { PRICES, priceFor, computeCostUsd } from "./ai-pricing";

// The price table feeds costUsd on every telemetry record at write time, so a
// mis-keyed prefix silently misprices whole modules. Rates verified 2026-08-30:
// sonnet-5 $2/$10 per MTok, opus-5 $5/$25 per MTok.

describe("priceFor", () => {
  it("matches exact model ids", () => {
    expect(priceFor("claude-sonnet-5")).toMatchObject({ inputPerMTok: 2, outputPerMTok: 10 });
    expect(priceFor("claude-opus-5")).toMatchObject({ inputPerMTok: 5, outputPerMTok: 25 });
  });

  it("matches dated snapshots by prefix", () => {
    expect(priceFor("claude-sonnet-5-20260701")?.prefix).toBe("claude-sonnet-5");
  });

  it("prefers the longest prefix (opus-5 must not fall into the opus-4 family row)", () => {
    expect(priceFor("claude-opus-5")?.prefix).toBe("claude-opus-5");
    expect(priceFor("claude-opus-4-8")?.prefix).toBe("claude-opus-4");
    // sonnet-4-6 has its own (pricier) row; the family row must not shadow it.
    expect(priceFor("claude-sonnet-4-6")).toMatchObject({ inputPerMTok: 3, outputPerMTok: 15 });
  });

  it("prices the 5.5 models on their own rows, not the 5 rows they share a prefix with", () => {
    expect(priceFor("claude-opus-5-5")).toMatchObject({ prefix: "claude-opus-5-5", inputPerMTok: 4, outputPerMTok: 20 });
    expect(priceFor("claude-sonnet-5-5")).toMatchObject({ prefix: "claude-sonnet-5-5", inputPerMTok: 2, outputPerMTok: 10 });
    // a Sonnet 5 dated snapshot must still fall to the Sonnet 5 row
    expect(priceFor("claude-sonnet-5-20260701")?.prefix).toBe("claude-sonnet-5");
  });

  it("returns null for unknown models instead of guessing", () => {
    expect(priceFor("claude-fable-5")).toBeNull();
    expect(priceFor("gpt-4o")).toBeNull();
    expect(priceFor("")).toBeNull();
  });
});

describe("computeCostUsd", () => {
  it("computes USD from per-million rates", () => {
    // 1000 in + 500 out on sonnet-5: 1000*2/1M + 500*10/1M = 0.002 + 0.005
    expect(computeCostUsd("claude-sonnet-5", 1000, 500)).toBeCloseTo(0.007, 9);
    // opus contract review scale: 30k in + 4k out = 0.15 + 0.10
    expect(computeCostUsd("claude-opus-5", 30_000, 4_000)).toBeCloseTo(0.25, 9);
  });

  it("is null for unknown models (safe fallback, never throws)", () => {
    expect(computeCostUsd("some-new-model", 1000, 1000)).toBeNull();
  });

  it("is null when usage is missing (failed calls have no usage block)", () => {
    expect(computeCostUsd("claude-sonnet-5", null, null)).toBeNull();
    expect(computeCostUsd("claude-sonnet-5", 1000, undefined)).toBeNull();
  });

  it("zero tokens cost zero, not null", () => {
    expect(computeCostUsd("claude-sonnet-5", 0, 0)).toBe(0);
  });
});

describe("price table hygiene", () => {
  it("every row has positive rates and an effective date", () => {
    for (const p of PRICES) {
      expect(p.inputPerMTok).toBeGreaterThan(0);
      expect(p.outputPerMTok).toBeGreaterThan(0);
      expect(p.effective).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// Sensitive diligence reads go through Bedrock (5 October) and are recorded as
// "bedrock:<id>". They price at the direct-API rate of the same model so the
// spend counts toward the monthly budget (a conservative stand-in: Bedrock
// bills Awayday's AWS account and its rates may differ).
describe("Bedrock ids", () => {
  const sonnet55 = { prefix: "claude-sonnet-5-5", inputPerMTok: 2, outputPerMTok: 10 };

  it("resolve to the same model's row", () => {
    for (const id of [
      "bedrock:us.anthropic.claude-sonnet-5-5-v1:0",
      "us.anthropic.claude-sonnet-5-5-v1:0",
      "anthropic.claude-sonnet-5-5-v1:0",
      "global.anthropic.claude-sonnet-5-5-v1:0",
      "us-gov.anthropic.claude-sonnet-5-5-v1:0",
      "apac.anthropic.claude-sonnet-5-5-v1:0",
      "eu.anthropic.claude-sonnet-5-5-v1:0",
      "arn:aws:bedrock:us-east-1:111122223333:inference-profile/us.anthropic.claude-sonnet-5-5-v1:0",
      "bedrock:arn:aws:bedrock:us-east-1:111122223333:inference-profile/us.anthropic.claude-sonnet-5-5-v1:0",
    ]) {
      expect(priceFor(id), id).toMatchObject(sonnet55);
    }
    expect(priceFor("bedrock:us.anthropic.claude-opus-5-5-v1:0")).toMatchObject({ prefix: "claude-opus-5-5", inputPerMTok: 4, outputPerMTok: 20 });
  });

  it("a Bedrock telemetry row (model label bedrock:<id>) gets a non-zero cost", () => {
    // 2100 in + 180 out on Sonnet 5.5: 2100*2/1M + 180*10/1M = 0.0042 + 0.0018
    const cost = computeCostUsd("bedrock:us.anthropic.claude-sonnet-5-5-v1:0", 2100, 180);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeCloseTo(0.006, 9);
  });

  it("unknown ids still price as null, Bedrock-shaped or not", () => {
    expect(priceFor("bedrock:us.anthropic.claude-fable-5-v1:0")).toBeNull();
    expect(priceFor("bedrock:us.meta.llama4-v1:0")).toBeNull();
    expect(priceFor("arn:aws:bedrock:us-east-1:111122223333:application-inference-profile/a1b2c3d4")).toBeNull();
    expect(computeCostUsd("bedrock:amazon.nova-pro-v1:0", 1000, 1000)).toBeNull();
    expect(computeCostUsd("some-new-model", 1000, 1000)).toBeNull();
  });
});
