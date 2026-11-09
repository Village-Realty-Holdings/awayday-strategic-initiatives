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
  updateInitiativeCharter: vi.fn(async () => ({ ok: true })),
  createInitiative: vi.fn(async () => ({ ok: true, id: "i9" })),
  updateInitiativeProgress: vi.fn(async () => ({ ok: true })),
  setMilestoneDone: vi.fn(async () => ({ ok: true })),
  addActionItem: vi.fn(async () => ({ ok: true, id: "ai1" })),
  addEltRequest: vi.fn(async () => ({ ok: true, id: "e1" })),
  addMeasureReading: vi.fn(async () => ({ ok: true, id: "r1" })),
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
vi.mock("@/lib/initiative-edits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/initiative-edits")>()),
  updateInitiativeCharter: m.updateInitiativeCharter,
  createInitiative: m.createInitiative,
  updateInitiativeProgress: m.updateInitiativeProgress,
  setMilestoneDone: m.setMilestoneDone,
  addActionItem: m.addActionItem,
  addEltRequest: m.addEltRequest,
  addMeasureReading: m.addMeasureReading,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { strategicArea: { findMany: m.areaFindMany }, initiative: { findFirst: m.initiativeFindFirst } },
}));

import { handleMcpMessage } from "@/lib/mcp";
import type { McpActor } from "@/lib/mcp-auth";

const editor: McpActor = { id: "u1", name: "Erin Editor", role: "editor", scope: "write", clientId: "c1" };
const viewer: McpActor = { ...editor, role: "user" };
const readOnly: McpActor = { ...editor, scope: "read" };
const admin: McpActor = { ...editor, role: "admin" };

const REVIEW_READ = ["list_review_periods", "get_review"];
const SI_READ = ["list_initiatives", "get_initiative"];
const SI_OWNER = ["set_milestone_done", "set_action_item_done", "add_measure", "update_measure", "set_primary_measure", "remove_measure", "add_measure_reading", "remove_measure_reading"];
const SI_EDITOR = ["update_initiative", "update_initiative_progress", "add_milestone", "update_milestone", "remove_milestone", "add_action_item", "remove_action_item", "add_elt_ask", "update_elt_ask", "remove_elt_ask"];

const VERSION = "2026-07-28";
const meta = { "io.modelcontextprotocol/protocolVersion": VERSION, "io.modelcontextprotocol/clientCapabilities": {}, "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" } };
const headersOf = (h: Record<string, string>) => new Headers(h);

type Reply = { status: number; body?: { result?: Record<string, unknown> & { isError: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> }; error?: { code: number; message: string; data?: unknown } } };

/** A 2026-07-28 request with the standard headers filled in from the body (overridable). */
function modern(actor: McpActor, method: string, params: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const std: Record<string, string> = { "MCP-Protocol-Version": VERSION, "Mcp-Method": method };
  if (method === "tools/call") std["Mcp-Name"] = String(params.name);
  return handleMcpMessage({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: meta } }, headersOf({ ...std, ...headers }), actor) as Promise<Reply>;
}

function legacy(actor: McpActor, msg: Record<string, unknown>) {
  return handleMcpMessage({ jsonrpc: "2.0", ...msg }, headersOf({ "MCP-Protocol-Version": "2025-06-18" }), actor) as Promise<Reply>;
}

const call = (actor: McpActor, name: string, args: Record<string, unknown> = {}) => modern(actor, "tools/call", { name, arguments: args });

const toolNames = async (actor: McpActor) => ((await modern(actor, "tools/list")).body!.result!.tools as { name: string }[]).map((t) => t.name);

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
  it("shows editors every tool but create_initiative, with object input schemas", async () => {
    const names = await toolNames(editor);
    expect(names.slice(0, 6)).toEqual(["list_review_periods", "get_review", "update_review_details", "set_so_whats", "set_pillar_measure", "add_si_update"]);
    expect(names.slice(6).sort()).toEqual([...SI_READ, ...SI_OWNER, ...SI_EDITOR].sort());
    expect(await toolNames(admin)).toContain("create_initiative");
    for (const t of (await modern(editor, "tools/list")).body!.result!.tools as { inputSchema: Record<string, unknown> }[]) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.inputSchema.$schema).toBeUndefined();
    }
  });

  it("shows viewers the read tools and SI updates, and read-only tokens the read tools", async () => {
    expect((await toolNames(viewer)).sort()).toEqual([...REVIEW_READ, "add_si_update", ...SI_READ, ...SI_OWNER].sort());
    expect((await toolNames(readOnly)).sort()).toEqual([...REVIEW_READ, ...SI_READ].sort());
  });

  it("marks remove tools destructive and the rest not", async () => {
    const tools = (await modern(admin, "tools/list")).body!.result!.tools as { name: string; annotations: { destructiveHint?: boolean; readOnlyHint?: boolean } }[];
    for (const t of tools) {
      if (t.annotations.readOnlyHint) continue;
      expect(t.annotations.destructiveHint, t.name).toBe(t.name.startsWith("remove_"));
    }
  });
});

