"use client";
import { useState, type CSSProperties } from "react";
import { MAX_INTERVIEW_TURNS, INTERVIEW_TOPICS, type InterviewFeedback, type InterviewQuestion } from "@/lib/occ/interview";

type SessionState = "ready" | "question" | "feedback" | "finished";
export function OccMockInterview({ cv, jobDescription, onRequestRole }: { cv: string; jobDescription: string; onRequestRole: () => void }) {
  const [status, setStatus] = useState<SessionState>("ready");
  const [turn, setTurn] = useState(0);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
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
    setFeedback(null);
    setCompleted([]);
    setError("");
  }
  return <section aria-label="Mock interview workspace" style={{ ...border, display: "grid", gap: 16 }}>
    <div style={{ display: "grid", gap: 6 }}>
      <p style={{ color: "#7953b3", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>OCC · MOCK INTERVIEW</p>
      <h2 style={{ fontSize: 24, fontWeight: 750 }}>Practice for your next interview</h2>
      <p style={{ opacity: .8 }}>Five guided questions, one at a time. Receive specific feedback on your actual answers, without invented achievements or hiring scores.</p>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <span style={{ border: "1px solid #c8c1d9", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>{roleReady ? "✓ Target role ready" : "Target role needed"}</span>
      <span style={{ border: "1px solid #c8c1d9", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>{cv.trim().length >= 30 ? "✓ Your CV included" : "CV optional"}</span>
      {status !== "ready" && <span style={{ fontSize: 12, alignSelf: "center" }}>Question {Math.min(turn + 1, MAX_INTERVIEW_TURNS)} of {MAX_INTERVIEW_TURNS}</span>}
    </div>
    {!roleReady && <div style={{ ...border, display: "grid", gap: 8 }}>
      <p>Add a target job description in the OCC conversation to personalize your practice.</p>
      <button type="button" onClick={onRequestRole} style={{ justifySelf: "start", padding: "9px 14px", borderRadius: 10, border: "1px solid #c8c1d9", background: "transparent", color: "inherit" }}>Add target role</button>
    </div>}
    {status === "ready" && <div style={{ display: "grid", gap: 10 }}>
      <p style={{ fontSize: 13, opacity: .8 }}>Topics: {INTERVIEW_TOPICS.join(" · ")}</p>
      <button type="button" disabled={!roleReady || busy} onClick={() => void start(0)} style={{ justifySelf: "start", padding: "12px 20px", borderRadius: 12, border: 0, color: "#fff", background: "#7251ae" }}>{busy ? "Preparing interview…" : "Start mock interview"}</button>
    </div>}
    {(status === "question" || status === "feedback") && question && <div style={{ ...border, display: "grid", gap: 12 }}>
      <p style={{ fontSize: 13, opacity: .75 }}>{INTERVIEW_TOPICS[turn]} · Focus: {question.focus}</p>
      <h3 style={{ fontSize: 19, fontWeight: 700 }}>{question.question}</h3>
      <label style={{ display: "grid", gap: 8, fontSize: 14, fontWeight: 600 }}>Your answer
        <textarea aria-label="Your interview answer" disabled={status !== "question"} value={answer} onChange={event => setAnswer(event.target.value)} rows={6} maxLength={4000} placeholder="Explain your approach and use real examples from your own experience." style={{ border: "1px solid #c8c1d9", borderRadius: 12, padding: 12, width: "100%", color: "inherit", background: "transparent", font: "inherit" }} />
      </label>
      {status === "question" && <button type="button" disabled={busy || answer.trim().length < 20} onClick={() => void submitAnswer()} style={{ justifySelf: "start", padding: "11px 17px", borderRadius: 11, border: 0, background: "#7251ae", color: "#fff" }}>{busy ? "Reviewing answer…" : "Get answer feedback"}</button>}
      {status === "feedback" && feedback && <div aria-live="polite" style={{ ...border, display: "grid", gap: 10 }}>
        <h4 style={{ fontSize: 17, fontWeight: 700 }}>Answer feedback</h4>
        <p><strong>What worked:</strong> {feedback.strength}</p>
        <p><strong>What to improve:</strong> {feedback.improvement}</p>
        {feedback.example && <p><strong>Illustrative outline:</strong> {feedback.example}</p>}
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
