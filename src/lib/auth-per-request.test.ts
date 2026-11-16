import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression: the Better Auth instance used to be built once at module load.
// Its setup promise then belonged to whichever Worker request first loaded the
// module; once that request ended the promise could never settle, and every
// later request in the isolate returned 500. The instance is now per request.

const m = vi.hoisted(() => ({
  ctx: null as object | null,
  created: 0,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    if (!m.ctx) throw new Error("not in a Worker request");
    return { ctx: m.ctx, env: {} };
  },
}));

vi.mock("better-auth", () => ({
  betterAuth: () => {
    const id = ++m.created;
    return { id, handler: async () => new Response(String(id)), api: { ping: () => id }, $context: Promise.resolve({ id }) };
  },
}));

import { auth, getAuth } from "@/lib/auth";

beforeEach(() => {
  m.ctx = null;
});

describe("auth instance scoping", () => {
  it("builds nothing at import", () => {
    expect(m.created).toBe(0);
  });

  it("reuses one instance within a request and builds a new one for the next request", () => {
    m.ctx = {};
    const first = getAuth();
    expect(getAuth()).toBe(first);

    m.ctx = {};
    const second = getAuth();
    expect(second).not.toBe(first);
  });

  it("resolves the proxy against the current request's instance", async () => {
    m.ctx = {};
    const id = (getAuth() as unknown as { id: number }).id;
    expect((auth.api as unknown as { ping: () => number }).ping()).toBe(id);
    expect(await auth.$context).toEqual({ id });
    // toNextJsHandler checks `"handler" in auth`.
    expect("handler" in auth).toBe(true);
    expect(await (await auth.handler(new Request("https://x.test"))).text()).toBe(String(id));
  });

  it("uses one process-wide instance outside a Worker request", () => {
    expect(getAuth()).toBe(getAuth());
  });
});
