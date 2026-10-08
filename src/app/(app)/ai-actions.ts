"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { complete, HOUSE_STYLE, aiConfigured } from "@/lib/ai";
import { siHealth, HEALTH_META } from "@/lib/initiatives";
import { EBITDA_BUILD } from "@/lib/sources";
import { getEbitdaBuild, getScorecardGoals, getPillars } from "@/lib/overview-data";
import { rateLimit } from "@/lib/rate-limit";

const r1 = (n: number) => Math.round(n * 10) / 10;

export type AiResult = { ok: true; text: string } | { ok: false; error: string };

function fail(e: unknown): AiResult {
  // Log the real error server-side; never return internals to the client.
  console.error("[ai-actions]", e);
  return { ok: false, error: "Something went wrong calling the model. Please try again." };
}

// Per-user cap so a logged-in user can't run up Anthropic cost.
const AI_MAX_PER_HOUR = 40;
async function aiThrottle(userId: string): Promise<AiResult | null> {
  const rl = await rateLimit(`ai:${userId}`, AI_MAX_PER_HOUR, 60 * 60 * 1000);
  if (rl.allowed) return null;
  return { ok: false, error: `AI usage limit reached. Try again in about ${Math.ceil(rl.retryAfterSec / 60)} minutes.` };
}

const CHARTER_TASKS: Record<string, string> = {
  problem:
    "Refine the PROBLEM STATEMENT into 1-2 sharp sentences: what is broken, for whom, and what it costs Awayday. Return only the rewritten statement.",
  objective:
    "Sharpen the OBJECTIVE into one measurable sentence that is clearly done or not done at closeout. Return only the sentence.",
  deliverables:
    "Propose 3-5 concrete DELIVERABLES (the tangible outputs this initiative ships). Return a short bulleted list.",
  scope:
    "List the top SCOPE-CREEP RISKS for this initiative: adjacent work that should be explicitly kept out of scope. Return a short bulleted list.",
  plan:
    "Draft a HIGH-LEVEL PLAN of 3-5 milestones with the partners or functions each needs. Return a short numbered list.",
  example:
    "Describe one concrete EXAMPLE END PRODUCT for this initiative so the team knows what 'done' looks like. Return 2-3 sentences.",
};

export async function assistCharter(initiativeId: string, kind: string): Promise<AiResult> {
  try {
    const session = await requireSession();
    if (!aiConfigured()) return { ok: false, error: "AI is not configured yet. Add an ANTHROPIC_API_KEY to enable Claude assists." };
    const throttled = await aiThrottle(session.user.id);
    if (throttled) return throttled;
    const task = CHARTER_TASKS[kind];
    if (!task) return { ok: false, error: "Unknown assist." };
    const i = await prisma.initiative.findUnique({ where: { id: initiativeId } });
    if (!i) return { ok: false, error: "Initiative not found." };

    const context = [
      `Initiative: ${i.code} - ${i.name}`,
      i.cimDriver && `CIM driver: ${i.cimDriver}`,
      i.teamLead && `Lead: ${i.teamLead}`,
      i.secondaryLead && `Secondary lead: ${i.secondaryLead}`,
      `Value ${i.value}/5, Lift ${i.lift}/5`,
      i.progressTarget && `Targeted value: $${i.progressTarget}`,
      i.problem && `Current problem statement: ${i.problem}`,
      i.valueWhenComplete && `Current objective: ${i.valueWhenComplete}`,
      i.workRequired && `Current deliverables: ${i.workRequired}`,
      (i.quantMetric || i.quantTarget) && `KPI: ${i.quantMetric ?? ""} ${i.quantTarget ? `-> ${i.quantTarget}` : ""}`,
    ]
      .filter(Boolean)
      .join("\n");

    const text = await complete({
      system: HOUSE_STYLE,
      user: `${task}\n\nContext for this initiative:\n${context}`,
      maxTokens: 450,
      context: { module: "INITIATIVES", feature: "charter-assist", userId: session.user.id },
    });
    return { ok: true, text };
  } catch (e) {
    return fail(e);
  }
}

export async function draftFromName(name: string, cim: string): Promise<AiResult> {
  try {
    const session = await requireSession();
    if (!aiConfigured()) return { ok: false, error: "AI is not configured yet. Add an ANTHROPIC_API_KEY to enable Claude assists." };
    const throttled = await aiThrottle(session.user.id);
    if (throttled) return throttled;
    if (!name.trim()) return { ok: false, error: "Enter an initiative name first." };

    const text = await complete({
      system: HOUSE_STYLE,
      user:
        `Draft a starter charter for a new strategic initiative named "${name}"` +
        (cim ? ` under the CIM driver "${cim}".` : ".") +
        ` Respond with STRICT JSON only, no prose, in this exact shape:\n` +
        `{"problem":"...","objective":"...","deliverables":"...","kpi":"..."}\n` +
        `problem = 1-2 sentences. objective = one measurable sentence. ` +
        `deliverables = a short comma or newline separated list. kpi = "Metric -> target".`,
      maxTokens: 600,
      context: { module: "INITIATIVES", feature: "draft-from-name", userId: session.user.id },
    });
    return { ok: true, text };
  } catch (e) {
    return fail(e);
  }
}

