/** Validate AI interview outputs before showing them to the user.
 * The interviewer coaches against the answer, not a hiring prediction.
 */
export type InterviewQuestion = { question: string; focus: string; answerStarters?: [string, string] };
export type InterviewFeedback = { strength: string; improvement: string; example: string; followUp: string; betterWording?: string; whyBetter?: string };
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const clean = (value: unknown, max: number): string => typeof value === "string" ? value.trim().slice(0,max) : "";
function parse(raw: string): Record<string,unknown> {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Invalid interview response"); }
  if (!isRecord(value)) throw new Error("Invalid interview response");
  return value;
}
export function parseInterviewQuestion(raw: string): InterviewQuestion {
  const data = parse(raw);
  const question = clean(data.question, 400);
  const focus = clean(data.focus, 160);
  if (question.length < 15 || focus.length < 3) throw new Error("Invalid interview question");
  const suggestions = Array.isArray(data.answerStarters) ? data.answerStarters.slice(0, 2).map(item => clean(item, 220)) : [];
  const answerStarters: [string, string] = suggestions.length === 2 && suggestions.every(item => item.length >= 15)
    ? [suggestions[0], suggestions[1]]
    : ["I would explain the situation, what I personally did, and what happened next.", "I would describe my approach step by step, then share a real example if I have one."];
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
  // Refuse unverified numeric claims in suggested wording. Never treat examples as facts.
  const numbers = proposedWording.match(/\\b\\d+(?:[.,]\\d+)*(?:%|\\b)/g) ?? [];
  const betterWording = numbers.every(num => originalAnswer.includes(num))
    ? proposedWording : "";
  return { strength, improvement, example, followUp, betterWording, whyBetter: betterWording ? whyBetter : "" };
}
export const INTERVIEW_TOPICS = ["Experience and impact","Technical decisions","Problem solving","Collaboration","Reflection"] as const;
export const MAX_INTERVIEW_TURNS = INTERVIEW_TOPICS.length;
