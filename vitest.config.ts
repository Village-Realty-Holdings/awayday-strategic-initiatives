import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // The unit suite is tests/ only. scripts/ holds operational tooling and
    // throwaway harnesses that need a live database and real env vars, so
    // collecting them here turns an ordinary `vitest run` red for no reason.
    exclude: ["**/node_modules/**", "dist/**", ".next/**", ".open-next/**", ".wrangler/**", ".claude/**", "scripts/**"],
    // Every test here is mocked and finishes in milliseconds when the machine
    // is idle. With several worktrees building at once (load average 60-90 on
    // 2026-09-04) the 5s default tripped on eight of them and blocked a deploy
    // for nothing. Real hangs still fail; they just take longer to.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
