import { describe, expect, it } from "vitest";
import { diffRows, parseDependencyRows, parseMilestoneRows, parseRiskRows, readDue, splitByWhen } from "./charter-rows";

const day = (s: string | null | undefined) => readDue(s)?.date.toISOString().slice(0, 10) ?? null;

describe("readDue", () => {
  it("reads exact days in the formats the deck uses", () => {
    for (const [input, expected] of [
      ["2026-10-30", "2026-10-30"],
      ["30 Oct 2026", "2026-10-30"],
      ["28 February 2027", "2027-02-28"],
      ["Nov 27, 2026", "2026-11-27"],
      ["Jun 30 2027", "2027-06-30"],
      ["12/31/26", "2026-12-31"],
      ["11/9/2026", "2026-11-09"],
    ]) {
      expect(day(input)).toBe(expected);
      expect(readDue(input)?.exact).toBe(true);
    }
  });

  it("resolves months, quarters and ranges to their last day, as not exact", () => {
    for (const [input, expected] of [
      ["Oct 2026", "2026-10-31"],
      ["February 2027", "2027-02-28"],
      ["Q1 2027", "2027-03-31"],
      ["2027-Q3", "2027-09-30"],
      ["Q1 '27", "2027-03-31"],
      ["Oct/Nov 2026", "2026-11-30"],
      ["Q2–Q3 2027", "2027-09-30"],
      ["Q4 2026–Q1 2027", "2027-03-31"],
    ]) {
      expect(day(input)).toBe(expected);
      expect(readDue(input)?.exact).toBe(false);
    }
  });

  it("treats a day with a note around it as not exact", () => {
    expect(readDue("Starts 11 Jan 2027")).toEqual({ date: new Date("2027-01-11T00:00:00Z"), exact: false });
    expect(readDue("11/9/2026 (First Round)")?.exact).toBe(false);
  });

  it("returns null for text that isn't a date", () => {
    for (const input of ["TBD", "In progress", "Ongoing", "Bi-annually", "[date]", "", null, undefined]) {
      expect(readDue(input)).toBeNull();
    }
  });
});

describe("splitByWhen", () => {
  it("keeps the text unless it is an exact day", () => {
    expect(splitByWhen("15 Oct 2026")).toEqual({ dueAt: new Date("2026-10-15T00:00:00Z"), byWhen: null });
    expect(splitByWhen("Q1 2027")).toEqual({ dueAt: new Date("2027-03-31T00:00:00Z"), byWhen: "Q1 2027" });
    expect(splitByWhen("In progress")).toEqual({ dueAt: null, byWhen: "In progress" });
    expect(splitByWhen("  ")).toEqual({ dueAt: null, byWhen: null });
  });
});

describe("row parsing", () => {
  it("drops rows without their key field and malformed input", () => {
    expect(parseRiskRows(JSON.stringify([{ risk: " Slip ", mitigation: "Buffer", owner: "Ann" }, { risk: "", mitigation: "x" }]))).toEqual([
      { id: undefined, risk: "Slip", mitigation: "Buffer", owner: "Ann" },
    ]);
    expect(parseRiskRows("not json")).toEqual([]);
    expect(parseRiskRows(JSON.stringify({ risk: "x" }))).toEqual([]);
    expect(parseRiskRows(null)).toEqual([]);
  });

  it("only accepts id-shaped ids and ISO due dates", () => {
    expect(parseDependencyRows(JSON.stringify([{ id: "'; drop", need: "Data", fromWhom: 3, byWhen: "Q1 2027" }]))).toEqual([
      { id: undefined, need: "Data", fromWhom: "", byWhen: "Q1 2027" },
    ]);
    expect(parseMilestoneRows(JSON.stringify([{ id: "cmvkclbec000cqvpwue1t4onq", title: "Go live", dueAt: "Oct 2026" }]))).toEqual([
      { id: "cmvkclbec000cqvpwue1t4onq", title: "Go live", owner: "", dueAt: "" },
    ]);
  });
});

describe("diffRows", () => {
  it("updates known ids, creates new or foreign ones, and removes the rest", () => {
    const posted = [{ id: "a1" }, { id: undefined }, { id: "zz" }];
    const { create, update, remove } = diffRows(posted, ["a1", "b2"]);
    expect(update).toEqual([{ id: "a1" }]);
    expect(create).toEqual([{ id: undefined }, { id: "zz" }]);
    expect(remove).toEqual(["b2"]);
  });
});
