import { describe, it, expect } from "vitest";
import { refineRunSignature } from "@/lib/ai/refineSignature";
import type { CVData } from "@/lib/cv/schema";
import type { ProviderId } from "@/lib/ai/types";

const cv = (name: string): CVData =>
  ({ basics: { name }, sections: [] } as unknown as CVData);

describe("refineRunSignature", () => {
  it("is stable for identical inputs", () => {
    const a = refineRunSignature(["openai"] as ProviderId[], "JD", cv("Ada"));
    const b = refineRunSignature(["openai"] as ProviderId[], "JD", cv("Ada"));
    expect(a).toBe(b);
  });

  it("is order-insensitive across providers", () => {
    const a = refineRunSignature(["openai", "claude"] as ProviderId[], "JD", cv("Ada"));
    const b = refineRunSignature(["claude", "openai"] as ProviderId[], "JD", cv("Ada"));
    expect(a).toBe(b);
  });

  it("ignores surrounding whitespace in the job description", () => {
    const a = refineRunSignature(["openai"] as ProviderId[], "  JD  ", cv("Ada"));
    const b = refineRunSignature(["openai"] as ProviderId[], "JD", cv("Ada"));
    expect(a).toBe(b);
  });

  it("changes when the provider set changes", () => {
    const a = refineRunSignature(["openai"] as ProviderId[], "JD", cv("Ada"));
    const b = refineRunSignature(["openai", "claude"] as ProviderId[], "JD", cv("Ada"));
    expect(a).not.toBe(b);
  });

  it("changes when the job description changes", () => {
    const a = refineRunSignature(["openai"] as ProviderId[], "JD one", cv("Ada"));
    const b = refineRunSignature(["openai"] as ProviderId[], "JD two", cv("Ada"));
    expect(a).not.toBe(b);
  });

  it("changes when the CV changes", () => {
    const a = refineRunSignature(["openai"] as ProviderId[], "JD", cv("Ada"));
    const b = refineRunSignature(["openai"] as ProviderId[], "JD", cv("Grace"));
    expect(a).not.toBe(b);
  });
});
