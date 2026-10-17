import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fakeAiEnabled,
  fakeAiFor,
  fakeRefinePatch,
  fakeRetonePatch,
  fakeJudgeVerdict,
  fakeSimulatedCV,
  fakeCoverLetter,
  fakeEvidenceBullet,
  fakeStructuredCV,
  fakeBulletReview,
} from "./fakeProvider";
import { parseBulletReview } from "@/lib/ai/bulletReview";
import { parseModelJSON } from "@/lib/ai/guardrails";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { parseVerdict } from "@/lib/ai/judge";
import { coerceSimulatedCV } from "@/lib/ai/simulate";
import { coerceCoverLetter } from "@/lib/ai/coverLetter";
import { parseEvidenceBullet } from "@/lib/ai/evidence";
import { parsedCVFromModelJSON } from "@/lib/ingest/parse";
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

describe("fakeAiEnabled / fakeAiFor", () => {
  it("flag is on only with ORIRE_FAKE_AI=1 and not in production", () => {
    vi.stubEnv("ORIRE_FAKE_AI", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(fakeAiEnabled()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(fakeAiEnabled()).toBe(false);
  });

  it("auto-engages in dev when no key is configured, never in production", () => {
    vi.stubEnv("ORIRE_FAKE_AI", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(fakeAiFor("openai")).toBe(true); // keyless dev → mock

    vi.stubEnv("OPENAI_API_KEY", "sk-real");
    expect(fakeAiFor("openai")).toBe(false); // real key present → no mock

    vi.stubEnv("ORIRE_FAKE_AI", "1");
    expect(fakeAiFor("openai")).toBe(true); // flag forces mock even with a key

    vi.stubEnv("NODE_ENV", "production");
    expect(fakeAiFor("openai")).toBe(false); // never in production
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

describe("fakeRetonePatch", () => {
  it("round-trips through the patch parser and rewrites the summary", () => {
    const source = cv();
    const out = applyRefinePatch(source, parseModelJSON(fakeRetonePatch(source, "confident"))) as unknown as CVData;
    expect(out.basics.summary).toContain("confident");
  });
});

describe("fakeCoverLetter", () => {
  it("coerces into a valid cover letter", () => {
    const letter = coerceCoverLetter(fakeCoverLetter(cv(), "Staff Engineer"));
    expect(letter.opening).toBeTruthy();
    expect(letter.body.length).toBeGreaterThan(0);
    expect(letter.meta.role).toContain("Staff Engineer");
  });
});

describe("fakeEvidenceBullet", () => {
  it("builds a grounded bullet from the inputs only", () => {
    const bullet = parseEvidenceBullet(
      fakeEvidenceBullet({ action: "migrated the billing service", result: "40% fewer errors", scale: "3 teams", timeframe: "2 quarters" }),
    );
    expect(bullet).toBeTruthy();
    expect(bullet).toContain("40% fewer errors");
  });
});

describe("fakeBulletReview", () => {
  it("round-trips through parseBulletReview and flags a weak opener with a strong-verb rewrite", () => {
    const r = parseBulletReview(fakeBulletReview("Helped build the onboarding flow for new engineers"));
    expect(r.verdict).toBe("weak");
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.suggestion.startsWith("Led ")).toBe(true);
  });

  it("returns a strong verdict with no issues for a clean bullet", () => {
    const r = parseBulletReview(fakeBulletReview("Led migration to Stripe, cutting failed payments 38%."));
    expect(r.verdict).toBe("strong");
    expect(r.issues).toEqual([]);
  });
});

describe("fakeStructuredCV", () => {
  it("parses into a CV carrying the first line as the name", () => {
    const parsed = parsedCVFromModelJSON(parseModelJSON(fakeStructuredCV("Ada Lovelace\nSenior Engineer\nBuilt things.")));
    expect(parsed.basics?.fullName).toBe("Ada Lovelace");
  });
});
