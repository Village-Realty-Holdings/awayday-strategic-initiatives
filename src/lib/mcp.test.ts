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

const VERSION = "2026-07-28";
const meta = { "io.modelcontextprotocol/protocolVersion": VERSION, "io.modelcontextprotocol/clientCapabilities": {}, "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" } };
const headersOf = (h: Record<string, string>) => new Headers(h);

type Reply = { status: number; body?: { result?: Record<string, unknown> & { isError: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> }; error?: { code: number; message: string; data?: unknown } } };

/** A 2026-07-28 request with the standard headers filled in from the body (overridable). */
function modern(actor: TokenActor, method: string, params: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const std: Record<string, string> = { "MCP-Protocol-Version": VERSION, "Mcp-Method": method };
  if (method === "tools/call") std["Mcp-Name"] = String(params.name);
  return handleMcpMessage({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: meta } }, headersOf({ ...std, ...headers }), actor) as Promise<Reply>;
}

function legacy(actor: TokenActor, msg: Record<string, unknown>) {
  return handleMcpMessage({ jsonrpc: "2.0", ...msg }, headersOf({ "MCP-Protocol-Version": "2025-06-18" }), actor) as Promise<Reply>;
}

const call = (actor: TokenActor, name: string, args: Record<string, unknown> = {}) => modern(actor, "tools/call", { name, arguments: args });

const toolNames = async (actor: TokenActor) => ((await modern(actor, "tools/list")).body!.result!.tools as { name: string }[]).map((t) => t.name);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("2026-07-28", () => {
  it("discovers versions, tools capability and identity", async () => {
    const reply = await modern(editor, "server/discover");
    expect(reply.status).toBe(200);
    expect(reply.body!.result).toMatchObject({
      resultType: "complete",
      supportedVersions: ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"],
      capabilities: { tools: {} },
      cacheScope: "private",
      _meta: { "io.modelcontextprotocol/serverInfo": { name: "awayday-strategic-initiatives" } },
    });
    expect(typeof reply.body!.result!.ttlMs).toBe("number");
  });

  it("marks lists cacheable per token and results complete", async () => {
    const list = await modern(editor, "tools/list");
    expect(list.body!.result).toMatchObject({ resultType: "complete", cacheScope: "private" });
    const tool = await call(editor, "list_review_periods");
    expect(tool.body!.result).toMatchObject({ resultType: "complete", isError: false });
  });

  it("refuses a request without the version and capabilities in _meta", async () => {
    const reply = (await handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: { "io.modelcontextprotocol/protocolVersion": VERSION } } },
      headersOf({ "MCP-Protocol-Version": VERSION, "Mcp-Method": "tools/list" }),
      editor,
    )) as Reply;
    expect(reply).toMatchObject({ status: 400, body: { error: { code: -32602 } } });
  });

  it("names the supported versions for one it doesn't know", async () => {
    const reply = (await handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: { ...meta, "io.modelcontextprotocol/protocolVersion": "2099-01-01" } } },
      headersOf({ "MCP-Protocol-Version": "2099-01-01", "Mcp-Method": "tools/list" }),
      editor,
    )) as Reply;
    expect(reply).toMatchObject({ status: 400, body: { error: { code: -32022, data: { requested: "2099-01-01" } } } });
  });

  it("requires the standard headers to match the body", async () => {
    expect(await modern(editor, "tools/list", {}, { "Mcp-Method": "tools/call" })).toMatchObject({ status: 400, body: { error: { code: -32020 } } });
    expect(await modern(editor, "tools/list", {}, { "MCP-Protocol-Version": "2025-11-25" })).toMatchObject({ status: 400, body: { error: { code: -32020 } } });
    expect(await modern(editor, "tools/call", { name: "get_review", arguments: {} }, { "Mcp-Name": "list_review_periods" })).toMatchObject({ status: 400, body: { error: { code: -32020 } } });
    const missing = (await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: meta } }, headersOf({ "MCP-Protocol-Version": VERSION }), editor)) as Reply;
    expect(missing).toMatchObject({ status: 400, body: { error: { code: -32020 } } });
  });

  it("accepts a base64-encoded Mcp-Name", async () => {
    const reply = await modern(editor, "tools/call", { name: "list_review_periods", arguments: {} }, { "Mcp-Name": `=?base64?${btoa("list_review_periods")}?=` });
    expect(reply.status).toBe(200);
  });

  it("answers unknown methods, ping included, with 404", async () => {
    expect(await modern(editor, "ping")).toMatchObject({ status: 404, body: { error: { code: -32601 } } });
  });

  it("rejects a cursor, since every tool fits on one page", async () => {
    expect(await modern(editor, "tools/list", { cursor: "x" })).toMatchObject({ body: { error: { code: -32602 } } });
  });
});

