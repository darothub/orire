/**
 * orire — DEV-ONLY mock AI provider.
 *
 * Lets every AI feature run locally with no provider API key and no spend. In
 * a non-production environment the mock serves a task when either:
 *   - ORIRE_FAKE_AI=1 is set (force the mock even if a key exists — no spend), or
 *   - the provider has no key configured (keyless dev "just works").
 * It returns deterministic, locally-synthesized JSON in the exact shape each
 * task's parser expects.
 *
 * It is NOT a quality model: outputs are obviously synthetic. Refine/retone make
 * a small, real change so the review diff (#31) has something to show.
 *
 * Hard-guarded: in production the mock is NEVER served, regardless of the env
 * var — a missing key there still returns the honest "not configured" error.
 */

import type { CVData } from "@/lib/cv/schema";
import type { JudgeCandidate } from "@/lib/ai/judge";
import type { ProviderId } from "@/lib/ai/types";
import { providerConfigured } from "@/lib/ai/server/serverKey";
import { analyzeBullet } from "@/lib/cv/coach";

/** The explicit force flag (also used to force the mock when keys DO exist). */
export function fakeAiEnabled(): boolean {
  return process.env.ORIRE_FAKE_AI === "1" && process.env.NODE_ENV !== "production";
}

/**
 * Whether to serve the mock for this provider. Never in production; otherwise
 * when forced by the flag OR when no real key is configured — so a fresh dev
 * checkout with no keys can exercise every AI flow with zero setup.
 */
export function fakeAiFor(provider: ProviderId): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ORIRE_FAKE_AI === "1" || !providerConfigured(provider);
}

