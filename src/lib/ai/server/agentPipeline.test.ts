import { describe, it, expect } from "vitest";
import { runAnalysis, runCritique, runRewrite, type AgentCaller } from "@/lib/ai/server/agentPipeline";
import { MAX_CRITIC_ROUNDS, parseCritique, parseGapReport, parseQuestions, sanitizeAnswers, shouldContinue, buildRewriterPrompt } from "@/lib/ai/agents";
import { isBetterDraft } from "@/lib/ai/coachLoop";
import { sampleCV } from "@/lib/cv/sample";

const profile = JSON.stringify({ roleTitle: "Designer", seniority: "senior", mustHaves: ["Figma"], niceToHaves: [], keywords: ["figma"], tone: "clear" });
const gap = JSON.stringify({
  matched: ["Fintech"],
  understated: [{ area: "Impact", advice: "state results" }],
  plausible: [],
  genuineGap: [{ area: "Kotlin", advice: "none on CV" }],
  weakBullets: [],
});
const questions = JSON.stringify({ questions: [{ targets: "Impact", prompt: "By how much?", kind: "metric" }] });

function caller(overrides: Partial<Record<string, string>> = {}): AgentCaller {
  const out: Record<string, string> = { analyst: profile, gap, elicitor: questions, rewriter: "{}", ...overrides };
  return async (agent) => ({ ok: true, content: out[agent] });
}

describe("runAnalysis", () => {
  it("returns profile, bucketed report and questions with assigned ids", async () => {
    const r = await runAnalysis(sampleCV, "Senior designer", caller());
    if (!r.ok) throw new Error("expected ok");
    expect(r.profile.roleTitle).toBe("Designer");
    expect(r.report.genuineGap[0].area).toBe("Kotlin");
    expect(r.questions).toEqual([{ id: "q1", targets: "Impact", prompt: "By how much?", kind: "metric" }]);
  });

  it("skips the elicitor when nothing is closeable", async () => {
    const seen: string[] = [];
    const call: AgentCaller = async (agent) => {
      seen.push(agent);
      return { ok: true, content: agent === "analyst" ? profile : JSON.stringify({ matched: ["x"] }) };
    };
    const r = await runAnalysis(sampleCV, "JD", call);
    expect(r).toMatchObject({ ok: true, questions: [] });
    expect(seen).not.toContain("elicitor");
  });

  it("stops and names the failing agent", async () => {
    const call: AgentCaller = async (agent) =>
      agent === "gap" ? { ok: false, status: 500, body: "boom" } : { ok: true, content: profile };
    expect(await runAnalysis(sampleCV, "JD", call)).toMatchObject({ ok: false, agent: "gap", status: 500 });
  });

  it("reports an unreadable response", async () => {
    expect(await runAnalysis(sampleCV, "JD", async () => ({ ok: true, content: "nope" }))).toMatchObject({ ok: false, agent: "analyst" });
  });
});

