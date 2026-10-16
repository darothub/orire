/**
 * orire — DEV-ONLY mock AI provider.
 *
 * When ORIRE_FAKE_AI=1 (and NOT production), the AI routes skip the managed-key
 * HTTPS call and return deterministic, locally-synthesized JSON in the exact
 * shape each task's parser expects. This lets the whole refine → review →
 * library → grade loop — plus compare ("pick the best") and simulate — be
 * exercised in dev with no provider API key and no spend.
 *
 * It is NOT a quality model: outputs are obviously synthetic. Refine makes a
 * small, real change (a tailored summary + a rephrased first bullet) so the
 * review diff (#31) has something to show; that rephrase may trip a guardrail
 * note, which conveniently exercises the fact-grounding UI as well.
 *
 * Hard-guarded: `fakeAiEnabled()` is false in production regardless of the env
 * var, so this can never serve real traffic.
 */

import type { CVData } from "@/lib/cv/schema";
import type { JudgeCandidate } from "@/lib/ai/judge";

/** True only in a non-production environment with ORIRE_FAKE_AI=1. */
export function fakeAiEnabled(): boolean {
  return process.env.ORIRE_FAKE_AI === "1" && process.env.NODE_ENV !== "production";
}

/** A short, human label pulled from the job description for flavour. */
function roleWord(jd: string): string {
  const m = jd.trim().match(/[A-Za-z][A-Za-z+#.\- ]{2,40}/);
  return (m?.[0] ?? "the role").trim().replace(/\s+/g, " ");
}

/**
 * Refine patch (see refinePatch.ts): a tailored summary plus a lightly
 * rephrased first-experience bullet. Title is echoed unchanged (kept grounded),
 * so the review diff surfaces the summary and the one bullet.
 */
export function fakeRefinePatch(cv: CVData, jd: string): string {
  const role = roleWord(jd);
  const patch: Record<string, unknown> = {
    summary:
      (cv.basics.summary?.trim() ? `${cv.basics.summary.trim()} ` : "") +
      `Tailored for ${role}: foregrounding the most relevant experience and measurable impact.`,
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

/** Judge verdict (see judge.ts): decisive winner = first candidate, descending scores. */
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
    reasoning:
      "The versions are close; the first edges ahead on relevance and impact for this role. (Dev mock verdict — not a real model.)",
  });
}

/** Simulated ideal candidate (see simulate.ts coerceSimulatedCV): a small synthetic CV. */
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
    education: [
      { institution: "State University", degree: "BSc", field: "Computer Science", startDate: "2014", endDate: "2018", details: "" },
    ],
    skills: [{ category: "Core", items: ["Ownership", "Communication", "Delivery", "Collaboration"] }],
    projects: [],
    certifications: [],
  });
}
