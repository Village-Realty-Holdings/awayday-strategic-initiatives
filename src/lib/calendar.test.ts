import { describe, it, expect } from "vitest";
import { addDays, formatDisplay, formatFull, monthCells, toISO, toParts } from "@/lib/calendar";

// Pure date-grid math behind the shared DatePicker. These are local-calendar
// dates ("YYYY-MM-DD" as the user sees them), never UTC instants — the whole
// point is that picking Mar 8 gives you "2026-03-08" regardless of DST.

describe("toParts / toISO", () => {
  it("round-trips a date string", () => {
    expect(toParts("2026-07-27")).toEqual({ y: 2026, m: 6, d: 27 });
    expect(toISO(2026, 6, 27)).toBe("2026-07-27");
  });

  it("normalizes out-of-range days and months", () => {
    expect(toISO(2026, 0, 32)).toBe("2026-02-01");
    expect(toISO(2026, 12, 1)).toBe("2027-01-01");
    expect(toISO(2026, -1, 1)).toBe("2025-12-01");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toISO(2026, 0, 5)).toBe("2026-01-05");
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap and non-leap February", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
  });

  it("does not drift across a US DST transition", () => {
    // 2026-03-08 is the spring-forward date in the US.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("moves a full week for keyboard up/down", () => {
    expect(addDays("2026-07-27", 7)).toBe("2026-08-03");
    expect(addDays("2026-07-27", -7)).toBe("2026-07-20");
  });
});

describe("monthCells", () => {
  it("pads to whole weeks and covers every day of the month", () => {
    const cells = monthCells(2026, 6); // July 2026
    expect(cells.length % 7).toBe(0);
    const days = cells.filter(Boolean) as string[];
    expect(days.length).toBe(31);
    expect(days[0]).toBe("2026-07-01");
    expect(days[30]).toBe("2026-07-31");
  });

  it("leads with one null per weekday before the 1st", () => {
    // 2026-07-01 is a Wednesday -> 3 leading blanks (Su, Mo, Tu).
    const cells = monthCells(2026, 6);
    expect(cells.slice(0, 3).every((c) => c === null)).toBe(true);
    expect(cells[3]).toBe("2026-07-01");
  });

  it("handles a February that starts on Sunday with no leading pad", () => {
    // 2026-02-01 is a Sunday.
    const cells = monthCells(2026, 1);
    expect(cells[0]).toBe("2026-02-01");
    expect((cells.filter(Boolean) as string[]).length).toBe(28);
  });

  it("includes Feb 29 in a leap year", () => {
    const days = monthCells(2024, 1).filter(Boolean) as string[];
    expect(days.length).toBe(29);
    expect(days.at(-1)).toBe("2024-02-29");
  });
});

describe("formatting", () => {
  it("renders a short display label", () => {
    expect(formatDisplay("2026-07-27")).toBe("Jul 27, 2026");
  });

  it("renders a full accessible label", () => {
    expect(formatFull("2026-07-27")).toBe("Monday, July 27, 2026");
  });
});
