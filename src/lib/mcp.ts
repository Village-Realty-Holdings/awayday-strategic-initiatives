import { z } from "zod";
import { getReviewPeriod, getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { addSiUpdate, setPillarMeasure, setSoWhats, updateReviewDetails } from "@/lib/review-edits";
import { initiativeOwnerMatches, PILLAR_STATUSES, ragLabel, shortCode, SO_WHAT_LIMITS, SUMMARY_SCOPE } from "@/lib/review-model";
import { STATUS_ORDER } from "@/lib/initiatives";
import { canEdit } from "@/lib/roles";
import type { TokenActor } from "@/lib/api-tokens";
import { day, defineTool, fromEdit, norm, period, resolveArea, resolveInitiative, type Tool, type ToolOutput } from "@/lib/mcp-tool";
import { INITIATIVE_TOOLS } from "@/lib/mcp-initiative-tools";

// ---------------------------------------------------------------------------
// MCP server for the monthly review, over Streamable HTTP (one JSON-RPC
// message per POST, a JSON reply). Written by hand rather than with the MCP
// SDK: the SDK's Ajv validator compiles code with `new Function`, which
// Workers forbid, and a tools-only server needs little of it.
//
// Two protocol eras are served:
// - 2026-07-28 (current): stateless. Each request carries its protocol version
//   and client capabilities in `params._meta`, plus the MCP-Protocol-Version,
//   Mcp-Method and Mcp-Name headers, which must agree with the body. Clients
//   may call `server/discover` first.
// - 2025-03-26 to 2025-11-25 (legacy): an `initialize` handshake, then plain
//   requests. Kept so older clients still connect; no session is kept.
//
// Every write goes through lib/review-edits.ts, the same code Edit Mode uses,
// so permissions, the published-month lock and the audit log are identical.
// ---------------------------------------------------------------------------

export const MODERN_PROTOCOL_VERSIONS = ["2026-07-28"] as const;
export const LEGACY_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
const ALL_VERSIONS: readonly string[] = [...MODERN_PROTOCOL_VERSIONS, ...LEGACY_PROTOCOL_VERSIONS];
const SERVER_INFO = { name: "awayday-strategic-initiatives", title: "Awayday Strategic Initiatives", version: "1.1.0" };

const INSTRUCTIONS = `Read and update Awayday's monthly Strategy Review.
Periods are months written YYYY-MM. Call list_review_periods, then get_review to see a month before changing it.
Pillars are addressed by their code (e.g. "GROW") or id from get_review; initiatives (SIs) by code or id.
A published month is read-only. Edits are saved as the token's owner and appear in the app straight away.`;

/** How long clients may cache tools/list and server/discover. Lists vary by token, so they are private. */
const LIST_TTL_MS = 5 * 60 * 1000;

const META = {
  protocolVersion: "io.modelcontextprotocol/protocolVersion",
  clientCapabilities: "io.modelcontextprotocol/clientCapabilities",
  serverInfo: "io.modelcontextprotocol/serverInfo",
} as const;

// ---------------------------------------------------------------------------
// JSON-RPC
// ---------------------------------------------------------------------------

type JsonRpcId = string | number;
type JsonRpcRequest = { jsonrpc: "2.0"; id?: JsonRpcId | null; method: string; params?: Record<string, unknown> };
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId | null; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId | null; error: { code: number; message: string; data?: unknown } };

export const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;
const HEADER_MISMATCH = -32020;
const UNSUPPORTED_PROTOCOL_VERSION = -32022;

export function rpcError(id: JsonRpcId | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } };
}

/** What the route sends back: a status, and a JSON body unless there is none (202). */
export type McpHttpReply = { status: number; body?: JsonRpcResponse };

type Headers = { get(name: string): string | null };

function isRequest(msg: unknown): msg is JsonRpcRequest {
  return Boolean(msg && typeof msg === "object" && (msg as JsonRpcRequest).jsonrpc === "2.0" && typeof (msg as JsonRpcRequest).method === "string");
}

