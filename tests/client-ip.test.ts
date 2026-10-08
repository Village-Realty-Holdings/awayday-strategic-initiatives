import { describe, it, expect } from "vitest";
import { clientIp } from "../src/lib/client-ip";

// Headers stub
const H = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null });

describe("clientIp (#12 spoof resistance)", () => {
  it("prefers the edge-set cf-connecting-ip over a spoofed x-forwarded-for", () => {
    const h = H({
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "1.2.3.4, 5.6.7.8", // attacker-supplied
    });
    expect(clientIp(h)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when no cloudflare header", () => {
    expect(clientIp(H({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "1.2.3.4" }))).toBe("198.51.100.2");
  });

  it("uses the first x-forwarded-for hop only as a last resort", () => {
    expect(clientIp(H({ "x-forwarded-for": "9.9.9.9, 1.1.1.1" }))).toBe("9.9.9.9");
  });

  it("returns 'unknown' when nothing is present", () => {
    expect(clientIp(H({}))).toBe("unknown");
  });
});
