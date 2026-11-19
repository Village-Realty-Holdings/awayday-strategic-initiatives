import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ambiguousMeasureNames, selectPrimaryMeasure } from "./primary-measure";

// A pillar's primary measure is configuration, not list position. These tests
// pin both halves: the resolver's behaviour, and the absence of the old
// `kpis[0]` shortcut anywhere in application source.

type Candidate = { id: string; name: string; measureMapping?: { active: boolean } | null };

const kpi = (id: string, name: string, active?: boolean): Candidate => ({
  id,
  name,
  measureMapping: active === undefined ? null : { active },
});

/** Every permutation of a small array, so array position cannot decide anything. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  );
}

describe("selectPrimaryMeasure", () => {
  it("selects the KPI with the one active mapping", () => {
    const kpis = [kpi("k-ma", "Acquired EBITDA closed", true), kpi("k-support", "Pipeline coverage")];
    expect(selectPrimaryMeasure(kpis)).toEqual({ status: "selected", kpi: kpis[0] });
  });

  it("keeps additional KPIs as supporting measures", () => {
    const kpis = [
      kpi("k-primary", "BD unit adds", true),
      kpi("k-support-1", "Pipeline coverage"),
      kpi("k-support-2", "Sales cycle time", false),
    ];
    const selection = selectPrimaryMeasure(kpis);
    expect(selection.status).toBe("selected");
    expect(selection.status === "selected" && selection.kpi.id).toBe("k-primary");
  });

  it("does not change when a KPI is renamed", () => {
    const before = [kpi("k-primary", "Acquired EBITDA closed", true), kpi("k-support", "Deal count")];
    const renamed = [kpi("k-primary", "AAA renamed to sort first", true), kpi("k-support", "Deal count")];
    const selected = (kpis: Candidate[]) => {
      const selection = selectPrimaryMeasure(kpis);
      return selection.status === "selected" ? selection.kpi.id : selection.status;
    };
    expect(selected(before)).toBe("k-primary");
    expect(selected(renamed)).toBe("k-primary");
  });

  it("does not change when a new KPI is added", () => {
    const before = [kpi("k-primary", "Owner unit churn (TTM)", true)];
    const after = [kpi("k-new", "Aardvark metric"), ...before, kpi("k-support", "Retention saves")];
    const selection = selectPrimaryMeasure(after);
    expect(selection.status === "selected" && selection.kpi.id).toBe("k-primary");
  });

  it("does not depend on array order, which is what name ordering produced", () => {
    const kpis = [
      kpi("k-primary", "TRevPAR growth (YoY)", true),
      kpi("k-a", "ADR growth"),
      kpi("k-z", "Zebra throughput"),
    ];
    const ids = permutations(kpis).map((order) => {
      const selection = selectPrimaryMeasure(order);
      return selection.status === "selected" ? selection.kpi.id : selection.status;
    });
    expect(new Set(ids)).toEqual(new Set(["k-primary"]));
  });

  it("reports a missing primary rather than guessing", () => {
    expect(selectPrimaryMeasure([kpi("k1", "Gross unit adds"), kpi("k2", "Pipeline coverage")])).toEqual({ status: "missing" });
    expect(selectPrimaryMeasure([])).toEqual({ status: "missing" });
  });

  it("treats a switched-off mapping as no primary", () => {
    expect(selectPrimaryMeasure([kpi("k1", "Gross unit adds", false)])).toEqual({ status: "missing" });
  });

  it("reports ambiguity when two mappings both claim to be primary", () => {
    const kpis = [kpi("k-b", "Shop NOI margin vs PY", true), kpi("k-a", "Shop NOI", true), kpi("k-c", "Support")];
    const selection = selectPrimaryMeasure(kpis);
    expect(selection.status).toBe("ambiguous");
    if (selection.status === "ambiguous") {
      expect(ambiguousMeasureNames(selection)).toEqual(["Shop NOI", "Shop NOI margin vs PY"]);
    }
  });

  it("loses the primary when its KPI is deleted, even if supporting KPIs remain", () => {
    const before = selectPrimaryMeasure([kpi("k-primary", "Owner unit churn (TTM)", true), kpi("k-support", "Saves")]);
    expect(before.status === "selected" && before.kpi.id).toBe("k-primary");
    expect(selectPrimaryMeasure([kpi("k-support", "Saves")])).toEqual({ status: "missing" });
  });
});

// ---------------------------------------------------------------------------
// Source guard: the application must not reintroduce an implicit selector
// ---------------------------------------------------------------------------

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules") continue;
      sourceFiles(path, found);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

describe("primary-measure selection in application source", () => {
  const files = sourceFiles("src");
  const read = (file: string) => readFileSync(file, "utf8");

  // `measures.ts` is the initiative-measure model, not a pillar's KPI list: its
  // measures carry an explicit `order` column and are sorted by it. It is not
  // the selector this guard protects (see primaryKpi's own tests).
  const pillarSelectionFiles = files.filter((file) => !file.endsWith("src/lib/measures.ts"));

  it("never takes a pillar's measure from a list position", () => {
    const offenders = pillarSelectionFiles.filter((file) => /\bkpis\s*\[\s*0\s*\]/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it("keeps the initiative-measure exemption honest: that model sorts by its explicit order", () => {
    const measures = read("src/lib/measures.ts");
    expect(measures).toContain("a.order - b.order");
    expect(measures).not.toMatch(/name.*\.localeCompare|orderBy:\s*\{\s*name/);
  });

  it("never limits a pillar's KPIs to the first one in the query", () => {
    const offenders = files.filter((file) => /kpis:\s*\{[^\n]*take:\s*1/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it("selects the primary measure through the shared persisted-mapping rule", () => {
    for (const file of ["src/lib/review-data.ts", "src/lib/review-edits.ts"]) {
      expect(read(file)).toContain("selectPrimaryMeasure");
    }
  });
});
