import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActivePlan } from "@/lib/active-plan";
import { getReviewPeriod, getReviewPlan, resolvePeriod } from "@/lib/review-data";
import { addSiUpdate, setPillarMeasure, setSoWhats, updateReviewDetails, type EditResult } from "@/lib/review-edits";
import { initiativeOwnerMatches, PERIOD_PATTERN, PILLAR_STATUSES, ragLabel, shortCode, SO_WHAT_LIMITS, SUMMARY_SCOPE } from "@/lib/review-model";
import { STATUS_ORDER } from "@/lib/initiatives";
import { canEdit } from "@/lib/roles";
import type { TokenActor } from "@/lib/api-tokens";

// ---------------------------------------------------------------------------
// MCP server for the monthly review, over stateless Streamable HTTP (one
// JSON-RPC message per POST, a JSON reply, no server-side session). Written by
// hand rather than with @modelcontextprotocol/sdk: the SDK brings Express, Hono
// and Ajv, and Ajv compiles validators with `new Function`, which Workers
// forbid. The protocol surface needed here (initialize, ping, tools/list,
// tools/call) is small.
//
// Every write goes through lib/review-edits.ts, the same code Edit Mode uses,
// so permissions, the published-month lock and the audit log are identical.
// ---------------------------------------------------------------------------

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
const SERVER_INFO = { name: "awayday-strategic-initiatives", title: "Awayday Strategic Initiatives", version: "1.0.0" };

const INSTRUCTIONS = `Read and update Awayday's monthly Strategy Review.
Periods are months written YYYY-MM. Call list_review_periods, then get_review to see a month before changing it.
Pillars are addressed by their code (e.g. "GROW") or id from get_review; initiatives (SIs) by code or id.
A published month is read-only. Edits are saved as the token's owner and appear in the app straight away.`;

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

export function rpcError(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function isRequest(msg: unknown): msg is JsonRpcRequest {
  return Boolean(msg && typeof msg === "object" && (msg as JsonRpcRequest).jsonrpc === "2.0" && typeof (msg as JsonRpcRequest).method === "string");
}

/**
 * Handle one JSON-RPC message, or a batch of them. Returns null when nothing
 * needs a reply (notifications, and client responses), which the route answers
 * with 202 Accepted.
 */
export async function handleMcpMessage(body: unknown, actor: TokenActor): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    if (body.length === 0) return rpcError(null, INVALID_REQUEST, "Empty batch.");
    const replies = (await Promise.all(body.map((m) => handleOne(m, actor)))).filter((r): r is JsonRpcResponse => r !== null);
    return replies.length ? replies : null;
  }
  return handleOne(body, actor);
}

async function handleOne(msg: unknown, actor: TokenActor): Promise<JsonRpcResponse | null> {
  if (!isRequest(msg)) {
    // A response from the client (we never send requests) needs no reply.
    if (msg && typeof msg === "object" && ("result" in msg || "error" in msg)) return null;
    return rpcError(null, INVALID_REQUEST, "Not a JSON-RPC 2.0 request.");
  }
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null;
  const id = msg.id as JsonRpcId;
  try {
    switch (msg.method) {
      case "initialize":
        return { jsonrpc: "2.0", id, result: initializeResult(msg.params) };
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: visibleTools(actor).map(describeTool) } };
      case "tools/call":
        return await callTool(id, msg.params, actor);
      default:
        return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
    }
  } catch (e) {
    console.error("mcp request failed", { method: msg.method }, e);
    return rpcError(id, INTERNAL_ERROR, "Internal error.");
  }
}

function initializeResult(params: Record<string, unknown> | undefined) {
  const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : null;
  const protocolVersion = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested ?? "") ? requested! : SUPPORTED_PROTOCOL_VERSIONS[0];
  return { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** read: anyone; owner: editors, admins and SI leads; editor: editors and admins. */
type Access = "read" | "owner" | "editor";

type Tool<S extends z.ZodObject = z.ZodObject> = {
  name: string;
  title: string;
  description: string;
  access: Access;
  input: S;
  run: (actor: TokenActor, args: z.infer<S>) => Promise<ToolOutput>;
};

type ToolOutput = { text: string; data?: unknown; isError?: boolean };

const defineTool = <S extends z.ZodObject>(tool: Tool<S>) => tool as unknown as Tool;

const period = z.string().regex(PERIOD_PATTERN, "Use a month written YYYY-MM.").describe("Review month, YYYY-MM.");
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a day written YYYY-MM-DD.")
  .nullable()
  .optional();

function visibleTools(actor: TokenActor): Tool[] {
  return TOOLS.filter((t) => {
    if (t.access === "read") return true;
    if (actor.scope === "read") return false;
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
    annotations: { title: tool.title, readOnlyHint: tool.access === "read", destructiveHint: false, idempotentHint: tool.access === "read", openWorldHint: false },
  };
}

async function callTool(id: JsonRpcId, params: Record<string, unknown> | undefined, actor: TokenActor): Promise<JsonRpcResponse> {
  const name = typeof params?.name === "string" ? params.name : "";
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return rpcError(id, INVALID_PARAMS, `Unknown tool: ${name || "(none)"}`);
  if (!visibleTools(actor).includes(tool)) {
    const why = actor.scope === "read" ? "This API token is read-only." : "Only admins and editors can use this tool.";
    return { jsonrpc: "2.0", id, result: toolResult({ text: why, isError: true }) };
  }
  const parsed = tool.input.safeParse(params?.arguments ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`).join("; ");
    return { jsonrpc: "2.0", id, result: toolResult({ text: `Invalid arguments. ${issues}`, isError: true }) };
  }
  return { jsonrpc: "2.0", id, result: toolResult(await tool.run(actor, parsed.data)) };
}

function toolResult(out: ToolOutput) {
  const text = out.data === undefined ? out.text : `${out.text}\n\n${JSON.stringify(out.data)}`;
  return {
    content: [{ type: "text", text }],
    ...(out.data !== undefined && !Array.isArray(out.data) ? { structuredContent: out.data } : {}),
    isError: Boolean(out.isError),
  };
}

function fromEdit(result: EditResult, done: string): ToolOutput {
  return result.ok ? { text: done } : { text: result.error, isError: true };
}

const norm = (s: string) => s.trim().toLowerCase();

/** A StrategicArea of the active plan by id, code or short code. */
async function resolveArea(ref: string): Promise<{ id: string; code: string } | null> {
  const plan = await getActivePlan();
  if (!plan) return null;
  const areas = await prisma.strategicArea.findMany({ where: { planVersionId: plan.id }, select: { id: true, code: true } });
  const key = norm(ref);
  return areas.find((a) => a.id === ref) ?? areas.find((a) => norm(a.code) === key || norm(shortCode(a.code)) === key) ?? null;
}

/** An initiative by id, or by code within the active plan. */
async function resolveInitiative(ref: string): Promise<{ id: string } | null> {
  const plan = await getActivePlan();
  return prisma.initiative.findFirst({
    where: { OR: [{ id: ref }, { code: { equals: ref.trim(), mode: "insensitive" }, ...(plan ? { planVersionId: plan.id } : {}) }] },
    select: { id: true },
  });
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

export const TOOL_NAMES = TOOLS.map((t) => t.name);
