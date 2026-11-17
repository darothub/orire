"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { cvToPlainText } from "@/lib/export/plaintext";
import type { CVData } from "@/lib/cv/schema";
import { looksLikeCV, looksLikeJobDescription } from "@/lib/occ/document-validation";
import type { OccAdvice } from "@/lib/occ/recommendations";
import { MAX_INTERVIEW_TURNS, type InterviewQuestion, type InterviewFeedback } from "@/lib/occ/interview";
import "./occ3.css";

type Agent = "review" | "coach" | "interview" | "improve" | "memory";
type Mode = "start" | "choice" | "awaiting-jd" | "ready";
type Message = { id: number; role: "you" | "occ"; text?: string; file?: string; advice?: OccAdvice; mode?: "general" | "targeted" | "coaching"; choice?: boolean; coachChoice?: boolean; jdPrompt?: boolean; interviewQuestion?: InterviewQuestion; interviewFeedback?: InterviewFeedback; interviewNumber?: number };
type SavedCV = { id: string; title: string; data: CVData };
const AGENTS: { id: Agent; name: string }[] = [
  { id: "review", name: "Review" }, { id: "coach", name: "Coach" },
  { id: "interview", name: "Interview" }, { id: "improve", name: "Improve CV" },
  { id: "memory", name: "Career Memory" },
];
let nextId = 1;
function message(role: Message["role"], details: Omit<Message, "id" | "role">): Message {
  return { id: nextId++, role, ...details };
}

