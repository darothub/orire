import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProviderCall } from "@/lib/ai/server/providerCall";

const runProvider = vi.fn<(args: { provider: string }) => Promise<ProviderCall>>();
const serverKeyFor = vi.fn<(p: string) => string | null>();

vi.mock("@/lib/ai/server/providerCall", () => ({
  runProvider: (args: { provider: string }) => runProvider(args),
  DETERMINISTIC: {},
}));
vi.mock("@/lib/ai/server/serverKey", () => ({
  serverKeyFor: (p: string) => serverKeyFor(p),
  notConfiguredMessage: () => "not configured",
}));

import { isAvailabilityFailure, runRoutedWithFailover } from "./failover";

// simulate routes to openai (gpt-5-mini); fallback is anthropic (claude-haiku-4-5).
const okCall = (content: string): ProviderCall => ({ ok: true, content });
const failCall = (status?: number): ProviderCall => ({ ok: false, status, body: "boom" });

beforeEach(() => {
  runProvider.mockReset();
  serverKeyFor.mockReset();
  serverKeyFor.mockReturnValue("sk-key"); // both providers configured by default
});

describe("isAvailabilityFailure", () => {
  it("treats transport errors and 5xx/429 as availability failures", () => {
    expect(isAvailabilityFailure(failCall(undefined))).toBe(true);
    expect(isAvailabilityFailure(failCall(503))).toBe(true);
    expect(isAvailabilityFailure(failCall(429))).toBe(true);
  });
  it("treats deterministic 4xx and success as non-failover", () => {
    expect(isAvailabilityFailure(failCall(400))).toBe(false);
    expect(isAvailabilityFailure(failCall(401))).toBe(false);
    expect(isAvailabilityFailure(okCall("x"))).toBe(false);
  });
});

describe("runRoutedWithFailover", () => {
  it("serves the primary when it succeeds (no fallback call)", async () => {
    runProvider.mockResolvedValueOnce(okCall("primary"));
    const res = await runRoutedWithFailover("simulate", { system: "s", user: "u" });
    expect(res.provider).toBe("openai");
    expect(res.fellBack).toBe(false);
    expect(runProvider).toHaveBeenCalledOnce();
  });

  it("fails over to the other provider on an availability failure", async () => {
    runProvider.mockResolvedValueOnce(failCall(503)).mockResolvedValueOnce(okCall("backup"));
    const res = await runRoutedWithFailover("simulate", { system: "s", user: "u" });
    expect(res.provider).toBe("anthropic");
    expect(res.fellBack).toBe(true);
    expect(res.call.ok).toBe(true);
    expect(runProvider).toHaveBeenCalledTimes(2);
  });

  it("does NOT fail over on a deterministic 4xx", async () => {
    runProvider.mockResolvedValueOnce(failCall(400));
    const res = await runRoutedWithFailover("simulate", { system: "s", user: "u" });
    expect(res.provider).toBe("openai");
    expect(res.fellBack).toBe(false);
    expect(runProvider).toHaveBeenCalledOnce();
  });

  it("reports noKey when no provider is configured", async () => {
    serverKeyFor.mockReturnValue(null);
    const res = await runRoutedWithFailover("simulate", { system: "s", user: "u" });
    expect(res.noKey).toBe(true);
    expect(res.call.ok).toBe(false);
    expect(runProvider).not.toHaveBeenCalled();
  });

  it("uses the only configured provider when the primary has no key", async () => {
    serverKeyFor.mockImplementation((p: string) => (p === "anthropic" ? "sk-key" : null));
    runProvider.mockResolvedValueOnce(okCall("only-anthropic"));
    const res = await runRoutedWithFailover("simulate", { system: "s", user: "u" });
    expect(res.provider).toBe("anthropic");
    expect(runProvider).toHaveBeenCalledOnce();
  });
});
