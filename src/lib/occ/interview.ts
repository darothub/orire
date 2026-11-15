/** Validate AI interview outputs before showing them to the user.
 * The interviewer coaches against the answer, not a hiring prediction.
 */
export type InterviewQuestion = { question: string; focus: string };
export type InterviewFeedback = { strength: string; improvement: string; example: string; followUp: string };
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
  return { question, focus };
}
export function parseInterviewFeedback(raw: string): InterviewFeedback {
  const data = parse(raw);
  const strength = clean(data.strength, 400);
  const improvement = clean(data.improvement, 500);
  const example = clean(data.example, 500);
  const followUp = clean(data.followUp, 400);
  if (!strength || !improvement || !followUp) throw new Error("Invalid interview feedback");
  return { strength, improvement, example, followUp };
}
export const INTERVIEW_TOPICS = ["Experience and impact","Technical decisions","Problem solving","Collaboration","Reflection"] as const;
export const MAX_INTERVIEW_TURNS = INTERVIEW_TOPICS.length;