/** Tool results, discovery and lists: the method's result, or a JSON-RPC error. */
type MethodResult = { ok: true; result: Record<string, unknown> } | { ok: false; error: JsonRpcResponse; status?: number };

/**
 * Handle one POSTed JSON-RPC message. The era comes from the message: a
 * request with `_meta` protocol version (or a modern MCP-Protocol-Version
 * header) is 2026-07-28; anything else, `initialize` included, is legacy.
 * Notifications and client responses need no reply (202).
 */
export async function handleMcpMessage(body: unknown, headers: Headers, actor: TokenActor): Promise<McpHttpReply> {
  if (Array.isArray(body)) return { status: 400, body: rpcError(null, INVALID_REQUEST, "Batches are not supported. Send one JSON-RPC message per request.") };
  if (!isRequest(body)) {
    // A response from the client (we never send requests) needs no reply.
    if (body && typeof body === "object" && ("result" in body || "error" in body)) return { status: 202 };
    return { status: 400, body: rpcError(null, INVALID_REQUEST, "Not a JSON-RPC 2.0 request.") };
  }
  if (body.id === undefined || body.id === null) return { status: 202 };
  const id = body.id;
  try {
    const reply = isModern(body, headers) ? await handleModern(body, id, headers, actor) : await handleLegacy(body, id, actor);
    return reply;
  } catch (e) {
    console.error("mcp request failed", { method: body.method }, e);
    return { status: 500, body: rpcError(id, INTERNAL_ERROR, "Internal error.") };
  }
}

function metaOf(msg: JsonRpcRequest): Record<string, unknown> | null {
  const meta = msg.params?._meta;
  return meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null;
}

function isModern(msg: JsonRpcRequest, headers: Headers): boolean {
  if (msg.method === "initialize") return false;
  if (metaOf(msg)?.[META.protocolVersion] !== undefined) return true;
  const header = headers.get("mcp-protocol-version");
  return header !== null && !(LEGACY_PROTOCOL_VERSIONS as readonly string[]).includes(header);
}

// --- 2026-07-28 -------------------------------------------------------------

