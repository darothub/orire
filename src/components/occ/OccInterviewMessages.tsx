"use client";

import { useState } from "react";
import { INTERVIEW_TOPICS, MAX_INTERVIEW_TURNS, type InterviewFeedback, type InterviewQuestion } from "@/lib/occ/interview";

export function OccInterviewQuestionMessage({
  question, index, awaitingAnswer,
}: { question: InterviewQuestion; index: number; awaitingAnswer: boolean }) {
  const [showIdeas, setShowIdeas] = useState(false);
  return <section className="occ2-interview-card" aria-label="Interview coach question">
    <p className="occ2-interview-eyebrow">Interview Coach · Question {index + 1} of {MAX_INTERVIEW_TURNS}</p>
    <p className="occ2-interview-topic">{INTERVIEW_TOPICS[index]} · {question.focus}</p>
    <h3>{question.question}</h3>
    <p className="occ2-interview-helper">{awaitingAnswer ? "Answer using the main chat composer below. Describe only what you genuinely did or would do." : "Interview question"}</p>
    <button className="occ2-quiet-action" type="button" aria-expanded={showIdeas} onClick={() => setShowIdeas(value => !value)}>
      {showIdeas ? "Hide answer starters" : "See 2 answer starters"}
    </button>
    {showIdeas && <div aria-label="Answer ideas" className="occ2-interview-ideas">
      {(question.answerStarters ?? [
        "Describe how you would approach the situation and why.",
        "Use a genuine example: what happened and what did you learn?",
      ]).map((idea, i) => <p key={i}><strong>Idea {i + 1}:</strong> {idea}</p>)}
      <p className="occ2-interview-helper">Ideas are examples, not verified statements about your experience.</p>
    </div>}
  </section>;
}

export function OccInterviewFeedbackMessage({
  feedback, onUseWording, onNext, onRestart, isLatest, hasNext, busy,
}: {
  feedback: InterviewFeedback; onUseWording: (text: string) => void;
  onNext: () => void; onRestart: () => void; isLatest: boolean;
  hasNext: boolean; busy: boolean;
}) {
  return <section className="occ2-interview-card" aria-label="Interview coach feedback">
    <p className="occ2-interview-eyebrow">Interview Coach · Feedback</p>
    <h3>How your answer came across</h3>
    <div><strong>What worked</strong><p>{feedback.strength}</p></div>
    <div><strong>One improvement</strong><p>{feedback.improvement}</p></div>
    {feedback.betterWording && <details>
      <summary>Suggested clearer wording</summary>
      <blockquote>{feedback.betterWording}</blockquote>
      {feedback.whyBetter && <p>{feedback.whyBetter}</p>}
      <p className="occ2-interview-helper">This is an example grounded in your answer, not an independently verified claim. Confirm all details yourself.</p>
      {isLatest && <button type="button" className="occ2-quiet-action" onClick={() => onUseWording(feedback.betterWording!)}>Edit this wording in composer</button>}
    </details>}
    {feedback.example && <details><summary>Another way to structure your answer</summary><p>{feedback.example}</p></details>}
    <p><strong>Follow-up to consider:</strong> {feedback.followUp}</p>
    {isLatest && <div className="occ2-interview-actions">
      {hasNext
        ? <button type="button" disabled={busy} onClick={onNext}>{busy ? "Preparing…" : "Next question"}</button>
        : <button type="button" disabled={busy} onClick={onRestart}>Finish / practice again</button>}
    </div>}
    <p className="occ2-interview-helper">Practice feedback is not a hiring prediction. Answers and feedback remain in this browser session unless separately saved with informed consent.</p>
  </section>;
}
