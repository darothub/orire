import { describe, it, expect } from "vitest";
import { refineFallbackFor } from "./refineFallback";

describe("refineFallbackFor", () => {
  it("authorizes the other managed provider for a single-provider Pro run", () => {
    expect(refineFallbackFor("pro", ["openai"])).toEqual({ provider: "anthropic", model: "claude-haiku-4-5" });
    expect(refineFallbackFor("pro", ["anthropic"])).toEqual({ provider: "openai", model: "gpt-5-mini" });
  });

  it("authorizes a fallback for a single-provider Career run", () => {
    expect(refineFallbackFor("career", ["openai"])).toEqual({ provider: "anthropic", model: "claude-haiku-4-5" });
  });

  it("never fails a Free run over to Claude (Anthropic is a Pro feature)", () => {
    // Free is OpenAI-only; the only possible fallback (Anthropic) is plan-blocked.
    expect(refineFallbackFor("free", ["openai"])).toBeNull();
  });

  it("does not authorize a fallback for a 2-provider compare run (both already run)", () => {
    expect(refineFallbackFor("pro", ["openai", "anthropic"])).toBeNull();
    expect(refineFallbackFor("career", ["anthropic", "openai"])).toBeNull();
  });

  it("returns null for an empty selection", () => {
    expect(refineFallbackFor("pro", [])).toBeNull();
  });

  it("uses a budget-tier managed model, so the fallback passes the plan's model-tier gate", () => {
    // Both managed defaults are budget-tier (included on every plan), so the
    // only gate that can reject a fallback is provider-permission — not the
    // model tier. Guards against a future managed-model change silently
    // producing a plan-disallowed fallback.
    const fb = refineFallbackFor("pro", ["openai"]);
    expect(fb).not.toBeNull();
    expect(fb!.model).toMatch(/mini|nano|haiku|flash|small|-lite/i);
  });
});
