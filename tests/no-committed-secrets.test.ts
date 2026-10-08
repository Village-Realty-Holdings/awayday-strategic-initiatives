import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guards the repo against live credentials in tracked files. On 2026-09-28 the
// production database password was found in a committed session note
// (re-fresh-execute-30-60-90.md, since August 4); it was rotated and the file
// removed. Anyone with repo access can read every tracked file, so a secret
// here is a secret shared with every collaborator.

const PATTERNS: { name: string; re: RegExp }[] = [
  // user:password@ in a Postgres URL. Placeholders (<...>, ${...}, ***, "password") are allowed.
  { name: "Postgres URL with a password", re: /postgres(?:ql)?:\/\/[^:\s/@'"`]+:(?![<$*]|password@|pass@|PASSWORD@)[^@\s'"`]{6,}@/ },
  { name: "Neon password", re: /\bnpg_[A-Za-z0-9]{12,}/ },
  { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Slack token", re: /\bxox[bpas]-[A-Za-z0-9-]{10,}/ },
  { name: "Vercel Blob token", re: /\bvercel_blob_rw_[A-Za-z0-9]{10,}/ },
  { name: "Private key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const MAX_BYTES = 2 * 1024 * 1024;

function trackedTextFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return out.split("\0").filter((f) => {
    if (!f) return false;
    try {
      const s = statSync(f);
      return s.isFile() && s.size <= MAX_BYTES;
    } catch {
      return false; // deleted in the working tree
    }
  });
}

describe("tracked files", () => {
  it("contain no live credentials", () => {
    const hits: string[] = [];
    for (const file of trackedTextFiles()) {
      const text = readFileSync(file, "utf8");
      if (text.includes("\0")) continue; // binary
      for (const { name, re } of PATTERNS) {
        if (re.test(text)) hits.push(`${file}: ${name}`);
      }
    }
    // Only file names and the kind of secret are reported, never the value.
    expect(hits).toEqual([]);
  });
});