export function Occ3Preview() {
  const [agent, setAgent] = useState<Agent>("review");
  const [mode, setMode] = useState<Mode>("start");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [cv, setCv] = useState("");
  const [cvName, setCvName] = useState("");
  const [jd, setJd] = useState("");
  const [jdName, setJdName] = useState("");
  const [attached, setAttached] = useState<"cv" | "jd" | null>(null);
  const [menu, setMenu] = useState(false);
  const [agentMenu, setAgentMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [savedCvs, setSavedCvs] = useState<SavedCV[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [coachGoal, setCoachGoal] = useState("");
  const coachGeneration = useRef(0);
  const [interviewPhase, setInterviewPhase] = useState<"idle" | "question" | "feedback">("idle");
  const [interviewQuestion, setInterviewQuestion] = useState<InterviewQuestion | null>(null);
  const [interviewIndex, setInterviewIndex] = useState(0);
  const interviewGeneration = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    void fetch("/api/occ/versions", { cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (current) setSavedCvs(data.documents ?? []); })
      .catch(() => {});
    return () => { current = false; };
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages.length]);

  const append = (...entries: Message[]) => setMessages(old => [...old, ...entries]);
  const canSend = !busy && Boolean(draft.trim() || attached);
  const cvReady = cv.trim().length >= 30;
  const isJDStep = mode === "awaiting-jd";

  function reset() {
    setMessages([]); setMode("start"); setDraft(""); setCv(""); setCvName("");
    setJd(""); setJdName(""); setAgent("review"); setAttached(null); setError("");
    setMenu(false); setAgentMenu(false); setSidebarOpen(false); setBusy(false);
    interviewGeneration.current++; coachGeneration.current++; setCoachGoal(""); setInterviewPhase("idle"); setInterviewQuestion(null); setInterviewIndex(0);
  }
  function chooseSaved(item: SavedCV) {
    setCv(cvToPlainText(item.data)); setCvName(item.title); setAttached("cv");
    setMenu(false); setError("");
  }
  async function parseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || busy) return;
    const kind = isJDStep ? "jd" : "cv";
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "docx", "txt"].includes(ext)) { setError("Choose a PDF, DOCX or TXT file."); return; }
    if (file.size === 0 || file.size > (ext === "txt" ? 1024 * 1024 : 15 * 1024 * 1024)) { setError("File is empty or too large."); return; }
    setBusy(true); setError(""); setMenu(false);
    try {
      let content: string;
      if (ext === "txt") content = await file.text();
      else {
        const form = new FormData(); form.append("files", file);
        const response = await fetch("/api/parse", { method: "POST", body: form, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || typeof payload.files?.[0]?.text !== "string")
          throw new Error(payload.files?.[0]?.error || "Could not read the file.");
        content = payload.files[0].text;
      }
      const text = content.trim();
      const limit = kind === "cv" ? 30000 : 15000;
      if (text.length < 30 || text.length > limit) throw new Error("Document text must be between 30 and " + limit + " characters.");
      if (kind === "cv" && !looksLikeCV(text)) throw new Error("This file does not appear to contain a CV.");
      if (kind === "jd" && !looksLikeJobDescription(text)) throw new Error("This file does not appear to contain a job description.");
      if (kind === "cv") { setCv(text); setCvName(file.name); }
      else { setJd(text); setJdName(file.name); }
      setAttached(kind);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read document.");
    } finally { setBusy(false); }
  }

  async function review(kind: "general" | "targeted", roleText?: string) {
    if (!cvReady) { setError("Attach a CV first."); return; }
    setBusy(true); setError("");
    try {
      const url = kind === "general" ? "/api/occ/general-review" : "/api/occ/advise";
      const response = await fetch(url, {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "general" ? { cv } : { cv, description: roleText ?? jd, saveRun: false, useSavedProfile: false }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.advice) throw new Error(payload.error || "Review unavailable.");
      append(message("occ", {
        text: kind === "general" ? "Here's your general CV review." : "Here's your CV review against the role you shared.",
        advice: payload.advice as OccAdvice, mode: kind,
      }));
      setMode("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review unavailable.");
    } finally { setBusy(false); }
  }
  async function runCoach(goal: string, roleText = "") {
    if (busy || !cvReady) return;
    const cleanGoal = goal.trim();
    if (cleanGoal.length < 5 || cleanGoal.length > 500) { setError("Describe your goal in 5 to 500 characters."); return; }
    const generation = ++coachGeneration.current;
    setBusy(true); setError(""); setCoachGoal(cleanGoal);
    try {
      const response = await fetch("/api/occ/coach", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, goal: cleanGoal, ...(roleText ? { description: roleText } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.advice) throw new Error(payload.error || "Coaching unavailable.");
      if (generation !== coachGeneration.current) return;
      append(message("occ", { text: "Here is a practical way forward.", advice: payload.advice as OccAdvice, mode: "coaching" }));
      setMode("ready");
    } catch (cause) {
      if (generation === coachGeneration.current) setError(cause instanceof Error ? cause.message : "Coaching unavailable.");
    } finally { if (generation === coachGeneration.current) setBusy(false); }
  }
  function chooseCoachGoal(goal: string) {
    if (busy || !cvReady) return;
    append(message("you", { text: goal }));
    void runCoach(goal);
  }
  function afterCV(file?: string) {
    const isInterview = agent === "interview";
    const isCoach = agent === "coach";
    append(message("you", { text: draft.trim() || undefined, file: file || cvName || "CV" }),
      message("occ", isInterview
        ? { text: "I've received your CV. Paste or attach a job description for the mock interview.", jdPrompt: true }
        : isCoach
          ? { text: "I've received your CV. What career goal would you like help with? Choose an option or describe it below.", coachChoice: true }
          : { text: "I've received your CV. Would you like a general review, or should I review it against a specific job description?", choice: true }));
    setMode(isInterview ? "awaiting-jd" : "choice"); setDraft(""); setAttached(null);
  }
  function chooseJD() {
    append(message("you", { text: "I have a job description" }),
      message("occ", { text: "Great. Paste the job description into the chat or attach a PDF, DOCX or TXT file.", jdPrompt: true }));
    setMode("awaiting-jd");
    setAttached(null); setDraft(""); setAgent("review");
  }

  async function askInterviewQuestion(index: number, description: string) {
    if (busy || index >= MAX_INTERVIEW_TURNS) return;
    const generation = ++interviewGeneration.current;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/occ/interview", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "question", cv, description, turnIndex: index }),
      });
      const data = await response.json();
      if (!response.ok || !data.question) throw new Error(data.error || "Unable to prepare interview question.");
      if (generation !== interviewGeneration.current) return;
      const question = data.question as InterviewQuestion;
      setInterviewQuestion(question); setInterviewIndex(index); setInterviewPhase("question"); setMode("ready");
      append(message("occ", { text: "Question " + (index + 1) + " of " + MAX_INTERVIEW_TURNS, interviewQuestion: question, interviewNumber: index + 1 }));
    } catch (cause) {
      if (generation === interviewGeneration.current) setError(cause instanceof Error ? cause.message : "Interview unavailable.");
    } finally { if (generation === interviewGeneration.current) setBusy(false); }
  }
  async function respondToInterview(answer: string) {
    if (!interviewQuestion || answer.length < 20 || busy) {
      setError("Use at least 20 characters to answer the question in your own words."); return;
    }
    const generation = ++interviewGeneration.current;
    const question = interviewQuestion;
    append(message("you", { text: answer })); setDraft(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/occ/interview", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "feedback", cv, description: jd, question: question.question, answer, turnIndex: interviewIndex }),
      });
      const data = await response.json();
      if (!response.ok || !data.feedback) throw new Error(data.error || "Unable to evaluate answer.");
      if (generation !== interviewGeneration.current) return;
      setInterviewPhase("feedback");
      append(message("occ", { text: "Here's your interview feedback.", interviewFeedback: data.feedback as InterviewFeedback, interviewNumber: interviewIndex + 1 }));
    } catch (cause) {
      if (generation !== interviewGeneration.current) return;
      setError(cause instanceof Error ? cause.message : "Feedback unavailable.");
      append(message("occ", { text: "I couldn't evaluate that answer. Please try again with your own words." }));
    } finally { if (generation === interviewGeneration.current) setBusy(false); }
  }
  function selectAgent(next: Agent) {
    if (busy) return;
    setAgentMenu(false);
    if (next === agent) return;
    interviewGeneration.current++; coachGeneration.current++; setInterviewPhase("idle"); setInterviewQuestion(null); setInterviewIndex(0);
    setAgent(next);
    if (next === "coach" && cvReady && mode !== "start") {
      append(message("occ", { text: "Coach selected. What would you like help with? Choose a goal or describe it in your own words.", coachChoice: true }));
      setMode("choice");
    } else if (next === "interview" && cvReady && mode !== "start") {
      if (looksLikeJobDescription(jd)) {
        append(message("occ", { text: "Interview selected. I have the CV and job description. Type Start interview and press Send." }));
        setMode("ready");
      } else {
        append(message("occ", { text: "Interview selected. Paste or attach the target job description to begin.", jdPrompt: true }));
        setMode("awaiting-jd");
      }
    } else if ((agent === "interview" || agent === "coach") && next === "review" && cvReady && mode === "awaiting-jd") {
      append(message("occ", { text: "Review selected. Would you prefer a general or job-specific review?", choice: true }));
      setMode("choice");
    }
  }
  async function send() {
    if (!canSend) return;
    if (!cvReady) { setError("Attach your CV using the paperclip before sending."); return; }
    if (mode === "start" || (mode === "choice" && attached === "cv")) { afterCV(cvName); return; }
    if (agent === "coach" && mode === "choice" && draft.trim() && attached !== "jd") {
      const goal = draft.trim();
      if (goal.length < 5 || goal.length > 500) { setError("Describe your goal in 5 to 500 characters."); return; }
      append(message("you", { text: goal })); setDraft("");
      await runCoach(goal); return;
    }
    if (agent === "interview" && interviewPhase === "question") {
      await respondToInterview(draft.trim()); return;
    }
    if (agent === "interview" && interviewPhase === "feedback") {
      setError("Use Next question in the conversation to continue."); return;
    }
    if (agent === "interview" && mode === "ready" && looksLikeJobDescription(jd)) {
      append(message("you", { text: draft.trim() || "Start interview" })); setDraft("");
      await askInterviewQuestion(0, jd); return;
    }
    if (isJDStep) {
      const roleText = attached === "jd" ? jd : draft.trim();
      if (roleText.length < 30 || !looksLikeJobDescription(roleText)) {
        setError("Provide a job description with at least 30 characters and role responsibilities.");
        return;
      }
      setJd(roleText);
      append(message("you", { text: attached === "jd" ? undefined : draft.trim(), file: attached === "jd" ? jdName : undefined }));
      setDraft(""); setAttached(null);
      if (agent === "interview") await askInterviewQuestion(0, roleText);
      else if (agent === "coach") await runCoach(coachGoal || "Help me prepare for this target role", roleText);
      else await review("targeted", roleText);
      return;
    }
    const text = draft.trim();
    if (!text) return;
    if (agent === "coach") {
      if (text.length < 5 || text.length > 500) { setError("Describe your goal in 5 to 500 characters."); return; }
      append(message("you", { text })); setDraft("");
      await runCoach(text, looksLikeJobDescription(jd) ? jd : "");
      return;
    }
    setDraft("");
    append(message("you", { text }),
      message("occ", { text: agent === "review"
        ? "To run a new role-specific review, share a job description. You can also choose General review for CV-only feedback."
        : agent === "interview" || agent === "coach"
          ? "Interview coaching uses a target role. Share the job description and I'll help you prepare one question at a time."
          : agent === "improve"
            ? "I can help improve wording from your CV. We'll only suggest evidence-based changes; you choose what to accept."
            : "Career Memory remains private and opt-in. We won't save your CV or this chat automatically." }));
    if (agent === "interview") setMode("awaiting-jd");
  }
  return <div className="occ3-shell">
    <aside className={"occ3-sidebar " + (sidebarOpen ? "occ3-sidebar-open" : "")} aria-label="OCC preview conversations">
      <div className="occ3-brand"><span className="occ3-brand-mark">✦</span><span><strong>Orire</strong><small>Career Copilot <b>OCC</b></small></span></div>
      <button type="button" className="occ3-new" onClick={reset}>＋ &nbsp; New chat</button>
      <p className="occ3-history-title">CURRENT PREVIEW</p>
      <div className="occ3-history"><span>◌</span> New conversation</div>
      <p className="occ3-preview-note">Preview chats are not saved. Existing OCC conversations remain available in the current app.</p>
      <div className="occ3-sidebar-bottom"><span className="occ3-avatar">OA</span><span>Orire Applicant</span></div>
    </aside>
    <main className="occ3-main">
      <header className="occ3-top"><button type="button" className="occ3-mobile-menu" onClick={() => setSidebarOpen(value => !value)} aria-label="Toggle conversation sidebar">☰</button><span>Career Copilot <b>PREVIEW</b></span><a href="/occ">Current OCC</a></header>
      <div className="occ3-thread" role="region" aria-label="OCC 3.0 conversation">
        {messages.length === 0 && <div className="occ3-hero">
          <div className="occ3-flower" aria-hidden="true">✦</div>
          <h1>Orire <span>Career Copilot</span></h1>
          <p>Your AI partner for CV review, interview preparation,<br className="occ3-desktop-only"/> CV improvement and career planning.</p>
          <div className="occ3-hint">Start by attaching your CV using the paperclip below.</div>
        </div>}
        {messages.map(entry => <div key={entry.id} className={"occ3-message occ3-" + entry.role}>
          <div className="occ3-message-icon">{entry.role === "occ" ? "✦" : "OA"}</div>
          <div className="occ3-message-content">
            {entry.file && <div className="occ3-file"><span aria-hidden="true">▤</span><div><strong>{entry.file}</strong><small>Document shared</small></div><span aria-label="Attached">✓</span></div>}
            {entry.text && <p>{entry.text}</p>}
            {entry.choice && mode === "choice" && <div className="occ3-choices">
              <button type="button" onClick={() => { append(message("you", { text: "General review" })); void review("general"); }} disabled={busy}>General review</button>
              <button type="button" onClick={chooseJD} disabled={busy}>I have a job description</button>
            </div>}
            {entry.jdPrompt && mode === "awaiting-jd" && <div className="occ3-jd-tip">Paste a job description below, or use the paperclip to attach one.</div>}
            {entry.coachChoice && agent === "coach" && mode === "choice" && <div className="occ3-choices" aria-label="Coaching goals">
              <button type="button" disabled={busy} onClick={() => chooseCoachGoal("Help me plan my next career step")}>Career direction</button>
              <button type="button" disabled={busy} onClick={() => chooseCoachGoal("Help me identify skills I should develop")}>Skills to develop</button>
              <button type="button" disabled={busy} onClick={() => chooseCoachGoal("Help me communicate my work experience more confidently")}>Explain my experience</button>
              <button type="button" disabled={busy} onClick={() => {
                setCoachGoal("Help me prepare for this target role"); setMode("awaiting-jd");
                append(message("occ", { text: "Share the job description in the composer, or attach it with the paperclip. I'll tailor the coaching to it.", jdPrompt: true }));
              }}>I have a target role</button>
            </div>}

            {entry.interviewQuestion && <section role="region" aria-label={"Interview question " + entry.interviewNumber} className="occ3-interview-card">
              <p className="occ3-interview-question">{entry.interviewQuestion.question}</p>
              <small>Focus: {entry.interviewQuestion.focus}</small>
              {entry.interviewQuestion.answerStarters && <details><summary>Two suggested answer approaches</summary>
                <ol>{entry.interviewQuestion.answerStarters.map((starter, i) => <li key={i}>{starter}</li>)}</ol>
                <small>Outlines only — use your real experience, not invented claims.</small>
              </details>}
              <small>Write your answer in the composer below.</small>
            </section>}
            {entry.interviewFeedback && <section role="region" aria-label={"Interview feedback " + entry.interviewNumber} className="occ3-interview-card">
              <strong>What worked</strong><p>{entry.interviewFeedback.strength}</p>
              <strong>What to improve</strong><p>{entry.interviewFeedback.improvement}</p>
              {entry.interviewFeedback.betterWording && <details><summary>Clearer wording suggestion</summary><p>{entry.interviewFeedback.betterWording}</p><small>{entry.interviewFeedback.whyBetter}</small></details>}
              {entry.interviewFeedback.followUp && <small>Consider: {entry.interviewFeedback.followUp}</small>}
              {agent === "interview" && interviewPhase === "feedback" && entry.interviewNumber === interviewIndex + 1 &&
                (interviewIndex + 1 < MAX_INTERVIEW_TURNS
                  ? <button type="button" className="occ3-next-question" disabled={busy} onClick={() => void askInterviewQuestion(interviewIndex + 1, jd)}>Next question</button>
                  : <small>Practice complete. Start a new chat for another session.</small>)}
            </section>}
            {entry.advice && <section className="occ3-review" aria-label={entry.mode === "coaching" ? "Career coaching guidance" : entry.mode === "general" ? "General CV review" : "Targeted CV review"}>
              <div className="occ3-review-title"><strong>{entry.mode === "coaching" ? "Career coaching" : "CV Review"}</strong><span>{entry.mode === "coaching" ? "Coach" : entry.mode === "general" ? "General" : "Job-specific"}</span></div>
              <p>{entry.advice.summary}</p>
              {entry.advice.recommendations.map((item, i) => <details key={i}>
                <summary>{item.requirement}<span>{item.assessment === "supported" ? "In CV" : "Check"}</span></summary>
                <p>{item.suggestion}</p>
                {item.cvEvidence && <blockquote>CV evidence: “{item.cvEvidence}”</blockquote>}
                {item.question && <p>Question: {item.question}</p>}
              </details>)}
              {entry.advice.nextSteps.length > 0 && <details><summary>Suggested next steps</summary><ul>{entry.advice.nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ul></details>}
              <small>{entry.advice.disclaimer}</small>
            </section>}
          </div>
        </div>)}
        {busy && <div className="occ3-status" role="status">Orire is working on your request…</div>}
        {error && <p className="occ3-error" role="alert">{error}</p>}
        <div ref={end} />
      </div>
      <div className="occ3-composer-area">
        <form className="occ3-composer" aria-label="OCC 3.0 composer" onSubmit={event => { event.preventDefault(); void send(); }}>
          {attached && <div className="occ3-attached"><span>▤ {attached === "cv" ? cvName : jdName}</span><button type="button" aria-label="Remove attachment" onClick={() => setAttached(null)}>×</button></div>}
          <div className="occ3-composer-main">
            <div className="occ3-attach-wrap">
              <button type="button" aria-label="Attach document" title="Attach CV" className="occ3-attach" aria-expanded={menu} onClick={() => { setMenu(value => !value); setAgentMenu(false); }}><svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5L14.7 1.3a4 4 0 0 1 5.7 5.7L10.1 17.3a2 2 0 0 1-2.8-2.8l9.2-9.2"/></svg></button>
              {menu && <div className="occ3-popup occ3-attach-menu">
                <button type="button" onClick={() => { setMenu(false); fileInput.current?.click(); }}>{isJDStep ? "Attach job description" : "Upload CV"}</button>
                {!isJDStep && <div className="occ3-saved">{savedCvs.length > 0 ? savedCvs.map(item => <button type="button" key={item.id} onClick={() => chooseSaved(item)}>Choose: {item.title}</button>) : <span>No saved CVs yet</span>}</div>}
              </div>}
              <input ref={fileInput} type="file" aria-label={isJDStep ? "Upload job description" : "Upload CV"} accept=".pdf,.docx,.txt" hidden onChange={event => void parseFile(event)} />
            </div>
            <textarea aria-label="Message Orire Career Copilot" rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder={agent === "interview" && interviewPhase === "question" ? "Answer in your own words…" : isJDStep ? "Paste a job description or type a message…" : agent === "coach" && cvReady ? "Describe a career goal or ask Coach…" : cvReady ? "Message Orire Career Copilot…" : "Attach your CV to get started…"} />
            <div className="occ3-agent-wrap">
              <button type="button" aria-haspopup="listbox" aria-expanded={agentMenu} aria-label="Select agent" className="occ3-agent" onClick={() => { setAgentMenu(value => !value); setMenu(false); }}>✧ {AGENTS.find(item => item.id === agent)?.name} <span>⌄</span></button>
              {agentMenu && <div role="listbox" aria-label="OCC agents" className="occ3-popup occ3-agent-menu">
                {AGENTS.map(item => <button role="option" aria-selected={agent === item.id} type="button" key={item.id} onClick={() => selectAgent(item.id)}>{item.name}{agent === item.id && <span>✓</span>}</button>)}
              </div>}
            </div>
            <button type="submit" className="occ3-send" disabled={!canSend} aria-label="Send message">➤</button>
          </div>
        </form>
        <p className="occ3-footnote">Preview · Your CV is not saved automatically. Verify all AI suggestions.</p>
      </div>
    </main>
  </div>;
}
