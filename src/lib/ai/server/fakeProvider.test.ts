import { describe, it, expect, afterEach, vi } from "vitest";
import { fakeAiEnabled, fakeRefinePatch, fakeJudgeVerdict, fakeSimulatedCV } from "./fakeProvider";
import { parseModelJSON } from "@/lib/ai/guardrails";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { parseVerdict } from "@/lib/ai/judge";
import { coerceSimulatedCV } from "@/lib/ai/simulate";
import type { CVData } from "@/lib/cv/schema";

function cv(): CVData {
  return {
    basics: { fullName: "Ada", title: "Engineer", email: "a@b.com", phone: "", location: "", summary: "Builds things.", links: [] },
    experience: [{ id: "e0", company: "Acme", role: "Dev", highlights: ["Shipped the widget.", "Fixed bugs."] }],
    education: [],
    skills: [{ id: "s0", category: "Core", items: ["TS"] }],
    projects: [],
    certifications: [],
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("fakeAiEnabled", () => {
  it("is on only with the flag and not in production", () => {
    vi.stubEnv("ORIRE_FAKE_AI", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(fakeAiEnabled()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(fakeAiEnabled()).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ORIRE_FAKE_AI", "0");
    expect(fakeAiEnabled()).toBe(false);
  });
});

describe("fakeRefinePatch", () => {
  it("round-trips through the real patch parser and changes the summary + first bullet", () => {
    const source = cv();
    const patched = applyRefinePatch(source, parseModelJSON(fakeRefinePatch(source, "Senior Backend Engineer")));
    const b = patched as unknown as CVData;
    expect(b.basics.summary).not.toBe(source.basics.summary);
    expect(b.basics.summary).toContain("Senior Backend Engineer");
    // First experience bullet is rephrased; second is untouched.
    expect(b.experience[0].highlights[0]).not.toBe(source.experience[0].highlights[0]);
    expect(b.experience[0].highlights[1]).toBe("Fixed bugs.");
  });
});

describe("fakeJudgeVerdict", () => {
  it("produces a valid verdict with the first candidate as winner", () => {
    const candidates = [
      { id: "openai", label: "ChatGPT", cv: cv() },
      { id: "anthropic", label: "Claude", cv: cv() },
    ];
    const v = parseVerdict(fakeJudgeVerdict(candidates), ["openai", "anthropic"]);
    expect(v.winner).toBe("openai");
    expect(v.scores).toHaveLength(2);
    expect(v.scores[0].overall).toBeGreaterThan(v.scores[1].overall);
  });
});

describe("fakeSimulatedCV", () => {
  it("coerces into a valid CVData carrying the role", () => {
    const ideal = coerceSimulatedCV(fakeSimulatedCV("Platform Engineer"));
    expect(ideal.basics.title).toContain("Platform Engineer");
    expect(ideal.experience.length).toBeGreaterThan(0);
    expect(Array.isArray(ideal.order)).toBe(true);
  });
});
