/**
 * orire — evidence helper. Turns a user's own answers to a few measurable
 * questions into one CV bullet. Grounding is deterministic: every number in the
 * draft must already appear in what the user typed, so the model can phrase but
 * never invent a figure.
 */

export interface EvidenceInput {
  role: string;
  company: string;
  /** What they did (or an existing bullet being improved). */
  action: string;
  /** Scale: people, clients, projects, budget, volume. */
  scale: string;
  /** Result: what changed and by how much. */
  result: string;
  /** Timeframe. */
  timeframe: string;
}

export const EVIDENCE_QUESTIONS: {
  key: keyof Pick<EvidenceInput, "action" | "scale" | "result" | "timeframe">;
  label: string;
  placeholder: string;
}[] = [
  { key: "action", label: "What did you do?", placeholder: "e.g. Reworked how new customers get onboarded" },
  { key: "scale", label: "How big was it?", placeholder: "People, clients, projects, budget, volume — e.g. 200 clients, team of 6" },
  { key: "result", label: "What changed, and by roughly how much?", placeholder: "Time saved, cost cut, revenue, quality, speed — e.g. onboarding went from 10 days to 6" },
  { key: "timeframe", label: "Over what period?", placeholder: "e.g. 6 months, Q3 2024 (optional)" },
];

export const EVIDENCE_SYSTEM = `You write ONE strong CV bullet from facts the user typed.
RULES:
- Use ONLY facts and numbers present in the user's answers. NEVER invent, estimate, round or change any number, employer, tool or outcome.
- If the answers contain no figure, write the best factual bullet WITHOUT numbers.
- Start with a strong past-tense verb (present tense if the role is current). One sentence, 12-28 words, no first-person pronouns, no trailing full stop issues.
- Output valid JSON only: {"bullet": string}`;

export function buildEvidencePrompt(i: EvidenceInput): string {
  return [
    `Role: ${i.role || "(not given)"} at ${i.company || "(not given)"}`,
    `What they did: ${i.action}`,
    `Scale: ${i.scale || "(not given)"}`,
    `Result: ${i.result || "(not given)"}`,
    `Timeframe: ${i.timeframe || "(not given)"}`,
    "",
    'Return {"bullet": "..."} only.',
  ].join("\n");
}

/** Numeric tokens in a string, normalised (commas stripped, "10k" kept as-is). */
export function numbersIn(s: string): string[] {
  return (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

/** True when a bullet already carries a measurable figure. */
export function hasMeasurable(s: string): boolean {
  return /\d/.test(s) || /[%$£€]/.test(s);
}

/** Every number in `draft` must come from the user's own answers. */
export function numbersGrounded(draft: string, i: EvidenceInput): boolean {
  const allowed = new Set(numbersIn([i.action, i.scale, i.result, i.timeframe].join(" ")));
  return numbersIn(draft).every((n) => allowed.has(n));
}

/** Pull the bullet out of a (possibly fenced) JSON model reply. */
export function parseEvidenceBullet(raw: string): string | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const v = JSON.parse(cleaned) as { bullet?: unknown };
    const b = typeof v.bullet === "string" ? v.bullet.trim() : "";
    return b && b.length <= 400 ? b : null;
  } catch {
    return null;
  }
}
