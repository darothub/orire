/** Validate AI interview outputs before showing them to the user.
 * The interviewer coaches against the answer, not a hiring prediction.
 */
export type InterviewQuestion = { question: string; focus: string; answerStarters?: [string, string] };
export type InterviewFeedback = { strength: string; improvement: string; example: string; followUp: string; betterWording?: string; whyBetter?: string; wordingStatus?: "grounded" | "copyedit" };
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const clean = (value: unknown, max: number): string => typeof value === "string" ? value.trim().slice(0,max) : "";
function parse(raw: string): Record<string,unknown> {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Invalid interview response"); }
  if (!isRecord(value)) throw new Error("Invalid interview response");
  return value;
}
const safeStarter = (value: string) =>
  !/\b(?:I|I've|I have|my|we|our)\b/i.test(value) &&
  !/\b\d+(?:[.,]\d+)*(?:%|\b)/.test(value) &&
  !/\b(?:guaranteed|always|definitely)\b/i.test(value);
const FALLBACK_STARTERS: [string, string] = [
  "Describe how you would approach this situation and explain why.",
  "Use a genuine example if you have one: what happened, what did you do, and what did you learn?",
];

/** Conservative grounded rewriting: only known content words may be rearranged.
 * Avoid guesses about skills, employers, results, clinical claims, credentials
 * and industry terminology. When uncertain, show a copyedited original answer.
 */
const SUPPORT_WORDS = new Set(
  "a an the and or but so because if then as at by for from in into of on to with without about after before when while where who what which that this those these it its i me my we our you your they them their he she his her is are was were be been being am do does did doing would could should can may might will shall have has had having just very really also only even more most less much many some any each all every one two there here how why not no yes first next finally last example clear clearly simple simply way approach explain explained describing describe said say told tell show showed showing make made makes use used using work worked working help helped helping need needed needs try tried trying sure feel felt feeling good better well give gave given take took taking get got getting think thought know knew known understand understood understanding able important specific honestly truthfully through step steps experience example actually genuinely real real-life own personally result outcome situation process part role task job time people person team together following during however overall ensure ensured providing provide provided".split(" "),
);
const contentWords = (value: string): string[] =>
  (value.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter(w => w.length >= 3 && !SUPPORT_WORDS.has(w));
const stem = (word: string) => word.replace(/(?:ingly|edly|ation|ments|ment|ing|ied|ed|ies|es|s)$/, "");
const normalizedToken = (word: string) => stem(word.replace(/['-]/g,""));
function groundedRewrite(candidate: string, answer: string): boolean {
  if (!candidate || !answer.trim()) return false;
  const numbers = candidate.match(/\b\d+(?:[.,]\d+)*(?:%|\b)/g) ?? [];
  if (numbers.some(n => !answer.includes(n))) return false;
  const source = new Set(contentWords(answer).map(normalizedToken));
  const proposed = contentWords(candidate).map(normalizedToken);
  // Every substantive new concept needs explicit candidate-supplied evidence.
  if (proposed.some(w => !source.has(w))) return false;
  // Negation changes the meaning, even when every other word is present.
  const negation = (value: string) => /\b(?:not|never|no|didn't|don't|cannot|can't|wasn't|weren't)\b/i.test(value);
  if (negation(answer) !== negation(candidate)) return false;
  return true;
}
function safeCopyedit(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : capitalized + ".";
}

export function parseInterviewQuestion(raw: string): InterviewQuestion {
  const data = parse(raw);
  const question = clean(data.question, 400);
  const focus = clean(data.focus, 160);
  if (question.length < 15 || focus.length < 3) throw new Error("Invalid interview question");
  const suggestions = Array.isArray(data.answerStarters) ? data.answerStarters.slice(0, 2).map(item => clean(item, 220)) : [];
  const answerStarters: [string, string] = suggestions.length === 2 && suggestions.every(item => item.length >= 15 && safeStarter(item))
    ? [suggestions[0], suggestions[1]]
    : FALLBACK_STARTERS;
  return { question, focus, answerStarters };
}

export function parseInterviewFeedback(raw: string, originalAnswer = ""): InterviewFeedback {
  const data = parse(raw);
  const strength = clean(data.strength, 400);
  const improvement = clean(data.improvement, 500);
  const example = clean(data.example, 500);
  const followUp = clean(data.followUp, 400);
  if (!strength || !improvement || !followUp) throw new Error("Invalid interview feedback");
  const proposedWording = clean(data.betterWording, 750);
  const whyBetter = clean(data.whyBetter, 280);
  const accepted = groundedRewrite(proposedWording, originalAnswer);
  const betterWording = accepted ? proposedWording : safeCopyedit(originalAnswer).slice(0, 750);
  const explanation = accepted && whyBetter
    ? whyBetter
    : "This keeps your own experience and makes the wording easier to read. Add a real example or result only if it happened.";
  return { strength, improvement, example, followUp, betterWording, whyBetter: betterWording ? explanation : "", wordingStatus: accepted ? "grounded" : "copyedit" };
}
export const INTERVIEW_TOPICS = ["Your experience","How you approach your work","Handling challenges","Working with people","Learning and growth"] as const;
export const MAX_INTERVIEW_TURNS = INTERVIEW_TOPICS.length;
