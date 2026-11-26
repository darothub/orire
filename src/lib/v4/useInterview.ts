"use client";

import { useState } from "react";
import type { InterviewFeedback, InterviewQuestion } from "@/lib/occ/interview";
import { TURNS } from "./interview";
import { fetchFeedback, fetchQuestion } from "./interviewApi";

export type InterviewPhase = "idle" | "asking" | "question" | "reviewing" | "feedback" | "done";

interface Context { description: string; cv: string }

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
      setQuestion(await fetchQuestion(ctx, turn));
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
      setFeedback(await fetchFeedback(ctx, index, question.question, answer));
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
