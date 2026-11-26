import type { InterviewFeedback, InterviewQuestion } from "@/lib/occ/interview";
import { feedbackRequest, questionRequest } from "./interview";

interface Context { description: string; cv: string }

async function post<T>(body: unknown, fallback: string): Promise<T> {
  const response = await fetch("/api/occ/interview", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : fallback);
  return data as T;
}

/** The interview API client, shared by the v4 Interview page and the Copilot. */
export async function fetchQuestion(ctx: Context, turn: number): Promise<InterviewQuestion> {
  return (await post<{ question: InterviewQuestion }>(questionRequest(ctx, turn), "Could not start the interview.")).question;
}

export async function fetchFeedback(ctx: Context, turn: number, question: string, answer: string): Promise<InterviewFeedback> {
  return (await post<{ feedback: InterviewFeedback }>(feedbackRequest(ctx, turn, question, answer), "Could not review your answer.")).feedback;
}