async function handleModern(msg: JsonRpcRequest, id: JsonRpcId, headers: Headers, actor: TokenActor): Promise<McpHttpReply> {
  const meta = metaOf(msg);
  const version = meta?.[META.protocolVersion];
  const capabilities = meta?.[META.clientCapabilities];
  if (typeof version !== "string" || !capabilities || typeof capabilities !== "object") {
    return { status: 400, body: rpcError(id, INVALID_PARAMS, `Every request needs params._meta["${META.protocolVersion}"] and ["${META.clientCapabilities}"].`) };
  }
  if (!(MODERN_PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
    return { status: 400, body: rpcError(id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported protocol version", { supported: ALL_VERSIONS, requested: version }) };
  }
  const mismatch = headerMismatch(msg, version, headers);
  if (mismatch) return { status: 400, body: rpcError(id, HEADER_MISMATCH, mismatch) };

  let out: MethodResult;
  switch (msg.method) {
    case "server/discover":
      out = {
        ok: true,
        result: { supportedVersions: ALL_VERSIONS, capabilities: { tools: {} }, instructions: INSTRUCTIONS, ttlMs: LIST_TTL_MS, cacheScope: "private" },
      };
      break;
    case "tools/list":
      out = listTools(id, msg.params, actor);
      if (out.ok) out.result = { ...out.result, ttlMs: LIST_TTL_MS, cacheScope: "private" };
      break;
    case "tools/call":
      out = await callTool(id, msg.params, actor);
      break;
    default:
      return { status: 404, body: rpcError(id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`) };
  }
  if (!out.ok) return { status: out.status ?? 200, body: out.error };
  return { status: 200, body: { jsonrpc: "2.0", id, result: { resultType: "complete", ...out.result, _meta: { [META.serverInfo]: SERVER_INFO } } } };
}

/** The standard headers must be present and agree with the body. Returns the problem, or null. */
function headerMismatch(msg: JsonRpcRequest, version: string, headers: Headers): string | null {
  const check = (name: string, expected: string, decode = false) => {
    const raw = headers.get(name);
    if (raw === null) return `Missing ${name} header.`;
    const value = decode ? decodeHeaderValue(raw.trim()) : raw.trim();
    if (value === null) return `Invalid ${name} header.`;
    return value === expected ? null : `Header mismatch: ${name} header value '${value}' does not match body value '${expected}'`;
  };
  const problem = check("MCP-Protocol-Version", version) ?? check("Mcp-Method", msg.method);
  if (problem) return problem;
  if (msg.method === "tools/call") return check("Mcp-Name", typeof msg.params?.name === "string" ? msg.params.name : "", true);
  return null;
}

/** Header values that can't be sent as-is arrive as =?base64?…?=. */
function decodeHeaderValue(value: string): string | null {
  const encoded = value.match(/^=\?base64\?(.*)\?=$/i);
  if (!encoded) return value;
  try {
    const bin = atob(encoded[1]);
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

// --- 2025 (initialize handshake) --------------------------------------------

async function handleLegacy(msg: JsonRpcRequest, id: JsonRpcId, actor: TokenActor): Promise<McpHttpReply> {
  let out: MethodResult;
  switch (msg.method) {
    case "initialize":
      out = { ok: true, result: initializeResult(msg.params) };
      break;
    case "ping":
      out = { ok: true, result: {} };
      break;
    case "tools/list":
      out = listTools(id, msg.params, actor);
      break;
    case "tools/call":
      out = await callTool(id, msg.params, actor);
      break;
    default:
      return { status: 200, body: rpcError(id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`) };
  }
  return { status: 200, body: out.ok ? { jsonrpc: "2.0", id, result: out.result } : out.error };
}

function initializeResult(params: Record<string, unknown> | undefined) {
  const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : null;
  const legacy: readonly string[] = LEGACY_PROTOCOL_VERSIONS;
  const protocolVersion = requested && legacy.includes(requested) ? requested : LEGACY_PROTOCOL_VERSIONS[0];
  return { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function visibleTools(actor: TokenActor): Tool[] {
  return TOOLS.filter((t) => {
    if (t.access === "read") return true;
    if (actor.scope === "read") return false;
    if (t.access === "admin") return actor.role === "admin";
    return t.access === "owner" || canEdit(actor.role);
  });
}

function describeTool(tool: Tool) {
  const inputSchema = z.toJSONSchema(tool.input) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema,
    annotations: { title: tool.title, readOnlyHint: tool.access === "read", destructiveHint: Boolean(tool.destructive), idempotentHint: tool.access === "read", openWorldHint: false },
  };
}

function listTools(id: JsonRpcId, params: Record<string, unknown> | undefined, actor: TokenActor): MethodResult {
  // One page holds every tool, so the only valid cursor is none.
  if (params?.cursor !== undefined) return { ok: false, error: rpcError(id, INVALID_PARAMS, "Invalid cursor.") };
  return { ok: true, result: { tools: visibleTools(actor).map(describeTool) } };
}

async function callTool(id: JsonRpcId, params: Record<string, unknown> | undefined, actor: TokenActor): Promise<MethodResult> {
  const name = typeof params?.name === "string" ? params.name : "";
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: rpcError(id, INVALID_PARAMS, `Unknown tool: ${name || "(none)"}`) };
  if (!visibleTools(actor).includes(tool)) {
    const why = actor.scope === "read" ? "This API token is read-only." : tool.access === "admin" ? "Only admins can use this tool." : "Only admins and editors can use this tool.";
    return { ok: true, result: toolResult({ text: why, isError: true }) };
  }
  const parsed = tool.input.safeParse(params?.arguments ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`).join("; ");
    return { ok: true, result: toolResult({ text: `Invalid arguments. ${issues}`, isError: true }) };
  }
  return { ok: true, result: toolResult(await tool.run(actor, parsed.data)) };
}

function toolResult(out: ToolOutput): Record<string, unknown> {
  const text = out.data === undefined ? out.text : `${out.text}\n\n${JSON.stringify(out.data)}`;
  return {
    content: [{ type: "text", text }],
    ...(out.data !== undefined && !Array.isArray(out.data) ? { structuredContent: out.data } : {}),
    isError: Boolean(out.isError),
  };
}

const TOOLS: Tool[] = [
  defineTool({
    name: "list_review_periods",
    title: "List review months",
    description: "Every review month (YYYY-MM), newest first, with whether it is published (read-only) or a draft, and which month the app opens by default.",
    access: "read",
    input: z.object({}),
    run: async () => {
      const { periods, home, published } = await resolvePeriod(null);
      const data = { defaultPeriod: home, periods: periods.map((id) => ({ id, status: published.includes(id) ? "PUBLISHED" : "DRAFT" })) };
      return { text: `${periods.length} review months. The app opens ${home} by default.`, data };
    },
  }),

  defineTool({
    name: "get_review",
    title: "Get a month's review",
    description:
      "One month of the Strategy Review: its header (prepared by, meeting date, updates due, data as of), the summary so-whats, and each pillar and enabler with its so-whats, measure (value, target, status, whether the status was set by hand) and strategic initiatives (status, latest progress, what next, open milestones and asks).",
    access: "read",
    input: z.object({ period: period.optional().describe("Review month, YYYY-MM. Defaults to the month the app opens.") }),
    run: async (actor, { period: requested }) => {
      const { id } = requested ? { id: requested } : await resolvePeriod(null);
      const [header, plan] = await Promise.all([getReviewPeriod(id), getReviewPlan(id)]);
      const soWhats = (list: { headline: string; body: string | null }[] | undefined) => (list ?? []).map(({ headline, body }) => ({ headline, body }));
      const data = {
        period: {
          id,
          label: header.label,
          status: header.status,
          editable: header.status !== "PUBLISHED",
          preparedBy: header.preparedBy,
          meetingDate: header.meetingDate,
          updatesDueDate: header.updatesDueDate,
          dataAsOf: header.dataAsOf,
          sources: header.sources,
        },
        plan: { code: plan.code, title: plan.title, mission: plan.mission, goal: plan.goal },
        summarySoWhats: soWhats(header.summary),
        pillars: plan.areas.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          kind: a.kind === "ENABLER" ? "enabler" : "pillar",
          goal: a.goal,
          owner: a.ownerLine,
          soWhats: soWhats(header.areaSoWhats[a.code]),
          measure: a.measure && {
            name: a.measure.name,
            value: a.measure.value,
            target: a.measure.target,
            status: ragLabel(a.measure.rag),
            statusSetByHand: a.measure.statusOverride ?? null,
            valueSource: a.measure.source,
          },
          initiatives: a.sis.map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            lead: s.lead,
            youLeadIt: initiativeOwnerMatches({ ownerUserId: s.ownerUserId, teamLead: s.lead }, actor),
            status: s.status,
            updatedThisPeriod: s.updatedThisPeriod,
            latestProgress: s.latestProgress,
            whatNext: s.whatNext,
            openMilestones: s.milestones.filter((m) => !m.done).map((m) => ({ title: m.title, due: m.date, owner: m.owner })),
            asks: s.asks.map((k) => ({ request: k.request, kind: k.kind, status: k.status })),
          })),
        })),
      };
      return { text: `${header.label} review (${header.status.toLowerCase()}).`, data };
    },
  }),

  defineTool({
    name: "update_review_details",
    title: "Update a month's details",
    description: "Set the month's header fields. Omit a field to leave it unchanged; pass null to clear it. Creates the month as a draft if it hasn't been started.",
    access: "editor",
    input: z.object({
      period,
      preparedBy: z.string().max(120).nullable().optional().describe("Who prepared the review."),
      meetingDate: day.describe("Review meeting day, YYYY-MM-DD."),
      updatesDueDate: day.describe("Day SI updates are due, YYYY-MM-DD."),
      dataAsOf: day.describe("Overrides the data-as-of day worked out from the loaded figures, YYYY-MM-DD."),
    }),
    run: async (actor, { period: id, ...fields }) => fromEdit(await updateReviewDetails(actor, { periodId: id, ...fields }), `Saved the ${id} review details.`),
  }),

  defineTool({
    name: "set_so_whats",
    title: "Replace so-whats",
    description: `Replace all so-whats for the summary or for one pillar in a month (the list you send becomes the whole list; send [] to clear it). Up to ${SO_WHAT_LIMITS.perScope} per scope; headline up to ${SO_WHAT_LIMITS.headline} characters, body up to ${SO_WHAT_LIMITS.body}.`,
    access: "editor",
    input: z.object({
      period,
      scope: z.string().min(1).describe(`"${SUMMARY_SCOPE}" for the review summary, or a pillar's code or id.`),
      soWhats: z
        .array(z.object({ headline: z.string().min(1).max(SO_WHAT_LIMITS.headline), body: z.string().max(SO_WHAT_LIMITS.body).nullable().optional() }))
        .max(SO_WHAT_LIMITS.perScope),
    }),
    run: async (actor, { period: id, scope: ref, soWhats }) => {
      let scope = SUMMARY_SCOPE;
      if (norm(ref) !== norm(SUMMARY_SCOPE)) {
        const plan = await getReviewPlan(id);
        const key = norm(ref);
        const area = plan.areas.find((a) => a.id === ref || norm(a.code) === key || norm(shortCode(a.code)) === key);
        if (!area) return { text: `No pillar "${ref}" in the active plan. Use get_review to see the pillar codes.`, isError: true };
        scope = area.code;
      }
      const result = await setSoWhats(actor, { periodId: id, scope, items: soWhats.map((s) => ({ scope, headline: s.headline, body: s.body ?? null })) });
      return fromEdit(result, `Saved ${soWhats.length} so-what${soWhats.length === 1 ? "" : "s"} for ${scope === SUMMARY_SCOPE ? "the summary" : scope} in ${id}.`);
    },
  }),

  defineTool({
    name: "set_pillar_measure",
    title: "Set a pillar's value or status",
    description:
      'Set a pillar\'s measure value for the month (as displayed, e.g. "$12.4M" or "9.8%"; null clears a value typed in by hand) and/or its status. Status "calculated" goes back to the status worked out from the value and target. Enablers have no status. A value loaded from a source document can\'t be changed here.',
    access: "editor",
    input: z.object({
      period,
      pillar: z.string().min(1).describe("The pillar's code or id."),
      value: z.string().max(60).nullable().optional(),
      status: z.enum([...PILLAR_STATUSES, "calculated"]).optional(),
    }),
    run: async (actor, { period: id, pillar, value, status }) => {
      if (value === undefined && status === undefined) return { text: "Send a value, a status, or both.", isError: true };
      const area = await resolveArea(pillar);
      if (!area) return { text: `No pillar "${pillar}" in the active plan. Use get_review to see the pillar codes.`, isError: true };
      return fromEdit(await setPillarMeasure(actor, { periodId: id, areaId: area.id, value, status }), `Saved ${area.code} for ${id}.`);
    },
  }),

  defineTool({
    name: "add_si_update",
    title: "Add an SI update",
    description:
      "Record a strategic initiative's monthly update: status, latest progress and what next. Admins and editors can update any SI; others only the SIs they lead. Each call adds a new update; the newest one for the month is what the review shows.",
    access: "owner",
    input: z.object({
      period,
      initiative: z.string().min(1).describe("The SI's code (e.g. \"M&A-01\") or id."),
      status: z.enum(STATUS_ORDER as [string, ...string[]]).nullable().optional(),
      update: z.string().max(10_000).nullable().optional().describe("Latest progress."),
      pathForward: z.string().max(10_000).nullable().optional().describe("What happens next."),
    }),
    run: async (actor, { period: id, initiative: ref, status, update, pathForward }) => {
      const initiative = await resolveInitiative(ref);
      if (!initiative) return { text: `No initiative "${ref}". Use get_review to see initiative codes.`, isError: true };
      return fromEdit(await addSiUpdate(actor, { periodId: id, initiativeId: initiative.id, status, update, pathForward }), `Saved the ${ref} update for ${id}.`);
    },
  }),
];

TOOLS.push(...INITIATIVE_TOOLS);

export const TOOL_NAMES = TOOLS.map((t) => t.name);