describe("2025 handshake", () => {
  it("negotiates a legacy version and announces tools", async () => {
    const reply = await legacy(editor, { id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    expect(reply.body!.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "awayday-strategic-initiatives" } });
    const newer = await legacy(editor, { id: 2, method: "initialize", params: { protocolVersion: "2099-01-01" } });
    expect(newer.body!.result!.protocolVersion).toBe("2025-11-25");
  });

  it("serves tools without _meta or the new headers", async () => {
    const list = await legacy(editor, { id: 3, method: "tools/list" });
    expect(list.status).toBe(200);
    expect(list.body!.result!.resultType).toBeUndefined();
    const tool = await legacy(editor, { id: 4, method: "tools/call", params: { name: "list_review_periods", arguments: {} } });
    expect(tool.body!.result!.isError).toBe(false);
  });

  it("answers ping, accepts notifications with 202 and rejects batches and unknown methods", async () => {
    expect(await legacy(editor, { id: 5, method: "ping" })).toEqual({ status: 200, body: { jsonrpc: "2.0", id: 5, result: {} } });
    expect(await legacy(editor, { method: "notifications/initialized" })).toEqual({ status: 202 });
    expect(await legacy(editor, { id: 6, method: "resources/list" })).toMatchObject({ body: { error: { code: -32601 } } });
    expect(await handleMcpMessage([{ jsonrpc: "2.0", id: 1, method: "ping" }], headersOf({}), editor)).toMatchObject({ status: 400, body: { error: { code: -32600 } } });
    expect(await handleMcpMessage({ hello: "world" }, headersOf({}), editor)).toMatchObject({ status: 400, body: { error: { code: -32600 } } });
  });
});

describe("tools/list", () => {
  it("shows editors every tool, in a fixed order, with object input schemas", async () => {
    expect(await toolNames(editor)).toEqual(["list_review_periods", "get_review", "update_review_details", "set_so_whats", "set_pillar_measure", "add_si_update"]);
    for (const t of (await modern(editor, "tools/list")).body!.result!.tools as { inputSchema: Record<string, unknown> }[]) {
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
    expect(ro.body!.result).toMatchObject({ isError: true, content: [{ text: "This API token is read-only." }] });
    const v = await call(viewer, "update_review_details", { period: "2026-10", preparedBy: "x" });
    expect(v.body!.result!.isError).toBe(true);
    expect(m.setPillarMeasure).not.toHaveBeenCalled();
    expect(m.updateReviewDetails).not.toHaveBeenCalled();
  });

  it("returns invalid arguments as a tool error the model can correct", async () => {
    const reply = await call(editor, "update_review_details", { period: "Oct 2026" });
    expect(reply.body!.result!.isError).toBe(true);
    expect(reply.body!.result!.content[0].text).toContain("period");
    expect(m.updateReviewDetails).not.toHaveBeenCalled();
  });

  it("rejects an unknown tool as a protocol error", async () => {
    expect(await call(editor, "drop_tables")).toMatchObject({ body: { error: { code: -32602 } } });
  });

  it("lists periods with their status", async () => {
    const reply = await call(editor, "list_review_periods");
    expect(reply.body!.result!.structuredContent).toEqual({
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
    expect(reply.body!.result!.isError).toBe(false);
    expect(m.setPillarMeasure).toHaveBeenCalledWith(editor, { periodId: "2026-10", areaId: "a1", value: "$12.4M", status: "calculated" });
  });

  it("needs a value or a status, and a known pillar", async () => {
    expect((await call(editor, "set_pillar_measure", { period: "2026-10", pillar: "GROW" })).body!.result!.isError).toBe(true);
    expect((await call(editor, "set_pillar_measure", { period: "2026-10", pillar: "NOPE", status: "AHEAD" })).body!.result!.isError).toBe(true);
    expect(m.setPillarMeasure).not.toHaveBeenCalled();
  });

  it("surfaces the edit's own error, e.g. a published month", async () => {
    m.setPillarMeasure.mockResolvedValueOnce({ ok: false, error: "This month is published." } as never);
    const reply = await call(editor, "set_pillar_measure", { period: "2026-09", pillar: "GROW", status: "AHEAD" });
    expect(reply.body!.result).toMatchObject({ isError: true, content: [{ text: "This month is published." }] });
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
    expect((await call(viewer, "add_si_update", { period: "2026-10", initiative: "M&A-01", status: "GREAT" })).body!.result!.isError).toBe(true);
  });
});
