import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  bridgeFromForm,
  cimKpiMap,
  codeList,
  formatPillarItems,
  parseEbitdaBuild,
  parsePillarItems,
  parsePillars,
} from "./strategy-reference";

// The backfill migration is what production renders from, so read its JSON.
const migration = readFileSync(
  path.join(__dirname, "../../prisma/migrations", readdirSync(path.join(__dirname, "../../prisma/migrations")).find((d) => d.endsWith("_strategy_reference"))!, "migration.sql"),
  "utf8",
);
const backfilled = (key: string) => migration.match(new RegExp(`'${key}', \\$json\\$(.*?)\\$json\\$`))![1];

describe("parseEbitdaBuild", () => {
  it("derives lender and valuation EBITDA from the backfilled bridge", () => {
    const b = parseEbitdaBuild(backfilled("ebitda_build"))!;
    expect(b).toMatchObject({ asOf: "May 2026", target2026: 126, target2027: 150, ytdGrowth: 24.9, valuation: 101.1, lender: 111.3 });
    expect(b.bridge).toHaveLength(7);
  });

  it("reads the flag shape the old scoreboard editor saved", () => {
    const old = JSON.stringify({
      asOf: "Apr 2026", lender: 1, valuation: 1, target2026: 126, target2027: 150, ytdGrowth: 20,
      bridge: [{ label: "Base", value: 10 }, { label: "Sub", value: 0, subtotal: true }, { label: "Add", value: 2.5 }, { label: "Total", value: 0, total: true }],
    });
    expect(parseEbitdaBuild(old)).toMatchObject({ valuation: 10, lender: 12.5 });
  });

  it("is null when nothing usable is stored", () => {
    expect(parseEbitdaBuild(undefined)).toBeNull();
    expect(parseEbitdaBuild("not json")).toBeNull();
  });

  it("leaves headline figures empty without subtotal and total rows", () => {
    expect(parseEbitdaBuild(JSON.stringify({ bridge: [{ label: "Base", value: 5 }] }))).toMatchObject({ lender: null, valuation: null, target2026: null });
  });
});

describe("bridgeFromForm", () => {
  it("drops blank rows and zeroes subtotal/total values", () => {
    expect(bridgeFromForm(["Base", "", "Total"], ["76.5", "3", "999"], ["component", "component", "total"])).toEqual([
      { label: "Base", value: 76.5, kind: "component" },
      { label: "Total", value: 0, kind: "total" },
    ]);
  });
});

describe("pillars", () => {
  it("parses the backfilled pillars with positional ids", () => {
    const ps = parsePillars(backfilled("pillars_2026"));
    expect(ps.map((p) => [p.id, p.items.length])).toEqual([["P1", 7], ["P2", 4], ["P3", 4]]);
    expect(ps[1].items[2]).toEqual({ id: "P2-3", name: "AI", desc: "Surfaces insights, automates workflows, answers questions", cim: ["CIM-16", "CIM-14"], sis: ["TEC-02", "BRD-02"] });
  });

  it("round-trips items through the editor's line format", () => {
    const items = parsePillars(backfilled("pillars_2026"))[0].items.map(({ name, desc, cim, sis }) => ({ name, desc, cim, sis }));
    expect(parsePillarItems(formatPillarItems(items))).toEqual(items);
  });

  it("reads short lines and normalises codes", () => {
    expect(parsePillarItems("Speed Wins | Rapid response | | svc-02\n\n  \nSimplicity")).toEqual([
      { name: "Speed Wins", desc: "Rapid response", cim: [], sis: ["SVC-02"] },
      { name: "Simplicity", desc: "", cim: [], sis: [] },
    ]);
  });
});

describe("codeList", () => {
  it("splits on commas and spaces and dedupes", () => {
    expect(codeList("cim-04, CIM-05 CIM-04")).toEqual(["CIM-04", "CIM-05"]);
  });
});

describe("cimKpiMap", () => {
  it("groups goal labels by CIM code", () => {
    expect(
      cimKpiMap([
        { name: "Acquired EBITDA", goal: "$27.5M", cim: ["CIM-04", "CIM-05"] },
        { name: "Margin of Safety", goal: "25%", cim: ["CIM-04"] },
        { name: "Guest CSAT", goal: "", cim: [] },
      ]),
    ).toEqual({ "CIM-04": ["Acquired EBITDA → $27.5M", "Margin of Safety → 25%"], "CIM-05": ["Acquired EBITDA → $27.5M"] });
  });
});