export async function askBoard(question: string): Promise<AiResult> {
  try {
    const session = await requireSession();
    if (!aiConfigured()) return { ok: false, error: "AI is not configured yet. Add an ANTHROPIC_API_KEY to enable the board narrative." };
    const throttled = await aiThrottle(session.user.id);
    if (throttled) return throttled;
    if (!question.trim()) return { ok: false, error: "Ask a question first." };

    const [initiatives, risks] = await Promise.all([
      prisma.initiative.findMany(),
      prisma.cimRisk.findMany({ include: { initiatives: true } }),
    ]);
    const now = new Date();
    const counts = { total: initiatives.length, done: 0, behind: 0, atRisk: 0 };
    const behindList: string[] = [];
    for (const i of initiatives) {
      const h = siHealth(i.status, i.pctComplete, i.startDate, i.endDate, now);
      if (h === "complete") counts.done++;
      if (h === "behind") counts.behind++;
      if (h === "at-risk") { counts.atRisk++; behindList.push(`${i.code} ${i.name} (${HEALTH_META[h].label}, ${Math.round(i.pctComplete * 100)}%)`); }
    }
    const criticalRisks = risks.filter((r) => r.critical).map((r) => `${r.code} ${r.risk}`);

    const context = [
      `EBITDA: lender-defined $${EBITDA_BUILD.lender}M, valuation-basis $${EBITDA_BUILD.valuation}M; 2026 target $${EBITDA_BUILD.target2026}M, 2027 exit target $${EBITDA_BUILD.target2027}M; +$${EBITDA_BUILD.ytdGrowth}M YTD.`,
      `Initiatives: ${counts.total} total, ${counts.done} complete, ${counts.behind} behind pace, ${counts.atRisk} at risk.`,
      behindList.length ? `At-risk initiatives: ${behindList.slice(0, 12).join("; ")}.` : "",
      criticalRisks.length ? `Critical CIM risks: ${criticalRisks.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const text = await complete({
      system:
        HOUSE_STYLE +
        " Answer the leadership question using ONLY the portfolio snapshot provided. " +
        "If the snapshot does not contain the answer, say so plainly. Keep it tight and board-ready.",
      user: `Portfolio snapshot:\n${context}\n\nLeadership question: ${question}`,
      maxTokens: 700,
      context: { module: "INITIATIVES", feature: "ask-board", userId: session.user.id },
    });
    return { ok: true, text };
  } catch (e) {
    return fail(e);
  }
}

// One-click board-ready written update. Assembles a DETERMINISTIC snapshot of the
// live portfolio (real EBITDA figures, pillar progress, RED KPIs, and dollars
// exposed per CIM risk) and has Claude narrate it. The model is told to use only
// these numbers and invent nothing, so the figures stay board-grade while the
// prose is generated. The user reviews/edits before it ships.
export async function generateBoardNarrative(): Promise<AiResult> {
  try {
    const session = await requireSession();
    if (!aiConfigured()) return { ok: false, error: "AI is not configured yet. Add an ANTHROPIC_API_KEY to enable the board narrative." };
    const throttled = await aiThrottle(session.user.id);
    if (throttled) return throttled;

    const [initiatives, risks, ebitda, goals, pillars] = await Promise.all([
      prisma.initiative.findMany(),
      prisma.cimRisk.findMany({ include: { initiatives: { include: { initiative: true } } } }),
      getEbitdaBuild(),
      getScorecardGoals(),
      getPillars(),
    ]);
    const now = new Date();

    const gap2026 = r1(ebitda.target2026 - ebitda.lender);
    const gap2027 = r1(ebitda.target2027 - ebitda.lender);

    // code -> progress (DONE counts as 1) for pillar/SI rollups.
    const siPct = new Map(initiatives.map((i) => [i.code, i.status === "DONE" ? 1 : i.pctComplete]));
    const counts = { total: initiatives.length, done: 0, behind: 0, atRisk: 0 };
    const behindList: string[] = [];
    for (const i of initiatives) {
      const h = siHealth(i.status, i.pctComplete, i.startDate, i.endDate, now);
      if (h === "complete") counts.done++;
      else if (h === "behind") counts.behind++;
      else if (h === "at-risk") counts.atRisk++;
      if ((h === "behind" || h === "at-risk") && i.valueType === "VALUE") {
        const dollars = i.progressTarget ? `, $${Math.round(i.progressTarget).toLocaleString("en-US")} targeted` : "";
        const lead = i.teamLead ? `, ${i.teamLead}` : "";
        behindList.push(`${i.code} ${i.name} (${Math.round(i.pctComplete * 100)}%${dollars}${lead})`);
      }
    }

    const pillarLines = pillars.map((p) => {
      const itemAvgs = p.items
        .map((it) => {
          const known = it.sis.map((c) => siPct.get(c)).filter((v): v is number => v !== undefined);
          return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
        })
        .filter((v): v is number => v !== null);
      const prog = itemAvgs.length ? Math.round((itemAvgs.reduce((a, b) => a + b, 0) / itemAvgs.length) * 100) : null;
      return `${p.name}: ${prog === null ? "n/a" : `${prog}%`} overall`;
    });

    const riskRows = risks
      .map((r) => {
        const linked = r.initiatives.map((ri) => ri.initiative);
        const cov = linked.length ? linked.reduce((a, i) => a + (i.status === "DONE" ? 1 : i.pctComplete), 0) / linked.length : 0;
        const exposed = r.prizeNum != null ? r1(r.prizeNum * (1 - cov)) : null;
        return { code: r.code, risk: r.risk, owner: r.owner, critical: r.critical, prize: r.prize, cov: Math.round(cov * 100), exposed };
      })
      .sort((a, b) => (b.exposed ?? 0) - (a.exposed ?? 0));
    const totalExposed = r1(riskRows.reduce((a, r) => a + (r.exposed ?? 0), 0));
    const topRisks = riskRows
      .slice(0, 8)
      .map((r) => `${r.code} ${r.risk}${r.critical ? " [critical]" : ""}: ${r.cov}% covered, prize ${r.prize ?? "n/a"}${r.exposed != null ? `, ~$${r.exposed}M exposed` : ""}${r.owner ? `, owner ${r.owner}` : ""}`);

    const redGoals = goals.filter((g) => g.color === "red").map((g) => `${g.name}: target ${g.goal || "n/a"}, latest ${g.ltm || "n/a"} (${g.status || "off plan"})`);

    const snapshot = [
      `As of: ${ebitda.asOf}. Hard goal: $${ebitda.target2027}M lender EBITDA by 12/31/2027.`,
      `EBITDA: lender $${ebitda.lender}M, valuation $${ebitda.valuation}M, +$${ebitda.ytdGrowth}M YTD. Gap to 2026 target ($${ebitda.target2026}M): $${gap2026}M. Gap to 2027 exit ($${ebitda.target2027}M): $${gap2027}M.`,
      `Initiatives: ${counts.total} total, ${counts.done} complete, ${counts.behind} behind pace, ${counts.atRisk} at risk.`,
      behindList.length ? `Behind/at-risk value initiatives: ${behindList.slice(0, 12).join("; ")}.` : "",
      `2026 goal pillars: ${pillarLines.join("; ")}.`,
      redGoals.length ? `RED financial/operating KPIs: ${redGoals.join("; ")}.` : "",
      `CIM risk exposure: ~$${totalExposed}M total exposed (prize x uncovered share). Top: ${topRisks.join("; ")}.`,
    ]
      .filter(Boolean)
      .join("\n");

    const text = await complete({
      system: HOUSE_STYLE + " You are drafting a board update for a PE-backed operator's leadership team and its sponsor (Ares). Precise, sober, concrete.",
      user:
        `Write a board update from this live portfolio snapshot. Use ONLY these figures. Never invent numbers, names, or facts; cite the real numbers given. Output GitHub-flavored markdown with these "## " sections, in order:\n` +
        `## Executive summary — where Awayday stands against the $150M EBITDA exit by 12/31/2027 (lead with lender EBITDA, the gap, YTD growth, and overall portfolio health). One tight paragraph.\n` +
        `## 2026 goals — one short paragraph per pillar with its progress and the standout driver or blocker.\n` +
        `## Risk posture — the most under-covered and critical CIM risks, led by the largest dollars exposed.\n` +
        `## Decisions and asks — 2 to 4 specific decisions to put in front of the board, drawn from the behind-pace high-value work and the under-covered risks.\n\n` +
        `Keep it tight and board-grade: no hype, no filler.\n\nSnapshot:\n${snapshot}`,
      // Enough room to finish all four sections without truncating mid-decision.
      maxTokens: 3000,
      context: { module: "INITIATIVES", feature: "board-narrative", userId: session.user.id },
    });
    return { ok: true, text };
  } catch (e) {
    return fail(e);
  }
}
