import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActivePlan } from "@/lib/active-plan";
import { isoDay, initiativeOwnerMatches } from "@/lib/review-model";
import { parseDollars } from "@/lib/initiatives";
import { MEASURE_KINDS, MEASURE_UNITS, primaryKpi } from "@/lib/measures";
import * as edits from "@/lib/initiative-edits";
import { day, defineTool, fromEdit, resolveArea, resolveInitiative, type Tool, type ToolOutput } from "@/lib/mcp-tool";

// ---------------------------------------------------------------------------
// MCP tools for strategic initiatives (SIs): read one or all, edit the charter
// and progress, and manage milestones, action items, ELT asks and measures.
// Every write goes through lib/initiative-edits.ts, the code the initiative
// pages use. Deleting an initiative stays in the app.
// ---------------------------------------------------------------------------

const initiativeRef = z.string().min(1).describe('The initiative\'s code (e.g. "M&A-01") or id.');
const itemId = (what: string) => z.string().min(1).describe(`The ${what}'s id, from get_initiative.`);
const text = (max: number) => z.string().max(max);
/** A number, or text like "$1.5M", "12.5%" or "18". */
const amount = z.union([z.number(), z.string().max(40)]);

const NOT_FOUND = (ref: string): ToolOutput => ({ text: `No initiative "${ref}". Use list_initiatives to see initiative codes.`, isError: true });

/** Run an edit against an initiative given by code or id. */
async function onInitiative(ref: string, run: (id: string) => Promise<ToolOutput>): Promise<ToolOutput> {
  const initiative = await resolveInitiative(ref);
  return initiative ? run(initiative.id) : NOT_FOUND(ref);
}

/** Dollars from a number or text like "$1.5M"; undefined when unreadable. */
function dollars(v: string | number | null | undefined): number | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (v.trim() === "") return null;
  return parseDollars(v) ?? undefined;
}

const charterShape = {
  name: text(200).optional(),
  teamLead: text(200).nullable().optional().describe("Primary lead, a person or role."),
  secondaryLead: text(200).nullable().optional(),
  valueWhenComplete: text(5000).nullable().optional().describe("Objective: one measurable closeout sentence."),
  quantMetric: text(500).nullable().optional().describe("The KPI the SI moves, e.g. \"TTM owner churn\"."),
  quantTarget: text(500).nullable().optional().describe('Its target, e.g. "<12%".'),
  baseline: text(500).nullable().optional().describe("Where the KPI stands today."),
  ebitdaValue: text(5000).nullable().optional().describe("EBITDA value, as written."),
  investmentCost: text(5000).nullable().optional().describe("Investment cost to deliver, as written."),
};

function charterInput(args: Partial<Record<edits.CharterField, string | null | undefined>>): edits.CharterInput {
  const out: edits.CharterInput = {};
  for (const key of edits.CHARTER_FIELDS) if (args[key] !== undefined) out[key] = args[key];
  return out;
}

