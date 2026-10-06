import { describe, it, expect, beforeEach } from "vitest";
import { checkLimit, clientIp, clientKey, __resetRateLimits } from "@/lib/ratelimit/rateLimit";

describe("checkLimit (fixed window)", () => {
  beforeEach(() => __resetRateLimits());

  it("allows up to the limit then blocks within a window", () => {
    const t0 = 1_000;
    const r1 = checkLimit("k", 3, 1000, t0);
    const r2 = checkLimit("k", 3, 1000, t0 + 1);
    const r3 = checkLimit("k", 3, 1000, t0 + 2);
    const r4 = checkLimit("k", 3, 1000, t0 + 3);
    expect([r1.ok, r2.ok, r3.ok, r4.ok]).toEqual([true, true, true, false]);
    expect(r1.remaining).toBe(2);
    expect(r3.remaining).toBe(0);
    expect(r4.remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const t0 = 1_000;
    checkLimit("k", 1, 1000, t0);
    expect(checkLimit("k", 1, 1000, t0 + 500).ok).toBe(false);
    // Window boundary reached: a fresh window starts.
    expect(checkLimit("k", 1, 1000, t0 + 1000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const t0 = 1_000;
    checkLimit("a", 1, 1000, t0);
    expect(checkLimit("a", 1, 1000, t0).ok).toBe(false);
    expect(checkLimit("b", 1, 1000, t0).ok).toBe(true);
  });

  it("reports resetMs counting down within the window", () => {
    const t0 = 1_000;
    checkLimit("k", 5, 1000, t0);
    expect(checkLimit("k", 5, 1000, t0 + 400).resetMs).toBe(600);
  });
});

describe("clientIp / clientKey", () => {
  it("takes the first x-forwarded-for hop", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIp(h)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip then 'unknown'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("prefers a user id over IP and namespaces by scope", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9" });
    expect(clientKey("ai", h, "user_42")).toBe("ai:u:user_42");
    expect(clientKey("ai", h, null)).toBe("ai:ip:203.0.113.9");
  });
});
