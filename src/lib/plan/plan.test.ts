import { describe, it, expect } from "vitest";
import {
  modelTier,
  modelAllowedOnPlan,
  providerCountAllowed,
  withinMonthlyCap,
  nextPlan,
} from "@/lib/plan/plan";

describe("modelTier", () => {
  it("classifies budget models", () => {
    expect(modelTier("openai", "gpt-4o-mini")).toBe("budget");
    expect(modelTier("anthropic", "claude-3-5-haiku-latest")).toBe("budget");
    expect(modelTier("openai", "gpt-4.1-nano")).toBe("budget");
  });
  it("classifies premium models", () => {
    expect(modelTier("anthropic", "claude-3-opus-latest")).toBe("premium");
    expect(modelTier("anthropic", "claude-opus-4-0")).toBe("premium");
    expect(modelTier("openai", "gpt-4-turbo")).toBe("premium");
    expect(modelTier("openai", "o3")).toBe("premium");
  });
  it("treats mid-range models as mid", () => {
    expect(modelTier("openai", "gpt-4o")).toBe("mid");
    expect(modelTier("anthropic", "claude-3-7-sonnet-latest")).toBe("mid");
  });
  it("defaults empty CLI model to mid (own login, never blocked as premium)", () => {
    expect(modelTier("codex-cli", "")).toBe("mid");
  });
});

describe("modelAllowedOnPlan", () => {
  it("free allows only budget", () => {
    expect(modelAllowedOnPlan("free", "openai", "gpt-4o-mini", false).allowed).toBe(true);
    expect(modelAllowedOnPlan("free", "openai", "gpt-4o", false).allowed).toBe(false);
  });
  it("pro allows mid without a key", () => {
    expect(modelAllowedOnPlan("pro", "openai", "gpt-4o", false).allowed).toBe(true);
  });
  it("pro blocks premium unless the user brings a key", () => {
    expect(modelAllowedOnPlan("pro", "anthropic", "claude-3-opus-latest", false).allowed).toBe(false);
    expect(modelAllowedOnPlan("pro", "anthropic", "claude-3-opus-latest", true).allowed).toBe(true);
  });
  it("teams allows premium without a key", () => {
    expect(modelAllowedOnPlan("teams", "anthropic", "claude-3-opus-latest", false).allowed).toBe(true);
  });
  it("gives a helpful reason when blocked", () => {
    const r = modelAllowedOnPlan("free", "openai", "gpt-4o", false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/mid/i);
  });
});

describe("providerCountAllowed", () => {
  it("free cannot compare", () => {
    expect(providerCountAllowed("free", 1).allowed).toBe(true);
    expect(providerCountAllowed("free", 2).allowed).toBe(false);
  });
  it("pro allows 2, not 3", () => {
    expect(providerCountAllowed("pro", 2).allowed).toBe(true);
    expect(providerCountAllowed("pro", 3).allowed).toBe(false);
  });
  it("career allows 3", () => {
    expect(providerCountAllowed("career", 3).allowed).toBe(true);
  });
});

describe("withinMonthlyCap", () => {
  it("enforces the free cap", () => {
    expect(withinMonthlyCap("free", 2).allowed).toBe(true);
    expect(withinMonthlyCap("free", 3).allowed).toBe(false);
  });
  it("treats null cap as unlimited", () => {
    expect(withinMonthlyCap("career", 9999).allowed).toBe(true);
  });
});

describe("nextPlan", () => {
  it("walks the ladder and stops at the top", () => {
    expect(nextPlan("free")?.id).toBe("pro");
    expect(nextPlan("pro")?.id).toBe("career");
    expect(nextPlan("teams")).toBeNull();
  });
});
