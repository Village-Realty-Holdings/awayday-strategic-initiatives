import { beforeEach, describe, expect, it, vi } from "vitest";

// The MCP handler: protocol basics, tools shown by role and token scope, input
// validation as tool errors, and writes routed through lib/review-edits with
// pillars and SIs resolved by code.

const m = vi.hoisted(() => ({
  updateReviewDetails: vi.fn(async () => ({ ok: true })),
  setSoWhats: vi.fn(async () => ({ ok: true })),
  setPillarMeasure: vi.fn(async () => ({ ok: true })),
  addSiUpdate: vi.fn(async () => ({ ok: true })),
  areaFindMany: vi.fn(async () => [{ id: "a1", code: "FY27-GROW" }]),
  initiativeFindFirst: vi.fn(),
  getReviewPlan: vi.fn(),
  getReviewPeriod: vi.fn(),
  resolvePeriod: vi.fn(async () => ({ id: "2026-10", periods: ["2026-10", "2026-09"], home: "2026-10", published: ["2026-09"] })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/active-plan", () => ({ getActivePlan: vi.fn(async () => ({ id: "fy27" })) }));
vi.mock("@/lib/review-data", () => ({ getReviewPlan: m.getReviewPlan, getReviewPeriod: m.getReviewPeriod, resolvePeriod: m.resolvePeriod }));
vi.mock("@/lib/review-edits", () => ({
  updateReviewDetails: m.updateReviewDetails,
  setSoWhats: m.setSoWhats,
  setPillarMeasure: m.setPillarMeasure,
  addSiUpdate: m.addSiUpdate,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { strategicArea: { findMany: m.areaFindMany }, initiative: { findFirst: m.initiativeFindFirst } },
}));

import { handleMcpMessage } from "@/lib/mcp";
import type { TokenActor } from "@/lib/api-tokens";

const editor: TokenActor = { id: "u1", name: "Erin Editor", role: "editor", scope: "write", tokenId: "t1" };
const viewer: TokenActor = { ...editor, role: "user" };
const readOnly: TokenActor = { ...editor, scope: "read" };

const call = (actor: TokenActor, name: string, args: Record<string, unknown> = {}) =>
  handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, actor) as Promise<{
    result: { isError: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> };
  }>;

const toolNames = async (actor: TokenActor) => {
  const reply = (await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, actor)) as { result: { tools: { name: string; inputSchema: { type: string } }[] } };
  return reply.result.tools.map((t) => t.name);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("protocol", () => {
  it("negotiates a supported version and announces tools", async () => {
    const reply = (await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, editor)) as { result: Record<string, unknown> };
    expect(reply.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "awayday-strategic-initiatives" } });
    const newer = (await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2099-01-01" } }, editor)) as { result: { protocolVersion: string } };
    expect(newer.result.protocolVersion).toBe("2025-11-25");
  });

  it("answers ping, ignores notifications and rejects unknown methods", async () => {
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 3, method: "ping" }, editor)).toEqual({ jsonrpc: "2.0", id: 3, result: {} });
    expect(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, editor)).toBeNull();
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 4, method: "resources/list" }, editor)).toMatchObject({ error: { code: -32601 } });
    expect(await handleMcpMessage({ hello: "world" }, editor)).toMatchObject({ error: { code: -32600 } });
  });
});

describe("tools/list", () => {
  it("shows editors every tool, with object input schemas", async () => {
    expect(await toolNames(editor)).toEqual(["list_review_periods", "get_review", "update_review_details", "set_so_whats", "set_pillar_measure", "add_si_update"]);
    const reply = (await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, editor)) as { result: { tools: { inputSchema: Record<string, unknown> }[] } };
    for (const t of reply.result.tools) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.inputSchema.$schema).toBeUndefined();
    }
  });

  it("shows viewers the read tools and SI updates, and read-only tokens the read tools", async () => {
    expect(await toolNames(viewer)).toEqual(["list_review_periods", "get_review", "add_si_update"]);
    expect(await toolNames(readOnly)).toEqual(["list_review_periods", "get_review"]);
  });
});