describe("runRewrite", () => {
  const p = JSON.parse(profile);
  const report = parseGapReport(gap, sampleCV);

  it("keeps locked identity and applies the tailored summary", async () => {
    const r = await runRewrite(sampleCV, "JD", p, report, [], caller({ rewriter: JSON.stringify({ summary: "Tailored." }) }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.cv.basics.fullName).toBe(sampleCV.basics.fullName);
    expect(r.cv.basics.summary).toBe("Tailored.");
  });

  it("strips invented skills", async () => {
    const patch = JSON.stringify({ skills: [{ category: "Core", items: ["Kubernetes"] }] });
    const r = await runRewrite(sampleCV, "JD", p, report, [], caller({ rewriter: patch }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.cv.skills.flatMap((s) => s.items)).not.toContain("Kubernetes");
  });

  const patch = JSON.stringify({ experience: [{ ref: 0, highlights: ["Cut onboarding time by 37% across 4821 users"] }] });

  it("flags a figure the candidate never supplied", async () => {
    const r = await runRewrite(sampleCV, "JD", p, report, [], caller({ rewriter: patch }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.warnings.some((w) => w.includes("37%"))).toBe(true);
  });

  it("accepts figures the candidate supplied in an answer, but not others", async () => {
    const answers = sanitizeAnswers([{ questionId: "q1", question: "By how much?", answer: "It dropped onboarding time by 37%" }]);
    const r = await runRewrite(sampleCV, "JD", p, report, answers, caller({ rewriter: patch }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.warnings.some((w) => w.includes("37%"))).toBe(false);
    expect(r.warnings.some((w) => w.includes("4821"))).toBe(true);
  });
});

describe("parsers", () => {
  it("drops weak bullets with out-of-range refs", () => {
    const raw = JSON.stringify({
      weakBullets: [
        { kind: "experience", ref: 0, issue: "vague" },
        { kind: "experience", ref: 99, issue: "bad ref" },
      ],
    });
    expect(parseGapReport(raw, sampleCV).weakBullets).toHaveLength(1);
  });

  it("caps questions at 6 and ignores model-supplied ids", () => {
    const qs = Array.from({ length: 9 }, (_, i) => ({ id: "evil", prompt: `Q${i}`, kind: "metric" }));
    const parsed = parseQuestions(JSON.stringify({ questions: qs }));
    expect(parsed).toHaveLength(6);
    expect(parsed[0].id).toBe("q1");
  });

  it("drops blank answers", () => {
    expect(sanitizeAnswers([{ questionId: "q1", answer: "  " }, { questionId: "q2", answer: "yes" }])).toHaveLength(1);
  });
});

describe("critic loop", () => {
  const p = JSON.parse(profile);
  const critique = JSON.stringify({
    recruiter: { issues: [{ kind: "experience", ref: 0, problem: "No outcome", fix: "State the result" }, { kind: "experience", ref: 99, problem: "bad", fix: "x" }], keepGoing: true },
    ats: { missingKeywords: ["figma"], parseRisks: [], keepGoing: false },
  });

  it("runCritique returns a sanitized critique and deterministic ATS", async () => {
    const r = await runCritique(sampleCV, "Figma designer", p, async () => ({ ok: true, content: critique }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.critique.recruiter.issues).toHaveLength(2);
    expect(r.critique.recruiter.issues[1].ref).toBeUndefined();
    expect(typeof r.ats.score).toBe("number");
  });

  it("runCritique names the critic on failure", async () => {
    expect(await runCritique(sampleCV, "JD", p, async () => ({ ok: false, status: 429, body: "slow" }))).toMatchObject({ ok: false, agent: "critic" });
  });

  it("keepGoing needs real issues; ignored for a bare flag", () => {
    const c = parseCritique(JSON.stringify({ recruiter: { issues: [], keepGoing: true } }), sampleCV);
    expect(c.recruiter.keepGoing).toBe(false);
  });

  it("shouldContinue stops at the round cap", () => {
    const c = parseCritique(critique, sampleCV);
    expect(shouldContinue(c, 0)).toBe(true);
    expect(shouldContinue(c, MAX_CRITIC_ROUNDS)).toBe(false);
  });

  it("feeds the critique and previous draft to the rewriter", () => {
    const c = parseCritique(critique, sampleCV);
    const prompt = buildRewriterPrompt(sampleCV, "JD", p, parseGapReport(gap, sampleCV), [], { critique: c, previousDraft: sampleCV });
    expect(prompt).toContain("REVIEWER FEEDBACK");
    expect(prompt).toContain("No outcome");
  });

  it("isBetterDraft prefers fewer warnings, then higher ATS", () => {
    expect(isBetterDraft({ warnings: 2, atsScore: 50 }, { warnings: 1, atsScore: 10 })).toBe(true);
    expect(isBetterDraft({ warnings: 1, atsScore: 50 }, { warnings: 1, atsScore: 60 })).toBe(true);
    expect(isBetterDraft({ warnings: 1, atsScore: 50 }, { warnings: 1, atsScore: 50 })).toBe(false);
    expect(isBetterDraft({ warnings: 0, atsScore: 50 }, { warnings: 1, atsScore: 90 })).toBe(false);
  });
});
