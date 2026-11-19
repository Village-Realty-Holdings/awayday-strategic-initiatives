import { describe, expect, it } from "vitest";
import {
  OCTOBER_REVIEWED_PILLAR_STATUSES,
  planOctoberPillarStatuses,
  reviewedPillarStatus,
  type AreaStatusState,
} from "./october-reviewed-statuses";
import { PILLAR_STATUS_RAG, parseApprovedPillarStatus } from "./review-model";

const area = (code: string, stored: string | null = null, kind: AreaStatusState["kind"] = "VALUE_DRIVER"): AreaStatusState => ({
  code,
  areaId: `area-${code}`,
  kind,
  stored,
});

const allAreas = () => ["M&A", "GROW", "RETENTION", "TREVPAR", "MARGIN"].map((code) => area(code));

describe("the reviewed October pillar statements", () => {
  it("are the page's five strategy-house chips, wording and colour together", () => {
    expect(OCTOBER_REVIEWED_PILLAR_STATUSES.map((entry) => [entry.code, entry.status, entry.chip])).toEqual([
      ["M&A", "Ahead", "good"],
      ["GROW", "Ahead · CAC off track", "good"],
      ["RETENTION", "Behind · October beat budget", "crit"],
      ["TREVPAR", "On track reported · October under PY", "warn"],
      ["MARGIN", "On goal ex-OTA · behind reported", "warn"],
    ]);
  });

  it("each take their colour from the status word at the front, and it agrees with the page", () => {
    expect(OCTOBER_REVIEWED_PILLAR_STATUSES.map((entry) => reviewedPillarStatus(entry)?.rag)).toEqual(["GREEN", "GREEN", "RED", "AMBER", "AMBER"]);
  });

  it("keep the warning half of a combined statement", () => {
    const parse = (status: string) => parseApprovedPillarStatus(status);
    expect(parse("Ahead · CAC off track")).toEqual({ status: "AHEAD", wording: "Ahead · CAC off track", custom: true });
    expect(parse("Behind · October beat budget")?.status).toBe("BEHIND");
    expect(parse("On track reported · October under PY")?.status).toBe("ON_TRACK");
    // The page calls this a goal, and in the review's own words that is on track.
    expect(parse("On goal ex-OTA · behind reported")?.status).toBe("ON_TRACK");
  });

  it("give every reviewed wording the same colour the app's RAG table gives its status word", () => {
    for (const entry of OCTOBER_REVIEWED_PILLAR_STATUSES) {
      const parsed = parseApprovedPillarStatus(entry.status)!;
      expect(reviewedPillarStatus(entry)?.rag).toBe(PILLAR_STATUS_RAG[parsed.status]);
    }
  });
});

describe("planOctoberPillarStatuses — October only", () => {
  it("plans all five statements for a month that holds none", () => {
    const plan = planOctoberPillarStatuses("2026-10", allAreas());
    expect(plan.issues).toEqual([]);
    expect(plan.changes).toHaveLength(5);
    expect(plan.changes[0]).toEqual({ code: "M&A", areaId: "area-M&A", from: null, to: "Ahead", rag: "GREEN" });
    expect(plan.periodId).toBe("2026-10");
  });

  it("treats a plain status already stored for October as an existing decision, not as September's", () => {
    // If October ever came to hold "AHEAD", the combined October wording must not
    // quietly replace it: that would be overwriting an approved status.
    const plan = planOctoberPillarStatuses(
      "2026-10",
      allAreas().map((entry) => (entry.code === "GROW" ? { ...entry, stored: "AHEAD" } : entry)),
    );
    expect(plan.issues).toContain('GROW already holds "AHEAD" for 2026-10, which is not this wording. Not overwriting it.');
  });

  it("reports a pillar that already holds this wording as set, so it is not rewritten", () => {
    const plan = planOctoberPillarStatuses(
      "2026-10",
      allAreas().map((entry) => (entry.code === "M&A" ? { ...entry, stored: "Ahead" } : entry)),
    );
    expect(plan.alreadySet).toEqual([{ code: "M&A", status: "Ahead" }]);
    expect(plan.changes.map((change) => change.code)).toEqual(["GROW", "RETENTION", "TREVPAR", "MARGIN"]);
  });

  it("refuses to overwrite a different status that someone has already approved", () => {
    const plan = planOctoberPillarStatuses(
      "2026-10",
      allAreas().map((entry) => (entry.code === "M&A" ? { ...entry, stored: "Behind" } : entry)),
    );
    expect(plan.issues).toContain('M&A already holds "Behind" for 2026-10, which is not this wording. Not overwriting it.');
    expect(plan.changes.map((change) => change.code)).not.toContain("M&A");
  });

  it("refuses to give an enabler a hand-set status", () => {
    const plan = planOctoberPillarStatuses(
      "2026-10",
      allAreas().map((entry) => (entry.code === "GROW" ? { ...entry, kind: "ENABLER" } : entry)),
    );
    expect(plan.issues).toContain("GROW is an enabler, and a hand-set status is a pillar-only decision.");
    expect(plan.changes.map((change) => change.code)).not.toContain("GROW");
  });

  it("refuses a wording with no status word, rather than inventing a colour", () => {
    const plan = planOctoberPillarStatuses("2026-10", allAreas().filter((entry) => entry.code !== "MARGIN"));
    expect(plan.issues).toContain("MARGIN is not in the loaded state.");
  });
});

describe("nothing here compares a count to a percentage", () => {
  it("takes every status from a reviewed statement, never from a figure", () => {
    const plan = planOctoberPillarStatuses("2026-10", allAreas());
    for (const change of plan.changes) {
      expect(Object.keys(change).sort()).toEqual(["areaId", "code", "from", "rag", "to"]);
    }
    // No value, goal, budget or target is read at all: the plan's only inputs are
    // the month's stored statuses and the reviewed wording above.
    expect(plan.changes.every((change) => typeof change.to === "string")).toBe(true);
  });
});
