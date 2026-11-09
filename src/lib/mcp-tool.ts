import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActivePlan } from "@/lib/active-plan";
import { PERIOD_PATTERN, shortCode } from "@/lib/review-model";
import type { McpActor } from "@/lib/mcp-auth";

// Shared pieces for the MCP tools in lib/mcp.ts and lib/mcp-initiative-tools.ts.

/**
 * Who sees and can call a tool: read: anyone; owner: editors, admins and the
 * people the edit itself allows (an SI's lead, an item's owner); editor:
 * editors and admins; admin: admins. The edit functions check again.
 */
export type Access = "read" | "owner" | "editor" | "admin";

export type ToolOutput = { text: string; data?: unknown; isError?: boolean };

export type Tool<S extends z.ZodObject = z.ZodObject> = {
  name: string;
  title: string;
  description: string;
  access: Access;
  /** Removes something (shown to clients as destructive). */
  destructive?: boolean;
  input: S;
  run: (actor: McpActor, args: z.infer<S>) => Promise<ToolOutput>;
};

export const defineTool = <S extends z.ZodObject>(tool: Tool<S>) => tool as unknown as Tool;

export const period = z.string().regex(PERIOD_PATTERN, "Use a month written YYYY-MM.").describe("Review month, YYYY-MM.");
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a day written YYYY-MM-DD.")
  .nullable()
  .optional();

export function fromEdit(result: { ok: true } | { ok: false; error: string }, done: string, data?: unknown): ToolOutput {
  return result.ok ? { text: done, data } : { text: result.error, isError: true };
}

export const norm = (s: string) => s.trim().toLowerCase();

/** A StrategicArea of the active plan by id, code or short code. */
export async function resolveArea(ref: string): Promise<{ id: string; code: string } | null> {
  const plan = await getActivePlan();
  if (!plan) return null;
  const areas = await prisma.strategicArea.findMany({ where: { planVersionId: plan.id }, select: { id: true, code: true } });
  const key = norm(ref);
  return areas.find((a) => a.id === ref) ?? areas.find((a) => norm(a.code) === key || norm(shortCode(a.code)) === key) ?? null;
}

/** An initiative by id, or by code within the active plan. */
export async function resolveInitiative(ref: string): Promise<{ id: string } | null> {
  const plan = await getActivePlan();
  return prisma.initiative.findFirst({
    where: { OR: [{ id: ref }, { code: { equals: ref.trim(), mode: "insensitive" }, ...(plan ? { planVersionId: plan.id } : {}) }] },
    select: { id: true },
  });
}
