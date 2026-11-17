"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { cvToPlainText } from "@/lib/export/plaintext";
import type { CVData } from "@/lib/cv/schema";
import { looksLikeCV, looksLikeJobDescription } from "@/lib/occ/document-validation";
import type { OccAdvice } from "@/lib/occ/recommendations";
import "./occ3.css";

type Agent = "review" | "coach" | "interview" | "improve" | "memory";
type Mode = "start" | "choice" | "awaiting-jd" | "ready";
type Message = { id: number; role: "you" | "occ"; text?: string; file?: string; advice?: OccAdvice; mode?: "general" | "targeted"; choice?: boolean; jdPrompt?: boolean };
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
    setMenu(false); setAgentMenu(false); setSidebarOpen(false);
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
  function afterCV(file?: string) {
    append(message("you", { text: draft.trim() || undefined, file: file || cvName || "CV" }),
      message("occ", { text: "I've received your CV. Would you like a general review, or should I review it against a specific job description?", choice: true }));
    setMode("choice"); setDraft(""); setAttached(null);
  }
  function chooseJD() {
    append(message("you", { text: "I have a job description" }),
      message("occ", { text: "Great. Paste the job description into the chat or attach a PDF, DOCX or TXT file.", jdPrompt: true }));
    setMode("awaiting-jd");
    setAttached(null); setDraft(""); setAgent("review");
  }
  async function send() {
    if (!canSend) return;
    if (!cvReady) { setError("Attach your CV using the paperclip before sending."); return; }
    if (mode === "start" || (mode === "choice" && attached === "cv")) { afterCV(cvName); return; }
    if (isJDStep) {
      const roleText = attached === "jd" ? jd : draft.trim();
      if (roleText.length < 30 || !looksLikeJobDescription(roleText)) {
        setError("Provide a job description with at least 30 characters and role responsibilities.");
        return;
      }
      setJd(roleText);
      append(message("you", { text: attached === "jd" ? undefined : draft.trim(), file: attached === "jd" ? jdName : undefined }));
      setDraft(""); setAttached(null);
      await review("targeted", roleText);
      return;
    }
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    append(message("you", { text }),
      message("occ", { text: agent === "review"
        ? "To run a new role-specific review, share a job description. You can also choose General review for CV-only feedback."
        : agent === "interview" || agent === "coach"
          ? "Interview coaching uses a target role. Share the job description and I'll help you prepare one question at a time."
          : agent === "improve"
            ? "I can help improve wording from your CV. We'll only suggest evidence-based changes; you choose what to accept."
            : "Career Memory remains private and opt-in. We won't save your CV or this chat automatically." }));
    if (agent === "interview" || agent === "coach") setMode("awaiting-jd");
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
            {entry.advice && <section className="occ3-review" aria-label={entry.mode === "general" ? "General CV review" : "Targeted CV review"}>
              <div className="occ3-review-title"><strong>CV Review</strong><span>{entry.mode === "general" ? "General" : "Job-specific"}</span></div>
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
            <textarea aria-label="Message Orire Career Copilot" rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder={isJDStep ? "Paste a job description or type a message…" : cvReady ? "Message Orire Career Copilot…" : "Attach your CV to get started…"} />
            <div className="occ3-agent-wrap">
              <button type="button" aria-haspopup="listbox" aria-expanded={agentMenu} aria-label="Select agent" className="occ3-agent" onClick={() => { setAgentMenu(value => !value); setMenu(false); }}>✧ {AGENTS.find(item => item.id === agent)?.name} <span>⌄</span></button>
              {agentMenu && <div role="listbox" aria-label="OCC agents" className="occ3-popup occ3-agent-menu">
                {AGENTS.map(item => <button role="option" aria-selected={agent === item.id} type="button" key={item.id} onClick={() => { setAgent(item.id); setAgentMenu(false); }}>{item.name}{agent === item.id && <span>✓</span>}</button>)}
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
