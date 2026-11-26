"use client";

import { useState } from "react";
import type { InterviewFeedback, InterviewQuestion } from "@/lib/occ/interview";
import { feedbackRequest, questionRequest, TURNS } from "./interview";

export type InterviewPhase = "idle" | "asking" | "question" | "reviewing" | "feedback" | "done";

interface Context { description: string; cv: string }

async function post<T>(body: unknown, fallback: string): Promise<T> {
  const response = await fetch("/api/occ/interview", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : fallback);
  return data as T;
}

/**
 * One practice run: five topics, one question at a time, feedback on each
 * answer. Same API and allowance as the Copilot's Interview Coach.
 */
export function useInterview(ctx: Context) {
  const [phase, setPhase] = useState<InterviewPhase>("idle");
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  async function ask(turn: number) {
    setError("");
    setPhase("asking");
    setFeedback(null);
    setAnswer("");
    try {
      const data = await post<{ question: InterviewQuestion }>(questionRequest(ctx, turn), "Could not start the interview.");
      setQuestion(data.question);
      setIndex(turn);
      setPhase("question");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Interview coaching failed. Try again.");
      // Stay where we were: a failed first question returns to the start.
      setPhase(question ? "question" : "idle");
    }
  }

  async function submit() {
    if (!question) return;
    setError("");
    setPhase("reviewing");
    try {
      const data = await post<{ feedback: InterviewFeedback }>(feedbackRequest(ctx, index, question.question, answer), "Could not review your answer.");
      setFeedback(data.feedback);
      setPhase("feedback");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Interview coaching failed. Try again.");
      setPhase("question");
    }
  }

  function next() {
    if (index + 1 >= TURNS) return setPhase("done");
    void ask(index + 1);
  }

  /** Back to the same question with the answer kept, to improve it. */
  function retry() {
    setFeedback(null);
    setError("");
    setPhase("question");
  }

  function restart() {
    setQuestion(null);
    setFeedback(null);
    setAnswer("");
    setError("");
    setIndex(0);
    setPhase("idle");
  }

  return { phase, index, question, feedback, answer, error, setAnswer, start: () => ask(0), submit, next, retry, skip: next, restart };
}
