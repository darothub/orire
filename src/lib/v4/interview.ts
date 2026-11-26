import { INTERVIEW_TOPICS, MAX_INTERVIEW_TURNS } from "@/lib/occ/interview";

/** The interview API rejects answers shorter than this, so the page does too. */
export const ANSWER_MIN = 20;
export const ANSWER_MAX = 4000;
/** The API needs a job description of at least this length. */
export const JD_MIN = 30;

export const TOPICS = INTERVIEW_TOPICS;
export const TURNS = MAX_INTERVIEW_TURNS;

export const hasRole = (jd: string) => jd.trim().length >= JD_MIN;
export const answerReady = (answer: string) => answer.trim().length >= ANSWER_MIN && answer.length <= ANSWER_MAX;

interface Context { description: string; cv: string }

export function questionRequest(ctx: Context, turnIndex: number) {
  return { mode: "question" as const, description: ctx.description, ...(ctx.cv ? { cv: ctx.cv } : {}), turnIndex };
}

export function feedbackRequest(ctx: Context, turnIndex: number, question: string, answer: string) {
  return { mode: "feedback" as const, description: ctx.description, ...(ctx.cv ? { cv: ctx.cv } : {}), question, answer, turnIndex };
}

/** "Question 2 of 5" and the topic it covers. */
export function stepLabel(index: number): { label: string; topic: string } {
  return { label: `Question ${index + 1} of ${TURNS}`, topic: TOPICS[index] ?? "" };
}
