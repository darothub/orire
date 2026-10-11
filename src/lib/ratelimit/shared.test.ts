import { describe, it, expect, afterEach, vi } from "vitest";
import { checkLimitShared, upstashConfigured } from "./shared";
import { __resetRateLimits } from "./rateLimit";

function mockPipeline(items: Array<{ result?: unknown; error?: string }>, okHttp = true) {
  return vi.fn(async () => ({
    ok: okHttp,
    status: okHttp ? 200 : 500,
    json: async () => items,
  })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  __resetRateLimits();
});

describe("checkLimitShared", () => {
  it("falls back to the in-memory limiter when Upstash is not configured", async () => {
    expect(upstashConfigured()).toBe(false);
    const a = await checkLimitShared("mem-key", 2, 1000);
    const b = await checkLimitShared("mem-key", 2, 1000);
    const c = await checkLimitShared("mem-key", 2, 1000);
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, false]);
  });

  it("uses the Upstash store when configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubGlobal("fetch", mockPipeline([{ result: 1 }, { result: 1 }, { result: 55000 }]));
    const r = await checkLimitShared("u:1", 30, 60000);
    expect(r).toEqual({ ok: true, remaining: 29, limit: 30, resetMs: 55000 });
  });

  it("blocks once the shared count exceeds the limit", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubGlobal("fetch", mockPipeline([{ result: 31 }, { result: 0 }, { result: 20000 }]));
    const r = await checkLimitShared("u:1", 30, 60000);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("fails safe to the in-memory limiter on an Upstash error", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch);
    const r = await checkLimitShared("fallback-key", 2, 1000);
    expect(r.ok).toBe(true); // first in-memory hit allowed, not thrown
  });
});