/** A short, human label pulled from the job description for flavour. */
function roleWord(jd: string): string {
  const m = jd.trim().match(/[A-Za-z][A-Za-z+#.\- ]{2,40}/);
  return (m?.[0] ?? "the role").trim().replace(/\s+/g, " ");
}

/** Shared refine/retone patch builder: tailored summary + rephrased first bullet. */
function patchJson(cv: CVData, summarySuffix: string): string {
  const patch: Record<string, unknown> = {
    summary: (cv.basics.summary?.trim() ? `${cv.basics.summary.trim()} ` : "") + summarySuffix,
  };
  if (cv.basics.title?.trim()) patch.title = cv.basics.title.trim();
  const exp0 = cv.experience[0];
  if (exp0 && exp0.highlights.length) {
    patch.experience = [
      {
        ref: 0,
        highlights: exp0.highlights.map((h, i) =>
          i === 0 && h.trim() ? `Delivered ${h.charAt(0).toLowerCase()}${h.slice(1)}` : h,
        ),
      },
    ];
  }
  return JSON.stringify(patch);
}

/** Refine patch (refinePatch.ts). */
export function fakeRefinePatch(cv: CVData, jd: string): string {
  return patchJson(cv, `Tailored for ${roleWord(jd)}: foregrounding the most relevant experience and measurable impact.`);
}

/** Retone patch (retone.ts — same PATCH shape as refine). */
export function fakeRetonePatch(cv: CVData, toneLabel: string): string {
  return patchJson(cv, `Rewritten in a ${toneLabel || "clear, professional"} tone, keeping every fact intact.`);
}

/** Judge verdict (judge.ts): decisive winner = first candidate, descending scores. */
export function fakeJudgeVerdict(candidates: JudgeCandidate[]): string {
  const scores = candidates.map((c, i) => {
    const base = Math.max(40, 80 - i * 7);
    return {
      id: c.id,
      relevance: base,
      impact: Math.max(40, base - 3),
      coverage: Math.min(100, base + 2),
      conciseness: Math.min(100, base + 4),
      overall: base,
      rationale: `${c.label}: covers the core requirements clearly, concise and relevant.`,
    };
  });
  return JSON.stringify({
    scores,
    winner: candidates[0]?.id ?? "",
    reasoning: "The versions are close; the first edges ahead on relevance and impact for this role. (Dev mock verdict — not a real model.)",
  });
}

/** Simulated ideal candidate (simulate.ts coerceSimulatedCV). */
export function fakeSimulatedCV(jd: string): string {
  const role = roleWord(jd);
  return JSON.stringify({
    basics: {
      fullName: "Ideal Candidate",
      title: role,
      email: "candidate@example.com",
      phone: "",
      location: "Remote",
      summary: `A strong ${role} with end-to-end ownership, measurable impact, and clear communication. (Dev mock benchmark.)`,
      links: [],
    },
    experience: [
      {
        company: "Exemplar Inc.",
        role,
        location: "Remote",
        startDate: "2021",
        endDate: "Present",
        current: true,
        highlights: [
          `Led ${role} work from design through delivery.`,
          "Drove measurable gains in reliability, speed and quality.",
          "Mentored peers and raised the engineering bar.",
        ],
      },
    ],
    education: [{ institution: "State University", degree: "BSc", field: "Computer Science", startDate: "2014", endDate: "2018", details: "" }],
    skills: [{ category: "Core", items: ["Ownership", "Communication", "Delivery", "Collaboration"] }],
    projects: [],
    certifications: [],
  });
}

/** Cover letter (coverLetter.ts coerceCoverLetter). */
export function fakeCoverLetter(cv: CVData, jd: string): string {
  const role = roleWord(jd);
  const name = cv.basics.fullName?.trim() || "the candidate";
  return JSON.stringify({
    meta: { role, company: "", hiringManager: "" },
    opening: `I'm writing to express my interest in the ${role} role.`,
    body: [
      `My background maps directly onto what this ${role} position needs — I've consistently delivered end-to-end and focused on measurable impact.`,
      `I'd welcome the chance to bring that to your team. (Dev mock letter for ${name}.)`,
    ],
    closing: "Thank you for considering my application; I'd be glad to discuss further.",
    signoff: "Sincerely,",
  });
}

/** Evidence bullet (evidence.ts parseEvidenceBullet → {bullet}). */
export function fakeEvidenceBullet(input: { action: string; result: string; scale: string; timeframe: string }): string {
  const parts = [
    input.action ? input.action.charAt(0).toUpperCase() + input.action.slice(1) : "Delivered the work",
    input.scale ? `across ${input.scale}` : "",
    input.result ? `achieving ${input.result}` : "",
    input.timeframe ? `within ${input.timeframe}` : "",
  ].filter(Boolean);
  return JSON.stringify({ bullet: `${parts.join(" ")}.` });
}

/**
 * Bullet quality review (bulletReview.ts parseBulletReview). The mock reuses the
 * deterministic coach to produce plausible issues + a light rewrite, so the
 * review flow is exercisable in dev with no key.
 */
export function fakeBulletReview(text: string): string {
  const flags = analyzeBullet(text);
  const issues = flags.map((f) => ({ type: f.id, message: f.hint }));
  // A trivial "rewrite" — never add a number (keeps the grounding guard happy):
  //  - a typo: fix the opener to the suggested spelling;
  //  - a weak/duty/unusual opener: swap it for a strong verb.
  let suggestion = "";
  const typo = flags.find((f) => f.id === "typo" && f.suggest);
  const body = text.trim().replace(/^[-–—•*\s]+/, "").replace(/^\S+\s*/, "");
  if (typo) {
    const fixed = typo.suggest!.charAt(0).toUpperCase() + typo.suggest!.slice(1);
    suggestion = body ? `${fixed} ${body}` : fixed;
  } else if (flags.some((f) => f.id === "weak-verb" || f.id === "duty" || f.id === "odd-verb")) {
    suggestion = body ? `Led ${body.charAt(0).toLowerCase()}${body.slice(1)}` : "Led the work";
  }
  const verdict = flags.some((f) => f.severity === "warn") ? "weak" : flags.length ? "ok" : "strong";
  return JSON.stringify({ verdict, issues, suggestion });
}

/** Structured CV from raw text (prompt.ts STRUCTURE → parsedCVFromModelJSON). */
export function fakeStructuredCV(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fullName = lines[0] ?? "Imported Candidate";
  const summary = lines.slice(1, 6).join(" ").slice(0, 400);
  return JSON.stringify({
    basics: { fullName, title: "", email: "", phone: "", location: "", summary, links: [] },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  });
}
