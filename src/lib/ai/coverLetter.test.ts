import { describe, it, expect } from "vitest";
import { coerceCoverLetter, buildCoverLetterPrompt, COVER_LETTER_SYSTEM } from "@/lib/ai/coverLetter";
import { allowCoverLetter } from "@/lib/plan/plan";
import type { CVData } from "@/lib/cv/schema";

function userCV(): CVData {
  return {
    basics: { fullName: "Real Person", title: "Engineer", email: "r@x.com", phone: "123", location: "Berlin", summary: "Hi.", links: [] },
    experience: [
      { id: "e1", company: "SmallCo", role: "Dev", location: "", startDate: "2020", endDate: "2023", current: false, highlights: ["Shipped features"] },
    ],
    education: [],
    skills: [{ id: "s1", category: "Core", items: ["Go", "Docker"] }],
    projects: [],
    certifications: [],
    order: ["summary", "experience", "skills"],
  };
}

const LETTER_JSON = JSON.stringify({
  meta: { role: "Backend Engineer", company: "ScaleCorp", hiringManager: "Dr. Lee" },
  opening: "I'm excited to apply for the Backend Engineer role.",
  body: ["At SmallCo I shipped features.", "My Go and Docker skills fit your stack."],
  closing: "I'd welcome the chance to talk.",
  signoff: "Best regards,",
});

describe("coerceCoverLetter", () => {
  it("coerces valid model JSON into a structured CoverLetter", () => {
    const cl = coerceCoverLetter(LETTER_JSON);
    expect(cl.meta.role).toBe("Backend Engineer");
    expect(cl.meta.company).toBe("ScaleCorp");
    expect(cl.meta.hiringManager).toBe("Dr. Lee");
    expect(cl.opening).toContain("excited");
    expect(cl.body).toHaveLength(2);
    expect(cl.closing).toContain("talk");
    expect(cl.signoff).toBe("Best regards,");
  });

  it("splits a single prose body into paragraphs and defaults the signoff", () => {
    const cl = coerceCoverLetter(JSON.stringify({ body: "First para.\n\nSecond para.", opening: "Hi." }));
    expect(cl.body).toEqual(["First para.", "Second para."]);
    expect(cl.signoff).toBe("Sincerely,");
    expect(cl.meta.hiringManager).toBeUndefined();
  });

  it("drops blank body entries and tolerates missing fields", () => {
    const cl = coerceCoverLetter(JSON.stringify({ body: ["ok", "", "  "] }));
    expect(cl.body).toEqual(["ok"]);
    expect(cl.opening).toBe("");
    expect(cl.meta.company).toBe("");
  });
});

describe("buildCoverLetterPrompt", () => {
  it("is deterministic and embeds the JD plus grounded CV facts", () => {
    const cv = userCV();
    const a = buildCoverLetterPrompt(cv, "We need a Go backend engineer.", { tone: "confident" });
    const b = buildCoverLetterPrompt(cv, "We need a Go backend engineer.", { tone: "confident" });
    expect(a).toBe(b);
    expect(a).toContain("We need a Go backend engineer.");
    expect(a).toContain("SmallCo");
    expect(a).toContain("TONE: confident");
  });

  it("defaults the tone to professional", () => {
    expect(buildCoverLetterPrompt(userCV(), "jd")).toContain("TONE: professional");
  });
});

describe("COVER_LETTER_SYSTEM guardrails", () => {
  it("forbids inventing facts", () => {
    expect(COVER_LETTER_SYSTEM).toMatch(/do not invent/i);
    expect(COVER_LETTER_SYSTEM).toMatch(/only in the candidate facts/i);
  });
});

describe("allowCoverLetter plan gate", () => {
  it("blocks free and allows every paid plan", () => {
    expect(allowCoverLetter("free")).toBe(false);
    expect(allowCoverLetter("pro")).toBe(true);
    expect(allowCoverLetter("career")).toBe(true);
    expect(allowCoverLetter("teams")).toBe(true);
  });
});
