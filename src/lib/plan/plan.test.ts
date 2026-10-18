import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_ORDER,
  modelTier,
  modelAllowedOnPlan,
  providerCountAllowed,
  providerAllowedOnPlan,
  withinCap,
  refineCap,
  meterFor,
  remainingNote,
  nextPlan,
} from "@/lib/plan/plan";
import { TEMPLATE_COUNT, allTemplatesPerk } from "@/lib/templates/catalog";

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
  it("defaults an empty model to mid (never blocked as premium)", () => {
    expect(modelTier("openai", "")).toBe("mid");
  });
});

describe("modelAllowedOnPlan", () => {
  it("free allows only budget", () => {
    expect(modelAllowedOnPlan("free", "openai", "gpt-4o-mini").allowed).toBe(true);
    expect(modelAllowedOnPlan("free", "openai", "gpt-4o").allowed).toBe(false);
  });
  it("pro allows mid but not premium", () => {
    expect(modelAllowedOnPlan("pro", "openai", "gpt-4o").allowed).toBe(true);
    expect(modelAllowedOnPlan("pro", "anthropic", "claude-3-opus-latest").allowed).toBe(false);
  });
  it("career includes premium models", () => {
    expect(modelAllowedOnPlan("career", "anthropic", "claude-3-opus-latest").allowed).toBe(true);
    expect(modelAllowedOnPlan("career", "openai", "gpt-4o").allowed).toBe(true);
  });
  it("gives a helpful reason when blocked", () => {
    const r = modelAllowedOnPlan("free", "openai", "gpt-4o");
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

describe("meterFor / plan meters", () => {
  it("free is lifetime-capped on every metric (3/1/3)", () => {
    expect(meterFor("free", "refine")).toEqual({ cap: 3, scope: "lifetime" });
    expect(meterFor("free", "simulate")).toEqual({ cap: 1, scope: "lifetime" });
    expect(meterFor("free", "download")).toEqual({ cap: 3, scope: "lifetime" });
  });
  it("pro caps refine monthly at 30, unlimited elsewhere", () => {
    expect(meterFor("pro", "refine")).toEqual({ cap: 30, scope: "monthly" });
    expect(meterFor("pro", "simulate").cap).toBeNull();
    expect(meterFor("pro", "download").cap).toBeNull();
  });
  it("career is unlimited across the board", () => {
    expect(meterFor("career", "refine").cap).toBeNull();
    expect(meterFor("career", "simulate").cap).toBeNull();
    expect(meterFor("career", "download").cap).toBeNull();
  });
  it("refineCap reflects the refine cap", () => {
    expect(refineCap("free")).toBe(3);
    expect(refineCap("pro")).toBe(30);
    expect(refineCap("career")).toBeNull();
  });
});

describe("remainingNote", () => {
  it("counts down with correct pluralisation", () => {
    expect(remainingNote("refine", 3, 1)).toBe("2 free refines left.");
    expect(remainingNote("download", 3, 2)).toBe("1 free download left.");
    expect(remainingNote("simulate", 1, 0)).toBe("1 free simulation left.");
  });
  it("warns + upsells on the last one", () => {
    expect(remainingNote("simulate", 1, 1)).toContain("last free simulation");
    expect(remainingNote("refine", 3, 3)).toContain("upgrade to Pro");
  });
  it("is empty for unlimited plans", () => {
    expect(remainingNote("refine", null, 999)).toBe("");
  });
  it("never goes negative", () => {
    expect(remainingNote("download", 3, 5)).toContain("last free download");
  });
});

describe("withinCap", () => {
  it("enforces the free lifetime refine cap (3)", () => {
    expect(withinCap("free", "refine", 2).allowed).toBe(true);
    expect(withinCap("free", "refine", 3).allowed).toBe(false);
  });
  it("enforces the free simulate cap (1)", () => {
    expect(withinCap("free", "simulate", 0).allowed).toBe(true);
    expect(withinCap("free", "simulate", 1).allowed).toBe(false);
  });
  it("enforces the free download cap (3)", () => {
    expect(withinCap("free", "download", 3).allowed).toBe(false);
  });
  it("enforces the pro monthly refine cap (30) and says 'this month'", () => {
    expect(withinCap("pro", "refine", 29).allowed).toBe(true);
    const gate = withinCap("pro", "refine", 30);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("this month");
  });
  it("treats unlimited (null cap) as always allowed", () => {
    expect(withinCap("career", "refine", 9999).allowed).toBe(true);
    expect(withinCap("pro", "download", 9999).allowed).toBe(true);
  });
  it("lifetime cap copy does not say 'this month'", () => {
    const gate = withinCap("free", "refine", 3);
    expect(gate.reason).not.toContain("this month");
  });
});

describe("nextPlan", () => {
  it("walks the ladder and stops at the top", () => {
    expect(nextPlan("free")?.id).toBe("pro");
    expect(nextPlan("pro")?.id).toBe("career");
    expect(nextPlan("career")).toBeNull();
  });
});

describe("providerAllowedOnPlan", () => {
  it("blocks Anthropic (Claude) on Free with an upgrade reason", () => {
    const r = providerAllowedOnPlan("free", "anthropic");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Pro/);
  });
  it("allows OpenAI (ChatGPT) on Free", () => {
    expect(providerAllowedOnPlan("free", "openai").allowed).toBe(true);
  });
  it("allows both assistants on Pro and Career", () => {
    for (const plan of ["pro", "career"] as const) {
      expect(providerAllowedOnPlan(plan, "openai").allowed).toBe(true);
      expect(providerAllowedOnPlan(plan, "anthropic").allowed).toBe(true);
    }
  });
});

describe("plan template perks", () => {
  it("every plan advertises the full live catalog (no tier-skewed count)", () => {
    const expected = allTemplatesPerk();
    expect(expected).toContain(String(TEMPLATE_COUNT));
    for (const id of PLAN_ORDER) {
      expect(PLANS[id].perks[0]).toBe(expected);
      expect(PLANS[id].perks.some((p) => /template/i.test(p))).toBe(true);
    }
  });
});
