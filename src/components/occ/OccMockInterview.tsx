"use client";
import { useState, type CSSProperties } from "react";
import { MAX_INTERVIEW_TURNS, INTERVIEW_TOPICS, type InterviewFeedback, type InterviewQuestion } from "@/lib/occ/interview";

type SessionState = "ready" | "question" | "feedback" | "finished";
export function OccMockInterview({ cv, jobDescription, onUpdateRole }: { cv: string; jobDescription: string; onUpdateRole: (next: string) => void }) {
  const [status, setStatus] = useState<SessionState>("ready");
  const [turn, setTurn] = useState(0);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [showIdeas, setShowIdeas] = useState(false);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<{ question: string; feedback: InterviewFeedback }[]>([]);
  const roleReady = jobDescription.trim().length >= 30;
  const border: CSSProperties = { border: "1px solid #c8c1d9", borderRadius: 16, padding: "clamp(16px, 3vw, 24px)" };
  async function post(mode: "question" | "feedback", index: number, currentQuestion = "", currentAnswer = "") {
    const response = await fetch("/api/occ/interview", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ mode, cv, description: jobDescription, turnIndex: index, ...(mode === "feedback" ? { question: currentQuestion, answer: currentAnswer } : {}) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Interview request failed");
    return data as { question?: InterviewQuestion; feedback?: InterviewFeedback };
  }
  async function start(index: number) {
    if (!roleReady || busy || index >= MAX_INTERVIEW_TURNS) return;
    setBusy(true);
    setError("");
    try {
      const response = await post("question", index);
      if (!response.question) throw new Error("Invalid interview question");
      setQuestion(response.question);
      setAnswer("");
      setShowIdeas(false);
      setFeedback(null);
      setTurn(index);
      setStatus("question");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not start the interview"); }
    finally { setBusy(false); }
  }
  async function submitAnswer() {
    if (busy || status !== "question" || !question || answer.trim().length < 20) return;
    setBusy(true);
    setError("");
    try {
      const response = await post("feedback", turn, question.question, answer);
      if (!response.feedback) throw new Error("Invalid interview feedback");
      setFeedback(response.feedback);
      setCompleted(previous => [...previous, { question: question.question, feedback: response.feedback! }]);
      setStatus("feedback");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not review your answer"); }
    finally { setBusy(false); }
  }
  function restart() {
    setStatus("ready");
    setTurn(0);
    setQuestion(null);
    setAnswer("");
    setShowIdeas(false);
    setFeedback(null);
    setCompleted([]);
    setError("");
  }
  return <section aria-label="Mock interview workspace" style={{ ...border, display: "grid", gap: 16 }}>
    <div style={{ display: "grid", gap: 6 }}>
      <p style={{ color: "#7953b3", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>OCC · MOCK INTERVIEW</p>
      <h2 style={{ fontSize: 24, fontWeight: 750 }}>Practice for your next interview</h2>
      <p style={{ opacity: .8 }}>Five simple practice questions for your field of work. Answer naturally; OCC helps you say what you mean clearly, without making up achievements.</p>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <span style={{ border: "1px solid #c8c1d9", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>{roleReady ? "✓ Target role ready" : "Target role needed"}</span>
      <span style={{ border: "1px solid #c8c1d9", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>{cv.trim().length >= 30 ? "✓ Your CV included" : "CV optional"}</span>
      {status !== "ready" && <span style={{ fontSize: 12, alignSelf: "center" }}>Question {Math.min(turn + 1, MAX_INTERVIEW_TURNS)} of {MAX_INTERVIEW_TURNS}</span>}
    </div>
    {!roleReady && <label style={{ ...border, display: "grid", gap: 8, fontSize: 14, fontWeight: 600 }}>Target role description
      <textarea aria-label="Interview target role" rows={4} maxLength={15000} value={jobDescription} onChange={event => onUpdateRole(event.target.value)} placeholder="Paste the responsibilities and requirements of the target role." style={{ border: "1px solid #c8c1d9", borderRadius: 12, padding: 12, font: "inherit", color: "inherit", background: "transparent" }} />
      <span style={{ fontSize: 12, fontWeight: 400, opacity: .7 }}>Your CV is optional. No interview questions are generated until you select Start.</span>
    </label>}
    {status === "ready" && <div style={{ display: "grid", gap: 10 }}>
      <p style={{ fontSize: 13, opacity: .8 }}>Topics: {INTERVIEW_TOPICS.join(" · ")}</p>
      <button type="button" disabled={!roleReady || busy} onClick={() => void start(0)} style={{ justifySelf: "start", padding: "12px 20px", borderRadius: 12, border: 0, color: "#fff", background: "#7251ae" }}>{busy ? "Preparing interview…" : "Start mock interview"}</button>
    </div>}
    {(status === "question" || status === "feedback") && question && <div style={{ ...border, display: "grid", gap: 12 }}>
      <p style={{ fontSize: 13, opacity: .75 }}>{INTERVIEW_TOPICS[turn]} · Focus: {question.focus}</p>
      <h3 style={{ fontSize: 19, fontWeight: 700 }}>{question.question}</h3>
      {status === "question" && <div style={{ display: "grid", gap: 8 }}>
        <p style={{ fontSize: 13, opacity: .85 }}>There is no perfect answer. Say what you would genuinely do, in your own words.</p>
        <button type="button" onClick={() => setShowIdeas(value => !value)} aria-expanded={showIdeas} style={{ justifySelf: "start", border: "1px solid #c8c1d9", borderRadius: 10, background: "transparent", color: "inherit", padding: "8px 12px", fontSize: 13 }}>{showIdeas ? "Hide answer ideas" : "Need help? See 2 answer ideas"}</button>
        {showIdeas && <div aria-label="Answer ideas" style={{ display: "grid", gap: 8 }}>
          {(question.answerStarters ?? ["Describe what you did and why it mattered, using a real example.", "Walk through your approach step by step, based on your own experience."]).map((idea, index) =>
            <div key={index} style={{ border: "1px solid #c8c1d9", borderRadius: 12, padding: "10px 12px", fontSize: 13 }}>
              <strong>Idea {index + 1}:</strong> {idea}
            </div>)}
          <p style={{ fontSize: 12, opacity: .75 }}>These are starting points, not claims about you. Use only what is true for your experience.</p>
        </div>}
      </div>}
      <label style={{ display: "grid", gap: 8, fontSize: 14, fontWeight: 600 }}>Your answer
        <textarea aria-label="Your interview answer" disabled={false} value={answer} onChange={event => setAnswer(event.target.value)} rows={6} maxLength={4000} placeholder="Write how you would say it to someone. Short, simple sentences are fine." style={{ border: "1px solid #c8c1d9", borderRadius: 12, padding: 12, width: "100%", color: "inherit", background: "transparent", font: "inherit" }} />
      </label>
      {status === "question" && <button type="button" disabled={busy || answer.trim().length < 20} onClick={() => void submitAnswer()} style={{ justifySelf: "start", padding: "11px 17px", borderRadius: 11, border: 0, background: "#7251ae", color: "#fff" }}>{busy ? "Reviewing answer…" : "Get answer feedback"}</button>}
      {status === "feedback" && feedback && <div aria-live="polite" style={{ ...border, display: "grid", gap: 10 }}>
        <h4 style={{ fontSize: 17, fontWeight: 700 }}>Answer feedback</h4>
        <p><strong>What worked:</strong> {feedback.strength}</p>
        <p><strong>One way to improve:</strong> {feedback.improvement}</p>
        {feedback.betterWording && <div style={{ display: "grid", gap: 7, border: "1px solid #c8c1d9", borderRadius: 12, padding: 12 }}>
          <strong>{feedback.wordingStatus === "copyedit" ? "Your answer, lightly polished" : "A clearer way to say your answer"}</strong>
          <p aria-label="Suggested clearer answer" style={{ whiteSpace: "pre-wrap" }}>{feedback.betterWording}</p>
          {feedback.whyBetter && <p style={{ fontSize: 13 }}><strong>Why this works better:</strong> {feedback.whyBetter}</p>}
          <button type="button" onClick={() => setAnswer(feedback.betterWording!)} style={{ justifySelf: "start", border: "1px solid #c8c1d9", borderRadius: 10, padding: "8px 12px", background: "transparent", color: "inherit" }}>Try this wording in my answer</button>
          <p style={{ fontSize: 12, opacity: .75 }}>Only your original answer is treated as evidence. Check the wording and change anything that does not reflect your experience.</p>
        </div>}
        {feedback.example && <details><summary style={{ cursor: "pointer", fontSize: 13 }}>Another way to organize your answer</summary><p style={{ paddingTop: 8 }}>{feedback.example}</p></details>}
        <p><strong>Follow-up to consider:</strong> {feedback.followUp}</p>
        {turn + 1 < MAX_INTERVIEW_TURNS
          ? <button type="button" disabled={busy} onClick={() => void start(turn + 1)} style={{ justifySelf: "start", padding: "11px 17px", borderRadius: 11, border: 0, background: "#7251ae", color: "#fff" }}>{busy ? "Preparing next question…" : "Next question"}</button>
          : <button type="button" onClick={() => setStatus("finished")} style={{ justifySelf: "start", padding: "11px 17px", borderRadius: 11, border: 0, background: "#7251ae", color: "#fff" }}>Finish interview</button>}
      </div>}
    </div>}
    {status === "finished" && <div aria-live="polite" style={{ ...border, display: "grid", gap: 10 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700 }}>Practice complete</h3>
      <p>You practiced {completed.length} questions. Your feedback is visible in this browser session only and is not saved automatically.</p>
      <ul style={{ paddingLeft: 20 }}>{completed.map((entry, index) => <li key={index}><strong>{INTERVIEW_TOPICS[index]}:</strong> {entry.feedback.improvement}</li>)}</ul>
      <button type="button" onClick={restart} style={{ justifySelf: "start", padding: "10px 16px", borderRadius: 11, border: "1px solid #c8c1d9", background: "transparent", color: "inherit" }}>Practice again</button>
    </div>}
    {error && <p role="alert" style={{ color: "#b44444" }}>{error}</p>}
    <p style={{ fontSize: 12, opacity: .7 }}>AI feedback is coaching, not a prediction of interview performance or hiring. Questions and answers are not stored by this feature.</p>
  </section>;
}
