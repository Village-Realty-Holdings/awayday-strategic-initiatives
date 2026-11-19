import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guard against business figures creeping into presentational code. The reviewed
// report's numbers belong in observations (and in the reference test fixtures);
// component and shaping modules must read them, never contain them.
//
// Scope: the presentation modules only, with comments stripped. The rules look
// for currency amounts, which is how a hardcoded financial figure actually
// appears. Percentages are deliberately not scanned: they are everywhere in
// styling and in UI examples ("e.g. 9.8%"), so a match there says nothing.

const FILES = [
  "src/components/review",
  "src/components/theme",
  "src/lib/review-format.ts",
  "src/lib/review-report.ts",
  "src/lib/review-report-data.ts",
  "src/lib/review-model.ts",
  "src/lib/review-kpi.ts",
  "src/lib/review-data.ts",
  "src/lib/kpi-status.ts",
  "src/lib/kpi-gauge.ts",
  "src/lib/theme.ts",
];

const root = process.cwd();

function sourceFiles(entryPath: string): string[] {
  const absolute = path.join(root, entryPath);
  if (/\.tsx?$/.test(absolute)) return [absolute];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(absolute);
  return out;
}

/** Remove block and line comments, so documentation may discuss figures freely. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/**
 * Lines that are UI guidance rather than data: a worked example in a hint or a
 * placeholder is copy, not a figure the app reports.
 */
function isUiExample(line: string): boolean {
  return /\be\.g\.|placeholder=|hint=/.test(line);
}

const files = FILES.flatMap(sourceFiles);

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  // "$1.2M", "−$3.8M": a currency amount with a scale suffix.
  { name: "currency amount with a scale", pattern: /[$]\s?\d[\d,]*(?:\.\d+)?\s?[MBK]\b/ },
  // "$1,868": a currency amount with thousands separators.
  { name: "currency amount with thousands separators", pattern: /[$]\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/ },
  // "$99.20": a currency amount with cents.
  { name: "currency amount with cents", pattern: /[$]\s?\d+\.\d{2}\b/ },
];

describe("no business figures in presentational code", () => {
  it("scans a meaningful set of files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(FORBIDDEN)("contains no $name", ({ pattern }) => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      source.split("\n").forEach((line, index) => {
        if (isUiExample(line)) return;
        if (pattern.test(line)) offenders.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("would catch a figure if one were reintroduced", () => {
    // The guard is only useful if the pattern fires; prove it on a sample line.
    const sample = "const value = \"$34.8M\";";
    expect(FORBIDDEN.some((rule) => rule.pattern.test(sample))).toBe(true);
  });
});