describe("tools/call", () => {
  it("refuses a write tool on a read-only token, and an editor tool for a viewer, as tool errors", async () => {
    const ro = await call(readOnly, "set_pillar_measure", { period: "2026-10", pillar: "GROW", status: "AHEAD" });
    expect(ro.result).toMatchObject({ isError: true, content: [{ text: "This API token is read-only." }] });
    const v = await call(viewer, "update_review_details", { period: "2026-10", preparedBy: "x" });
    expect(v.result.isError).toBe(true);
    expect(m.setPillarMeasure).not.toHaveBeenCalled();
    expect(m.updateReviewDetails).not.toHaveBeenCalled();
  });

  it("returns invalid arguments as a tool error the model can correct", async () => {
    const reply = await call(editor, "update_review_details", { period: "Oct 2026" });
    expect(reply.result.isError).toBe(true);
    expect(reply.result.content[0].text).toContain("period");
    expect(m.updateReviewDetails).not.toHaveBeenCalled();
  });

  it("rejects an unknown tool as a protocol error", async () => {
    expect(await call(editor, "drop_tables")).toMatchObject({ error: { code: -32602 } });
  });

  it("lists periods with their status", async () => {
    const reply = await call(editor, "list_review_periods");
    expect(reply.result.structuredContent).toEqual({
      defaultPeriod: "2026-10",
      periods: [
        { id: "2026-10", status: "DRAFT" },
        { id: "2026-09", status: "PUBLISHED" },
      ],
    });
  });

  it("passes review details through, leaving omitted fields out", async () => {
    await call(editor, "update_review_details", { period: "2026-10", meetingDate: "2026-11-12", dataAsOf: null });
    expect(m.updateReviewDetails).toHaveBeenCalledWith(editor, { periodId: "2026-10", meetingDate: "2026-11-12", dataAsOf: null });
  });

  it("resolves a pillar by short code and passes value and status", async () => {
    const reply = await call(editor, "set_pillar_measure", { period: "2026-10", pillar: "grow", value: "$12.4M", status: "calculated" });
    expect(reply.result.isError).toBe(false);
    expect(m.setPillarMeasure).toHaveBeenCalledWith(editor, { periodId: "2026-10", areaId: "a1", value: "$12.4M", status: "calculated" });
  });

  it("needs a value or a status, and a known pillar", async () => {
    expect((await call(editor, "set_pillar_measure", { period: "2026-10", pillar: "GROW" })).result.isError).toBe(true);
    expect((await call(editor, "set_pillar_measure", { period: "2026-10", pillar: "NOPE", status: "AHEAD" })).result.isError).toBe(true);
    expect(m.setPillarMeasure).not.toHaveBeenCalled();
  });

  it("surfaces the edit's own error, e.g. a published month", async () => {
    m.setPillarMeasure.mockResolvedValueOnce({ ok: false, error: "This month is published." } as never);
    const reply = await call(editor, "set_pillar_measure", { period: "2026-09", pillar: "GROW", status: "AHEAD" });
    expect(reply.result).toMatchObject({ isError: true, content: [{ text: "This month is published." }] });
  });

  it("replaces so-whats for a pillar scope under its full code", async () => {
    m.getReviewPlan.mockResolvedValue({ areas: [{ id: "a1", code: "FY27-GROW" }] });
    await call(editor, "set_so_whats", { period: "2026-10", scope: "GROW", soWhats: [{ headline: "Units up" }] });
    expect(m.setSoWhats).toHaveBeenCalledWith(editor, { periodId: "2026-10", scope: "FY27-GROW", items: [{ scope: "FY27-GROW", headline: "Units up", body: null }] });
    await call(editor, "set_so_whats", { period: "2026-10", scope: "summary", soWhats: [] });
    expect(m.setSoWhats).toHaveBeenLastCalledWith(editor, { periodId: "2026-10", scope: "SUMMARY", items: [] });
  });

  it("lets a viewer add an SI update, resolved by code; the edit decides if they lead it", async () => {
    m.initiativeFindFirst.mockResolvedValue({ id: "i1" });
    await call(viewer, "add_si_update", { period: "2026-10", initiative: "M&A-01", status: "AT_RISK", update: "Slipped" });
    expect(m.addSiUpdate).toHaveBeenCalledWith(viewer, { periodId: "2026-10", initiativeId: "i1", status: "AT_RISK", update: "Slipped", pathForward: undefined });
    expect((await call(viewer, "add_si_update", { period: "2026-10", initiative: "M&A-01", status: "GREAT" })).result.isError).toBe(true);
  });
});