describe("tools/call", () => {
  it("refuses a write tool on a read-only token, and an editor tool for a viewer, as tool errors", async () => {
    const ro = await call(readOnly, "set_pillar_measure", { period: "2026-10", pillar: "GROW", status: "AHEAD" });
    expect(ro.body!.result).toMatchObject({ isError: true, content: [{ text: "This connection is read-only. Reconnect Claude and allow editing to use this tool." }] });
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

describe("initiative tools", () => {
  beforeEach(() => m.initiativeFindFirst.mockResolvedValue({ id: "i1" }));

  it("resolves an initiative by code and passes only the charter fields given", async () => {
    const reply = await call(editor, "update_initiative", { initiative: "m&a-01", teamLead: "Dana", baseline: null });
    expect(reply.body!.result!.isError).toBe(false);
    expect(m.updateInitiativeCharter).toHaveBeenCalledWith(editor, "i1", { teamLead: "Dana", baseline: null });
  });

  it("names an unknown initiative instead of editing", async () => {
    m.initiativeFindFirst.mockResolvedValue(null);
    const reply = await call(editor, "update_initiative", { initiative: "NOPE-1", teamLead: "Dana" });
    expect(reply.body!.result).toMatchObject({ isError: true });
    expect(reply.body!.result!.content[0].text).toContain("NOPE-1");
    expect(m.updateInitiativeCharter).not.toHaveBeenCalled();
  });

  it("reads dollars from numbers or text, and refuses unreadable amounts", async () => {
    await call(editor, "update_initiative_progress", { initiative: "M&A-01", actual: "$1.5M", target: 3000000 });
    expect(m.updateInitiativeProgress).toHaveBeenCalledWith(editor, "i1", { actual: 1500000, target: 3000000 });
    expect((await call(editor, "update_initiative_progress", { initiative: "M&A-01", actual: "lots", target: null })).body!.result!.isError).toBe(true);
    await call(editor, "add_elt_ask", { initiative: "M&A-01", request: "Two analysts", kind: "INVESTMENT", amount: "$250K" });
    expect(m.addEltRequest).toHaveBeenCalledWith(editor, "i1", { request: "Two analysts", kind: "INVESTMENT", amount: 250000 });
  });

  it("returns new item ids so the model can follow up", async () => {
    const reply = await call(editor, "add_action_item", { initiative: "M&A-01", title: "Data room", owner: "Legal", kind: "DEPENDENCY", due: "2026-12-01" });
    expect(reply.body!.result!.structuredContent).toEqual({ id: "ai1" });
    expect(m.addActionItem).toHaveBeenCalledWith(editor, "i1", { title: "Data room", owner: "Legal", kind: "DEPENDENCY", dueAt: "2026-12-01" });
  });

  it("lets a viewer complete a milestone or log a value; the edit decides if they may", async () => {
    await call(viewer, "set_milestone_done", { milestone: "ms1", done: true });
    expect(m.setMilestoneDone).toHaveBeenCalledWith(viewer, "ms1", true);
    m.addMeasureReading.mockResolvedValueOnce({ ok: false, error: "Only editors and the SI's lead can log values." } as never);
    const reply = await call(viewer, "add_measure_reading", { measure: "me1", value: "12.5%" });
    expect(reply.body!.result).toMatchObject({ isError: true, content: [{ text: "Only editors and the SI's lead can log values." }] });
  });

  it("keeps editor tools from viewers and create_initiative from editors", async () => {
    expect((await call(viewer, "add_milestone", { initiative: "M&A-01", title: "Close" })).body!.result!.isError).toBe(true);
    expect((await call(editor, "create_initiative", { code: "GROW-09", name: "New" })).body!.result!.isError).toBe(true);
    expect(m.createInitiative).not.toHaveBeenCalled();
    const reply = await call(admin, "create_initiative", { code: "grow-09", name: "New", pillar: "GROW" });
    expect(reply.body!.result!.structuredContent).toEqual({ id: "i9" });
    expect(m.createInitiative).toHaveBeenCalledWith(admin, { code: "grow-09", name: "New", cimDriver: undefined, strategicAreaId: "a1" });
  });
});
