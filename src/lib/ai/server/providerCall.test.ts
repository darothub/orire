import { describe, it, expect, vi } from "vitest";
import {
  resilientJsonFetch,
  runProvider,
  type ResilienceConfig,
  type ResilienceDeps,
} from "@/lib/ai/server/providerCall";
import { __resetResponseCache } from "@/lib/ai/server/responseCache";

const CFG: ResilienceConfig = { attempts: 3, timeoutMs: 1000, baseDelayMs: 10, maxDelayMs: 100 };

function makeDeps(fetchImpl: ResilienceDeps["fetchImpl"]) {
  const sleeps: number[] = [];
  const deps: ResilienceDeps = {
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5,
  };
  return { deps, sleeps };
}

describe("resilientJsonFetch", () => {
  it("retries transient 5xx then returns the recovered response", async () => {
    const calls: number[] = [];
    let n = 0;
    const { deps, sleeps } = makeDeps(async () => {
      n += 1;
      calls.push(n);
      if (n < 2) return new Response("busy", { status: 503 });
      return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    });
    const out = await resilientJsonFetch("http://x", { method: "POST" }, CFG, deps);
    expect(out).toEqual({ kind: "response", status: 200, text: JSON.stringify({ ok: 1 }) });
    expect(calls.length).toBe(2);
    expect(sleeps.length).toBe(1);
  });

  it("does not retry a non-transient 4xx and returns the body verbatim", async () => {
    let n = 0;
    const { deps, sleeps } = makeDeps(async () => {
      n += 1;
      return new Response("bad input", { status: 400 });
    });
    const out = await resilientJsonFetch("http://x", { method: "POST" }, CFG, deps);
    expect(out).toEqual({ kind: "response", status: 400, text: "bad input" });
    expect(n).toBe(1);
    expect(sleeps.length).toBe(0);
  });

  it("honors a Retry-After header for the backoff delay", async () => {
    let n = 0;
    const { deps, sleeps } = makeDeps(async () => {
      n += 1;
      if (n < 2) return new Response("slow down", { status: 429, headers: { "retry-after": "2" } });
      return new Response("ok", { status: 200 });
    });
    await resilientJsonFetch("http://x", { method: "POST" }, CFG, deps);
    expect(sleeps[0]).toBe(2000);
  });

  it("retries network errors and reports a message after exhausting attempts", async () => {
    let n = 0;
    const { deps, sleeps } = makeDeps(async () => {
      n += 1;
      throw new Error("ECONNRESET");
    });
    const out = await resilientJsonFetch("http://x", { method: "POST" }, CFG, deps, {
      provider: "openai",
    });
    expect(out).toEqual({ kind: "error", message: "ECONNRESET" });
    expect(n).toBe(3);
    expect(sleeps.length).toBe(2);
  });

  it("surfaces a clear timeout message when the request aborts", async () => {
    const { deps } = makeDeps(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const out = await resilientJsonFetch("http://x", { method: "POST" }, CFG, deps, {
      provider: "anthropic",
    });
    expect(out.kind).toBe("error");
    if (out.kind === "error") {
      expect(out.message).toContain("anthropic");
      expect(out.message).toContain("timed out");
    }
  });

  it("returns the terminal response after exhausting retries on a persistent 5xx", async () => {
    let n = 0;
    const { deps } = makeDeps(async () => {
      n += 1;
      return new Response("still down", { status: 500 });
    });
    const out = await resilientJsonFetch("http://x", { method: "POST" }, CFG, deps);
    expect(out).toEqual({ kind: "response", status: 500, text: "still down" });
    expect(n).toBe(3);
  });

  it("passes an abort signal into fetch so timeouts can cancel", async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const { deps } = makeDeps(async (_url, init) => {
      seen.push(init?.signal ?? undefined);
      return new Response("ok", { status: 200 });
    });
    await resilientJsonFetch("http://x", { method: "POST" }, CFG, deps);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
  });
});

describe("runProvider", () => {
  const base = { model: "m", system: "s", user: "u", apiKey: "k" };

  it("parses an OpenAI completion", async () => {
    const { deps } = makeDeps(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "{\"a\":1}" } }] }),
        { status: 200 },
      ),
    );
    const out = await runProvider({ provider: "openai", ...base, deps });
    expect(out).toEqual({ ok: true, content: '{"a":1}' });
  });

  it("joins Anthropic content blocks", async () => {
    const { deps } = makeDeps(async () =>
      new Response(JSON.stringify({ content: [{ text: "hel" }, { text: "lo" }] }), { status: 200 }),
    );
    const out = await runProvider({ provider: "anthropic", ...base, deps });
    expect(out).toEqual({ ok: true, content: "hello" });
  });

  it("returns the provider error body VERBATIM (req 12)", async () => {
    const raw = '{"error":{"message":"You exceeded your quota"}}';
    const { deps } = makeDeps(async () => new Response(raw, { status: 429 }));
    // 429 is retryable; with 1 attempt it returns the terminal body immediately.
    const out = await runProvider({
      provider: "openai",
      ...base,
      deps: { ...deps, sleep: deps.sleep },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.body).toBe(raw);
  });

  it("caches deterministic results and serves the second call without a provider fetch", async () => {
    __resetResponseCache();
    let fetchCount = 0;
    const stub = vi.fn(async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({ choices: [{ message: { content: "cached-out" } }] }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", stub);
    try {
      const args = {
        provider: "openai" as const,
        model: "m",
        system: "cache-sys",
        user: "cache-user",
        apiKey: "k",
        opts: { temperature: 0, seed: 1217 },
      };
      const first = await runProvider(args);
      const second = await runProvider(args);
      expect(first).toEqual({ ok: true, content: "cached-out" });
      expect(second).toEqual({ ok: true, content: "cached-out" });
      expect(fetchCount).toBe(1); // second call was a cache hit
    } finally {
      vi.unstubAllGlobals();
      __resetResponseCache();
    }
  });
});

// Keep the mocked timers tidy if any leaked.
vi.useRealTimers();