export const INITIATIVE_TOOLS: Tool[] = [
  // --- Reading -------------------------------------------------------------
  defineTool({
    name: "list_initiatives",
    title: "List initiatives",
    description: "The strategic initiatives (SIs) of the active plan: code, name, pillar, lead, status and percent complete. Filter by pillar code if you like.",
    access: "read",
    input: z.object({ pillar: z.string().optional().describe("A pillar's code or id, to list only its SIs.") }),
    run: async (actor, { pillar }) => {
      const plan = await getActivePlan();
      let areaId: string | undefined;
      if (pillar) {
        const area = await resolveArea(pillar);
        if (!area) return { text: `No pillar "${pillar}" in the active plan.`, isError: true };
        areaId = area.id;
      }
      const rows = await prisma.initiative.findMany({
        where: { ...(plan ? { planVersionId: plan.id } : {}), ...(areaId ? { strategicAreaId: areaId } : {}) },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, teamLead: true, ownerUserId: true, status: true, pctComplete: true, strategicArea: { select: { code: true } } },
      });
      const data = {
        initiatives: rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          pillar: r.strategicArea?.code ?? null,
          lead: r.teamLead,
          youLeadIt: initiativeOwnerMatches({ ownerUserId: r.ownerUserId, teamLead: r.teamLead }, actor),
          status: r.status,
          pctComplete: Math.round(r.pctComplete * 1000) / 10,
        })),
      };
      return { text: `${rows.length} initiative${rows.length === 1 ? "" : "s"}.`, data };
    },
  }),

  defineTool({
    name: "get_initiative",
    title: "Get an initiative",
    description:
      "One strategic initiative in full: charter, status, progress, milestones, action items and dependencies, ELT asks, measures with recent readings, and its latest monthly updates. Item ids here are what the other initiative tools take.",
    access: "read",
    input: z.object({ initiative: initiativeRef }),
    run: async (actor, { initiative: ref }) => {
      const found = await resolveInitiative(ref);
      if (!found) return NOT_FOUND(ref);
      const i = await prisma.initiative.findUnique({
        where: { id: found.id },
        include: {
          strategicArea: { select: { code: true, name: true } },
          milestones: { orderBy: [{ dueAt: "asc" }, { order: "asc" }] },
          actionItems: { orderBy: [{ dueAt: "asc" }, { order: "asc" }] },
          eltRequests: { orderBy: { order: "asc" } },
          measures: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], include: { readings: { orderBy: { asOf: "desc" }, take: 6 } } },
          updates: { orderBy: { createdAt: "desc" }, take: 3 },
        },
      });
      if (!i) return NOT_FOUND(ref);
      const primary = primaryKpi(i.measures);
      const data = {
        id: i.id,
        code: i.code,
        name: i.name,
        pillar: i.strategicArea ? { code: i.strategicArea.code, name: i.strategicArea.name } : null,
        valueType: i.valueType,
        status: i.status,
        pctComplete: Math.round(i.pctComplete * 1000) / 10,
        progress: { actual: i.progressActual, target: i.progressTarget },
        youLeadIt: initiativeOwnerMatches({ ownerUserId: i.ownerUserId, teamLead: i.teamLead }, actor),
        updatedAt: i.updatedAt.toISOString(),
        charter: {
          teamLead: i.teamLead,
          secondaryLead: i.secondaryLead,
          valueWhenComplete: i.valueWhenComplete,
          quantMetric: i.quantMetric,
          quantTarget: i.quantTarget,
          baseline: i.baseline,
          ebitdaValue: i.ebitdaValue,
          investmentCost: i.investmentCost,
        },
        milestones: i.milestones.map((m) => ({ id: m.id, title: m.title, owner: m.owner, due: isoDay(m.dueAt), done: Boolean(m.completedAt) })),
        actionItems: i.actionItems.map((a) => ({ id: a.id, kind: a.kind, title: a.title, owner: a.owner, due: isoDay(a.dueAt), byWhen: a.byWhen, done: a.status === "DONE" })),
        eltAsks: i.eltRequests.map((r) => ({ id: r.id, kind: r.kind, request: r.request, amount: r.amount === null ? null : Number(r.amount), status: r.status, decidedNote: r.decidedNote })),
        measures: i.measures.map((m) => ({
          id: m.id,
          name: m.name,
          kind: m.kind,
          unit: m.unit,
          baseline: m.baseline,
          target: m.target,
          drivesPercentComplete: primary?.id === m.id,
          recentReadings: m.readings.map((r) => ({ id: r.id, value: r.value, asOf: isoDay(r.asOf), note: r.note, enteredBy: r.enteredBy })),
        })),
        recentUpdates: i.updates.map((u) => ({ period: u.reportingPeriod, status: u.status, update: u.update, pathForward: u.pathForward, updatedBy: u.updatedBy, at: u.createdAt.toISOString() })),
      };
      return { text: `${i.code}: ${i.name}.`, data };
    },
  }),

  // --- The initiative -----------------------------------------------------
  defineTool({
    name: "create_initiative",
    title: "Create an initiative",
    description: "Add a strategic initiative to the active plan (admins). It starts with neutral scoring and no status. Add milestones, measures and so on afterwards.",
    access: "admin",
    input: z.object({
      code: z.string().min(1).max(40).describe('A unique code, e.g. "GROW-04". Stored upper case.'),
      pillar: z.string().optional().describe("The pillar's code or id in the active plan."),
      cimDriver: text(200).nullable().optional().describe("Broad CIM driver, for grouping."),
      ...charterShape,
      name: text(200).min(1),
    }),
    run: async (actor, { code, pillar, cimDriver, ...rest }) => {
      let strategicAreaId: string | null = null;
      if (pillar) {
        const area = await resolveArea(pillar);
        if (!area) return { text: `No pillar "${pillar}" in the active plan.`, isError: true };
        strategicAreaId = area.id;
      }
      const result = await edits.createInitiative(actor, { code, cimDriver, strategicAreaId, ...charterInput(rest) });
      return fromEdit(result, `Created ${code.toUpperCase()}.`, result.ok ? { id: result.id } : undefined);
    },
  }),

  defineTool({
    name: "update_initiative",
    title: "Edit an initiative's charter",
    description: "Change charter fields: name, leads, objective, KPI and target, baseline, EBITDA value and investment cost. Omit a field to keep it; null clears it. Status comes from monthly updates (add_si_update), not here.",
    access: "editor",
    input: z.object({ initiative: initiativeRef, ...charterShape }),
    run: async (actor, { initiative, ...rest }) =>
      onInitiative(initiative, async (id) => fromEdit(await edits.updateInitiativeCharter(actor, id, charterInput(rest)), `Saved ${initiative}.`)),
  }),

  defineTool({
    name: "update_initiative_progress",
    title: "Set value created",
    description: "Set the dollars of value created so far and the value to create. Percent complete follows them (or the primary KPI when either is blank). Accepts numbers or text like \"$1.5M\".",
    access: "editor",
    input: z.object({ initiative: initiativeRef, actual: amount.nullable(), target: amount.nullable() }),
    run: async (actor, { initiative, actual, target }) => {
      const a = dollars(actual);
      const t = dollars(target);
      if (a === undefined || t === undefined) return { text: 'Give dollar amounts as numbers or text like "$1.5M".', isError: true };
      return onInitiative(initiative, async (id) => fromEdit(await edits.updateInitiativeProgress(actor, id, { actual: a, target: t }), `Saved progress for ${initiative}.`));
    },
  }),

  // --- Milestones -----------------------------------------------------------
  defineTool({
    name: "add_milestone",
    title: "Add a milestone",
    description: "Add a dated milestone to an initiative.",
    access: "editor",
    input: z.object({ initiative: initiativeRef, title: text(300).min(1), owner: text(200).nullable().optional(), due: day.describe("Due day, YYYY-MM-DD.") }),
    run: async (actor, { initiative, title, owner, due }) =>
      onInitiative(initiative, async (id) => {
        const result = await edits.addMilestone(actor, id, { title, owner, dueAt: due });
        return fromEdit(result, `Added milestone "${title}".`, result.ok ? { id: result.id } : undefined);
      }),
  }),

  defineTool({
    name: "update_milestone",
    title: "Edit a milestone",
    description: "Change a milestone's title, owner or due day. Omit a field to keep it; null clears owner or due.",
    access: "editor",
    input: z.object({ milestone: itemId("milestone"), title: text(300).min(1).optional(), owner: text(200).nullable().optional(), due: day.describe("Due day, YYYY-MM-DD.") }),
    run: async (actor, { milestone, title, owner, due }) => fromEdit(await edits.updateMilestone(actor, milestone, { title, owner, dueAt: due }), "Milestone saved."),
  }),

  defineTool({
    name: "set_milestone_done",
    title: "Complete a milestone",
    description: "Mark a milestone done, or reopen it. Editors, the milestone's owner and the SI's lead can.",
    access: "owner",
    input: z.object({ milestone: itemId("milestone"), done: z.boolean() }),
    run: async (actor, { milestone, done }) => fromEdit(await edits.setMilestoneDone(actor, milestone, done), done ? "Milestone marked done." : "Milestone reopened."),
  }),

  defineTool({
    name: "remove_milestone",
    title: "Remove a milestone",
    description: "Delete a milestone from an initiative.",
    access: "editor",
    destructive: true,
    input: z.object({ milestone: itemId("milestone") }),
    run: async (actor, { milestone }) => fromEdit(await edits.removeMilestone(actor, milestone), "Milestone removed."),
  }),

  // --- Action items ---------------------------------------------------------
  defineTool({
    name: "add_action_item",
    title: "Add an action item",
    description: 'Add an action, or a dependency (something the SI needs from someone), with an owner and an optional due day. kind is "ACTION" (default) or "DEPENDENCY".',
    access: "editor",
    input: z.object({
      initiative: initiativeRef,
      title: text(300).min(1),
      owner: text(200).min(1),
      kind: z.enum(edits.ACTION_KINDS).optional(),
      due: day.describe("Due day, YYYY-MM-DD."),
    }),
    run: async (actor, { initiative, title, owner, kind, due }) =>
      onInitiative(initiative, async (id) => {
        const result = await edits.addActionItem(actor, id, { title, owner, kind, dueAt: due });
        return fromEdit(result, `Added "${title}".`, result.ok ? { id: result.id } : undefined);
      }),
  }),

  defineTool({
    name: "set_action_item_done",
    title: "Complete an action item",
    description: "Mark an action item or dependency done, or reopen it. Editors, the item's owner and the SI's lead can.",
    access: "owner",
    input: z.object({ actionItem: itemId("action item"), done: z.boolean() }),
    run: async (actor, { actionItem, done }) => fromEdit(await edits.setActionItemDone(actor, actionItem, done), done ? "Marked done." : "Reopened."),
  }),

  defineTool({
    name: "remove_action_item",
    title: "Remove an action item",
    description: "Delete an action item or dependency.",
    access: "editor",
    destructive: true,
    input: z.object({ actionItem: itemId("action item") }),
    run: async (actor, { actionItem }) => fromEdit(await edits.removeActionItem(actor, actionItem), "Action item removed."),
  }),

  // --- ELT asks ---------------------------------------------------------------
  defineTool({
    name: "add_elt_ask",
    title: "Add an ELT ask",
    description: 'Raise a request to the ELT: "SUPPORT" (default) or "INVESTMENT" with a dollar amount.',
    access: "editor",
    input: z.object({ initiative: initiativeRef, request: text(2000).min(1), kind: z.enum(edits.ELT_KINDS).optional(), amount: amount.nullable().optional() }),
    run: async (actor, { initiative, request, kind, amount: raw }) => {
      const a = dollars(raw);
      if (a === undefined) return { text: 'Give the amount as a number or text like "$250K".', isError: true };
      return onInitiative(initiative, async (id) => {
        const result = await edits.addEltRequest(actor, id, { request, kind, amount: a });
        return fromEdit(result, "ELT ask added.", result.ok ? { id: result.id } : undefined);
      });
    },
  }),

  defineTool({
    name: "update_elt_ask",
    title: "Record an ELT decision",
    description: "Set an ELT ask's status (REQUESTED, APPROVED, DECLINED) and/or the decision note. Omit a field to keep it.",
    access: "editor",
    input: z.object({ eltAsk: itemId("ELT ask"), status: z.enum(edits.ELT_STATUSES).optional(), decidedNote: text(2000).nullable().optional() }),
    run: async (actor, { eltAsk, status, decidedNote }) => fromEdit(await edits.updateEltRequest(actor, eltAsk, { status, decidedNote }), "ELT ask saved."),
  }),

  defineTool({
    name: "remove_elt_ask",
    title: "Remove an ELT ask",
    description: "Delete an ELT ask.",
    access: "editor",
    destructive: true,
    input: z.object({ eltAsk: itemId("ELT ask") }),
    run: async (actor, { eltAsk }) => fromEdit(await edits.removeEltRequest(actor, eltAsk), "ELT ask removed."),
  }),

  // --- Measures ---------------------------------------------------------------
  defineTool({
    name: "add_measure",
    title: "Add a measure",
    description:
      'Add a KPI or leading measure to an initiative, with optional baseline and target (numbers, or text like "12.5%" or "$1.5M"). A value initiative\'s percent complete follows its primary KPI. Editors and the SI\'s lead can.',
    access: "owner",
    input: z.object({
      initiative: initiativeRef,
      name: text(200).min(1),
      kind: z.enum(MEASURE_KINDS).optional(),
      unit: z.enum(MEASURE_UNITS).optional(),
      baseline: amount.nullable().optional(),
      target: amount.nullable().optional(),
    }),
    run: async (actor, { initiative, ...input }) =>
      onInitiative(initiative, async (id) => {
        const result = await edits.addMeasure(actor, id, input);
        return fromEdit(result, `Added measure "${input.name}".`, result.ok ? { id: result.id } : undefined);
      }),
  }),

  defineTool({
    name: "update_measure",
    title: "Edit a measure",
    description: "Change a measure's name, kind, unit, baseline or target. Omit a field to keep it; null clears baseline or target. Editors and the SI's lead can.",
    access: "owner",
    input: z.object({
      measure: itemId("measure"),
      name: text(200).min(1).optional(),
      kind: z.enum(MEASURE_KINDS).optional(),
      unit: z.enum(MEASURE_UNITS).optional(),
      baseline: amount.nullable().optional(),
      target: amount.nullable().optional(),
    }),
    run: async (actor, { measure, ...input }) => fromEdit(await edits.updateMeasure(actor, measure, input), "Measure saved."),
  }),

  defineTool({
    name: "set_primary_measure",
    title: "Make a KPI primary",
    description: "Make a KPI the one the initiative's percent complete follows. Editors and the SI's lead can.",
    access: "owner",
    input: z.object({ measure: itemId("measure") }),
    run: async (actor, { measure }) => fromEdit(await edits.setPrimaryMeasure(actor, measure), "Percent complete now follows this KPI."),
  }),

  defineTool({
    name: "remove_measure",
    title: "Remove a measure",
    description: "Delete a measure and all its readings. Editors and the SI's lead can.",
    access: "owner",
    destructive: true,
    input: z.object({ measure: itemId("measure") }),
    run: async (actor, { measure }) => fromEdit(await edits.removeMeasure(actor, measure), "Measure removed."),
  }),

  defineTool({
    name: "add_measure_reading",
    title: "Log a measure value",
    description: 'Record a measure\'s latest value (a number, or text like "12.5%" or "$1.5M"), as of a day (default today; not in the future), with an optional note. Editors and the SI\'s lead can.',
    access: "owner",
    input: z.object({ measure: itemId("measure"), value: amount, asOf: day.describe("As-of day, YYYY-MM-DD. Defaults to today."), note: text(2000).nullable().optional() }),
    run: async (actor, { measure, value, asOf, note }) => {
      const result = await edits.addMeasureReading(actor, measure, { value, asOf, note });
      return fromEdit(result, "Value logged.", result.ok ? { id: result.id } : undefined);
    },
  }),

  defineTool({
    name: "remove_measure_reading",
    title: "Remove a measure value",
    description: "Delete one logged value of a measure. Editors and the SI's lead can.",
    access: "owner",
    destructive: true,
    input: z.object({ reading: itemId("reading") }),
    run: async (actor, { reading }) => fromEdit(await edits.removeMeasureReading(actor, reading), "Value removed."),
  }),
];
