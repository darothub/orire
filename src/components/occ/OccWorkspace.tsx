"use client";
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import Link from "next/link";
import type { CVData } from "@/lib/cv/schema";
import { cvToPlainText } from "@/lib/export/plaintext";
import { planOccTurn, type OccTask } from "@/lib/occ/orchestrator";
import { looksLikeCV, looksLikeJobDescription } from "@/lib/occ/document-validation";
import { DEFAULT_OCC_AGENT, OCC_AGENTS, getOccAgent, type OccAgentId } from "@/lib/occ/agents";
import "./occ2.css";
import { CareerMemory } from "./CareerMemory";
import { OccReviewMessage } from "./OccReviewMessage";
import { OccVersionedCv } from "./OccVersionedCv";
import { OccMockInterview } from "./OccMockInterview";
import { OccTemplatePreview } from "./OccTemplatePreview";

import type { OccAdvice } from "@/lib/occ/recommendations";
type Advice = OccAdvice;
type Result = { matchedTerms: string[]; unverifiedTerms: string[]; checked: number; disclaimer: string };
type WorkspaceSection = "overview" | "analysis" | "recommendations" | "versions" | "memory" | "interview";
type Turn = { role: "you" | "OCC"; text: string; reviewEventId?: number };
type ReviewEvent = { id: number; advice: Advice; original: string; profileUsed: boolean; savedRunId: string | null };
type OccSessionSummary = { id: string; title: string; primaryAgent: string; usedAgents: string[]; updatedAt: string };

export function OccWorkspace() {
  const [section, setSection] = useState<WorkspaceSection>("overview");
  const [interviewEpoch, setInterviewEpoch] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<OccAgentId>(DEFAULT_OCC_AGENT);
  const [primaryAgent, setPrimaryAgent] = useState<OccAgentId>(DEFAULT_OCC_AGENT);
  const [usedAgents, setUsedAgents] = useState<OccAgentId[]>([DEFAULT_OCC_AGENT]);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const [sessions, setSessions] = useState<OccSessionSummary[]>([]);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");

  const [pasteCvOpen, setPasteCvOpen] = useState(false);
  const [pasteRoleOpen, setPasteRoleOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingMilestoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingMilestoneRef.current) return;
    const anchor = pendingMilestoneRef.current;
    pendingMilestoneRef.current = null;
    const frame = requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [section]);

  function chooseAgent(id: OccAgentId) {
    const agent = getOccAgent(id);
    setSelectedAgent(id);
    setUsedAgents(current => current.includes(id) ? current : [...current, id]);
    setCurrentTask(agent.task);
    setSection(agent.task === "analysis" ? "analysis" : agent.task);
    setTurns(current => [...current, { role: "OCC", text: agent.label + " selected. " + agent.description + ". Your attached documents are still available." }]);
  }

  const [composer, setComposer] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextReviewId = useRef(1);
  const [reviewEvents, setReviewEvents] = useState<ReviewEvent[]>([]);
  const [currentTask, setCurrentTask] = useState<OccTask>("unknown");
  const currentFingerprint = JSON.stringify({ turns, primaryAgent, usedAgents });
  const hasUnsavedTranscript = turns.length > 0 && currentFingerprint !== savedFingerprint;
  async function refreshSessions() {
    try {
      const response = await fetch("/api/occ/conversations", { cache: "no-store" });
      if (!response.ok) throw new Error("History unavailable");
      const data = await response.json();
      setSessions(Array.isArray(data.conversations) ? data.conversations : []);
    } catch { setSessionNotice("Saved conversation history is temporarily unavailable."); }
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/occ/conversations", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("History unavailable");
        const data = await response.json();
        if (active) setSessions(Array.isArray(data.conversations) ? data.conversations : []);
      })
      .catch(() => { if (active) setSessionNotice("Saved conversation history is temporarily unavailable."); });
    return () => { active = false; };
  }, []);
  async function saveConversation() {
    if (!turns.length || sessionBusy) return;
    setSessionBusy(true);
    setSessionNotice("");
    try {
      const firstUserText = turns.find(turn => turn.role === "you")?.text ?? "";
      const title = firstUserText.slice(0, 100).trim() || "Career Copilot conversation";
      const response = await fetch("/api/occ/conversations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ ...(savedSessionId ? { id: savedSessionId } : {}),
          title, primaryAgent, usedAgents, turns }),
      });
      if (!response.ok) throw new Error("Could not save this conversation. Your current chat remains visible.");
      const result = await response.json();
      setSavedSessionId(result.id);
      setSavedFingerprint(currentFingerprint);
      setSessionNotice("Transcript saved privately. CV and job-description attachments were not saved.");
      await refreshSessions();
    } catch (error) { setSessionNotice(error instanceof Error ? error.message : "Could not save conversation."); }
    finally { setSessionBusy(false); }
  }
  async function openConversation(id: string) {
    if (sessionBusy || (hasUnsavedTranscript && !window.confirm("Open another conversation? Unsaved changes in the current conversation will be lost."))) return;
    setSessionBusy(true);
    setSessionNotice("");
    try {
      const response = await fetch("/api/occ/conversations/" + encodeURIComponent(id), { cache: "no-store" });
      if (!response.ok) throw new Error("Could not open the saved conversation.");
      const { conversation } = await response.json();
      const loaded: Turn[] = conversation.messages.map((message: { sender: "you" | "OCC"; text: string }) => ({ role: message.sender, text: message.text }));
      const firstAgent = getOccAgent(conversation.primaryAgent).id;
      const agents = [...new Set([firstAgent, ...conversation.usedAgents.filter((id: string) => OCC_AGENTS.some(a => a.id === id))])] as OccAgentId[];
      setTurns(loaded);
      setSelectedAgent(firstAgent);
      setPrimaryAgent(firstAgent);
      setUsedAgents(agents);
      setSavedSessionId(conversation.id);
      setSavedFingerprint(JSON.stringify({ turns: loaded, primaryAgent: firstAgent, usedAgents: agents }));
      setCv(""); setDescription(""); setSelectedCvId(""); setUploadedCvName(""); setUploadedJobName("");
      setAdvice(null); setReviewEvents([]); setResult(null); setComposer("");
      setCurrentTask("unknown"); setSection("overview"); setInterviewEpoch(current => current + 1);
      setPasteCvOpen(false); setPasteRoleOpen(false);
      setSessionNotice("Conversation restored. Reattach your CV and job description to continue; document text was not saved.");
      setSessionRailOpen(false);
    } catch (error) { setSessionNotice(error instanceof Error ? error.message : "Unable to load conversation."); }
    finally { setSessionBusy(false); }
  }
  async function deleteConversation(id: string) {
    if (sessionBusy || !window.confirm("Permanently delete this saved conversation and all its messages?")) return;
    setSessionBusy(true);
    try {
      const response = await fetch("/api/occ/conversations/" + encodeURIComponent(id), { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error("Could not delete conversation.");
      setSessions(current => current.filter(item => item.id !== id));
      if (savedSessionId === id) { setSavedSessionId(null); setSavedFingerprint(""); }
      setSessionNotice("Saved conversation deleted.");
    } catch (error) { setSessionNotice(error instanceof Error ? error.message : "Unable to delete conversation."); }
    finally { setSessionBusy(false); }
  }

  function ask(value: string) {
    const text = value.trim();
    if (!text || running) return;
    const plan = planOccTurn(text, {
      priorTask: currentTask,
      hasCv: cv.trim().length >= 30,
      hasJobDescription: description.trim().length >= 30,
      hasAdvice: advice !== null,
    });
    if (plan.captureJobDescription) setDescription(text.slice(0, 15000));
    setCurrentTask(plan.task);
    setTurns(current => [...current, { role: "you", text }, { role: "OCC", text: plan.reply }]);
    setSection(plan.panel === "none" ? "overview" : plan.panel);
    setComposer("");
    setError("");
  }
  const [cv, setCv] = useState("");
  const [savedCvs, setSavedCvs] = useState<{ id: string; title: string; template: string; data: CVData }[]>([]);
  const [selectedCvId, setSelectedCvId] = useState("");
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/occ/versions", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Saved CVs unavailable");
      const data = await response.json();
      if (!cancelled) setSavedCvs(data.documents ?? []);
    }).catch(() => { /* Pasted CV remains available if library request fails. */ });
    return () => { cancelled = true; };
  }, []);
  const [description, setDescription] = useState("");

  const [result, setResult] = useState<Result | null>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [saveRun, setSaveRun] = useState(false);
  const [showPrivacyOptions, setShowPrivacyOptions] = useState(false);
  const [showKeywordCheck, setShowKeywordCheck] = useState(false);
  const [showCvText, setShowCvText] = useState(false);
  const [showRoleText, setShowRoleText] = useState(false);
  const [useSavedProfile, setUseSavedProfile] = useState(false);
  const [uploading, setUploading] = useState<"cv" | "jobDescription" | null>(null);
  const [uploadedCvName, setUploadedCvName] = useState("");
  const [uploadedJobName, setUploadedJobName] = useState("");
  const [sessionRailOpen, setSessionRailOpen] = useState(false);
  const [contextRailOpen, setContextRailOpen] = useState(false);
  function newConversation() {
    if ((hasUnsavedTranscript || cv.trim() || description.trim()) &&
        !window.confirm("Start a new conversation? Unsaved messages and current document attachments will be cleared. Previously saved transcripts remain in your history.")) return;
    setTurns([]);
    setReviewEvents([]);
    setComposer("");
    setCv("");
    setDescription("");
    setResult(null);
    setAdvice(null);
    setSelectedCvId("");
    setUploadedCvName("");
    setUploadedJobName("");
    setSelectedAgent(DEFAULT_OCC_AGENT);
    setPrimaryAgent(DEFAULT_OCC_AGENT);
    setUsedAgents([DEFAULT_OCC_AGENT]);
    setSavedSessionId(null);
    setSavedFingerprint("");
    setSessionNotice("");
    setCurrentTask("unknown");
    setInterviewEpoch(current => current + 1);
    setSection("overview");
    setError("");
    setPasteCvOpen(false);
    setPasteRoleOpen(false);
    setSessionRailOpen(false);
    setContextRailOpen(false);
  }

  async function uploadDocument(kind: "cv" | "jobDescription", event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || uploading || running) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "docx", "txt"].includes(ext)) {
      setError("Upload a PDF, DOCX or TXT document.");
      return;
    }
    const maxBytes = ext === "txt" ? 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size === 0 || file.size > maxBytes) {
      setError(ext === "txt" ? "TXT files must be under 1 MB." : "PDF and DOCX files must be under 15 MB.");
      return;
    }
    setUploading(kind);
    setError("");
    try {
      let extracted: string;
      if (ext === "txt") {
        extracted = await file.text();
      } else {
        const form = new FormData();
        form.append("files", file);
        const response = await fetch("/api/parse", { method: "POST", body: form, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Could not read this document.");
        const parsed = payload.files?.[0];
        if (parsed?.error || typeof parsed?.text !== "string") throw new Error(parsed?.error || "Could not extract document text.");
        extracted = parsed.text;
      }
      const limit = kind === "cv" ? 30000 : 15000;
      const text = extracted.trim();
      if (text.length < 30) throw new Error("Not enough readable text found. Try a text-based PDF, DOCX or TXT file.");
      if (text.length > limit) throw new Error(`Document text exceeds the ${limit.toLocaleString()} character limit. Please shorten it.`);
      if (kind === "cv" && !looksLikeCV(text)) throw new Error("This document does not appear to be a CV. Upload a resume showing work experience, skills or education.");
      if (kind === "jobDescription" && !looksLikeJobDescription(text)) throw new Error("This does not appear to be a job description. Upload a role with responsibilities or requirements.");
      if (kind === "cv") {
        setSelectedCvId("");
        setCv(text);
        setUploadedCvName(file.name);
        setShowCvText(false);
      } else {
        setDescription(text);
        setUploadedJobName(file.name);
        setShowRoleText(false);
      }
      setCurrentTask(currentTask === "interview" ? "interview" : "analysis");
      setSection(currentTask === "interview" ? "interview" : "analysis");
      // Attachment status is displayed in the composer and review preparation, not duplicated as chat messages.
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not read that document.");
    } finally {
      setUploading(null);
    }
  }

  const uploadInput = (kind: "cv" | "jobDescription", label: string, compact = false) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: uploading || running ? "not-allowed" : "pointer", padding: compact ? "6px 9px" : "8px 11px", border: compact ? "none" : "1px solid #c8c1d9", borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
      <input type="file" accept=".pdf,.docx,.txt" aria-label={label} disabled={Boolean(uploading) || running} onChange={event => { void uploadDocument(kind, event); }} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>
      </svg>
      {uploading === kind ? "Reading file…" : label}
    </label>
  );

  async function run() {
    setError("");
    setResult(null);
    setAdvice(null);
    setRunning(true);
    try {
      const response = await fetch("/api/occ/match", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, description }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not compare the documents.");
      setResult(data as Result);
      setTurns(current => [...current, { role: "OCC", text: "Your evidence comparison is ready below. This is not a hiring score." }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed."); }
    finally { setRunning(false); }
  }
  async function requestAdvice() {
    setRunning(true);
    setError("");
    setAdvice(null);
    try {
      const response = await fetch("/api/occ/advise", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, description, goal: turns.filter(turn => turn.role === "you").at(-1)?.text.slice(0, 300) ?? "", saveRun, useSavedProfile }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message ?? "OCC could not analyze your CV.");
      const responseAdvice = data.advice as Advice;
      const eventId = nextReviewId.current++;
      setAdvice(responseAdvice);
      setReviewEvents(current => [...current, { id: eventId, advice: responseAdvice, original: cv, profileUsed: data.usedSavedProfile === true, savedRunId: data.runId ?? null }]);
      setSection("recommendations");
      setTurns(current => [...current, { role: "OCC", text: "I reviewed the supplied CV against the role. Here are the findings, with evidence you can inspect before accepting any wording changes.", reviewEventId: eventId }]);
    } catch (e) { setError(e instanceof Error ? e.message : "OCC failed."); }
    finally { setRunning(false); }
  }
  const field: CSSProperties = { width: "100%", padding: 13, border: "1px solid #bcb4d0", borderRadius: 12, background: "transparent", color: "inherit", font: "inherit" };
  const surface: CSSProperties = { border: "1px solid #c8c1d9", borderRadius: 20, padding: "clamp(18px, 3vw, 28px)", background: "rgba(118, 83, 167, .025)", boxShadow: "0 4px 24px rgba(44, 21, 82, .045)" };
  const cvReady = cv.trim().length >= 30;
  const roleReady = description.trim().length >= 30;
  const selectedStructuredCv = savedCvs.find(item => item.id === selectedCvId) ?? null;
  function selectSavedCv(id: string) {
    const document = savedCvs.find(item => item.id === id);
    if (!document) return;
    setSelectedCvId(document.id);
    setCv(cvToPlainText(document.data));
    setUploadedCvName("");
    setShowCvText(false);
    setPasteCvOpen(false);
  }
  function detachDocument(kind: "cv" | "jobDescription") {
    if (kind === "cv") {
      setCv("");
      setSelectedCvId("");
      setUploadedCvName("");
      setShowCvText(false);
      setPasteCvOpen(false);
      setAdvice(null);
      setResult(null);
    } else {
      setDescription("");
      setUploadedJobName("");
      setShowRoleText(false);
      setPasteRoleOpen(false);
      setAdvice(null);
      setResult(null);
    }
  }

  return (
    <div className="occ2-layout">
      <aside id="occ2-session-sidebar" className={"occ2-side occ2-side-left" + (sessionRailOpen ? " occ2-side-open" : "")} aria-label="Career Copilot conversations">
        <div className="occ2-side-heading"><strong>Career Copilot</strong><small>BETA</small></div>
        <button type="button" className="occ2-new-chat" onClick={newConversation}>＋ New conversation</button>
        <h2 className="occ2-side-label">CURRENT SESSION</h2>
        <p className="occ2-unsaved-chat">✧ Current conversation <small>{savedSessionId ? hasUnsavedTranscript ? "Unsaved changes" : "Saved privately" : "Not saved"}</small></p>
        <button type="button" className="occ2-new-chat" disabled={sessionBusy || !turns.length || !hasUnsavedTranscript} onClick={() => void saveConversation()}>Save transcript privately</button>
        <p className="occ2-rail-note">Saving is optional and stores chat messages only, not CV/JD attachments. You can delete saved conversations.</p>
        {sessionNotice && <p role="status" className="occ2-rail-note">{sessionNotice}</p>}
        <h2 className="occ2-side-label">SAVED CONVERSATIONS</h2>
        <input aria-label="Search saved conversations" value={sessionFilter} onChange={event => setSessionFilter(event.target.value)} placeholder="Search conversations" className="occ2-history-search" />
        {OCC_AGENTS.map(agent => {
          const entries = sessions.filter(item => (item.primaryAgent === agent.id || item.usedAgents.includes(agent.id)) &&
            item.title.toLowerCase().includes(sessionFilter.trim().toLowerCase()));
          return entries.length ? <section key={agent.id} aria-label={agent.label + " sessions"} className="occ2-history-group">
            <h3>{agent.label}</h3>
            {entries.map(item => <div key={item.id} className="occ2-history-entry">
              <button type="button" disabled={sessionBusy} aria-current={item.id === savedSessionId ? "page" : undefined} onClick={() => void openConversation(item.id)}>{item.title}</button>
              <button type="button" disabled={sessionBusy} aria-label={"Delete conversation: " + item.title} onClick={() => void deleteConversation(item.id)}>×</button>
            </div>)}
          </section> : null;
        })}
        <h2 className="occ2-side-label">SPECIALISTS</h2>
        <nav className="occ2-side-agents" aria-label="Career Copilot specialists">
          {OCC_AGENTS.map(agent => <button type="button" key={agent.id} className={selectedAgent === agent.id ? "occ2-selected-agent" : ""} onClick={() => { chooseAgent(agent.id); setSessionRailOpen(false); }} aria-current={selectedAgent === agent.id ? "true" : undefined}>{agent.label}</button>)}
        </nav>
        <p className="occ2-rail-note">Each conversation is stored once and automatically appears under the specialist services used during that session.</p>
      </aside>
      <div className="occ2-content">
        <div className="occ2-mobile-actions">
          <button type="button" onClick={() => setSessionRailOpen(value => !value)} aria-expanded={sessionRailOpen} aria-controls="occ2-session-sidebar">☰ Sessions</button>
          <button type="button" onClick={() => setContextRailOpen(value => !value)} aria-expanded={contextRailOpen} aria-controls="occ2-context-sidebar">Documents & milestones</button>
        </div>
      <header className="occ2-chat-header">
        <div className="occ2-chat-logo" aria-hidden="true">✦</div>
        <div>
          <p className="occ2-chat-eyebrow">ORIRE CAREER COPILOT · PRIVATE BETA</p>
          <h1>{turns.length === 0 ? "Where should we take your career?" : "Career Copilot"}</h1>
          {turns.length === 0 && <p className="occ2-chat-intro">Ask a question, attach your CV, or choose a specialist. Your experience stays yours to verify.</p>}
        </div>
      </header>
      <section aria-label="Career Copilot conversation" className="occ2-conversation" style={{ ...surface, display: "grid", gap: 16 }}>
        <div className="occ2-agent-toolbar">
          <label htmlFor="occ2-agent-picker">Agent</label>
          <select id="occ2-agent-picker" value={selectedAgent} onChange={event => chooseAgent(event.target.value as OccAgentId)}>
            {OCC_AGENTS.map(agent => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
          </select>
          <span>Switch agents without losing your CV or target role</span>
        </div>
        {turns.length === 0 && <>
          <h2 style={{ fontWeight: 750, fontSize: "clamp(21px, 3vw, 27px)" }}>What would you like to work on?</h2>
          <p style={{ opacity: .8 }}>Ask a question, choose a starting point or attach a CV.</p>
          <div aria-label="Suggested career questions" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Review my CV for a role", "Improve my CV", "Prepare for an interview", "Manage my career memory"].map(text =>
              <button type="button" key={text} onClick={() => ask(text)} style={{ padding: "7px 11px", textAlign: "left", background: "rgba(125, 93, 180, .045)", color: "inherit", border: "1px solid #c8c1d9", borderRadius: 999, fontSize: 12, lineHeight: 1.4, cursor: "pointer" }}>{text}</button>)}
          </div>
        </>}
        {turns.map((turn, index) => {
          const review = reviewEvents.find(event => event.id === turn.reviewEventId);
          return <div id={"occ-message-" + index} key={index} className={"occ2-turn " + (turn.role === "you" ? "occ2-turn-user" : "occ2-turn-assistant")}>
            <div className="occ2-message-bubble">
              <strong>{turn.role === "you" ? "You" : "OCC"}:</strong> {turn.text}
            </div>
            {review && <OccReviewMessage advice={review.advice} original={review.original} analysisId={review.id}
              profileUsed={review.profileUsed} savedRunId={review.savedRunId}
              isLatest={review.id === reviewEvents[reviewEvents.length - 1]?.id} />}
          </div>;
        })}
        {turns.length > 2 && <button type="button" className="occ2-jump" onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}>↓ Jump to latest</button>}
        {(cvReady || roleReady) && <div role="status" aria-label="Attached career documents" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {cvReady && <span style={{ border: "1px solid #c8c1d9", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>✓ CV ready · {uploadedCvName || savedCvs.find(item => item.id === selectedCvId)?.title || "Pasted text"}</span>}
          {roleReady && <span style={{ border: "1px solid #c8c1d9", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>✓ Role ready · {uploadedJobName || "Pasted text"}</span>}
        </div>}
        {section === "overview" && error && <p role="alert" style={{ color: "#b44444" }}>{error}</p>}
        <p style={{ fontSize: 12, opacity: .7 }}>PDF, DOCX or TXT · Only CVs and job descriptions · You decide when to analyze or save</p>
      {section === "analysis" && <section aria-label="CV analysis workspace" style={{ display: "grid", gap: 20 }}>
      <div style={{ ...surface, display: "grid", gap: 17 }}>
        <h2 style={{ fontSize: 23, fontWeight: 750 }}>Review your fit for this role</h2>
        <p style={{ fontSize: 14, opacity: .8 }}>Add a CV and target role. OCC will explain your strengths, evidence gaps and possible improvements.</p>
        <div aria-label="Review preparation" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 185px), 1fr))", gap: 9 }}>
          <div style={{ border: "1px solid #c8c1d9", borderRadius: 12, padding: "11px 13px" }}>
            <strong style={{ display: "block", fontSize: 13 }}>1. Your CV</strong>
            <span style={{ opacity: .8, fontSize: 12 }}>{cvReady ? "✓ Ready to review" : "Upload or choose a CV"}</span>
          </div>
          <div style={{ border: "1px solid #c8c1d9", borderRadius: 12, padding: "11px 13px" }}>
            <strong style={{ display: "block", fontSize: 13 }}>2. Target role</strong>
            <span style={{ opacity: .8, fontSize: 12 }}>{roleReady ? "✓ Requirements added" : "Upload or paste job details"}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {uploadInput("cv", "Upload another CV")}
          {uploadInput("jobDescription", "Upload role description")}
          {(uploadedCvName || uploadedJobName) && <span role="status" style={{ fontSize: 12 }}> {uploadedCvName ? `CV: ${uploadedCvName}` : ""}{uploadedCvName && uploadedJobName ? " · " : ""}{uploadedJobName ? `Role: ${uploadedJobName}` : ""}</span>}
        </div>
        {savedCvs.length > 0 && <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>Select your CV
          <select style={field} value={selectedCvId} onChange={event => {
            const id = event.target.value;
            if (id) selectSavedCv(id);
            else { setSelectedCvId(""); setCv(""); setUploadedCvName(""); setShowCvText(true); }
          }}>
            <option value="">Paste CV text manually</option>
            {savedCvs.map(document => <option key={document.id} value={document.id}>{document.title}</option>)}
          </select>
        </label>}
        {selectedCvId && <p style={{ fontSize: 13, opacity: .8 }}>Using your selected Orire CV. The original will not be edited.</p>}
        {(!selectedCvId && (showCvText || (!uploadedCvName && (savedCvs.length === 0 || cv.trim().length > 0)))) && <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>Your current CV text
          <textarea style={{ ...field, minHeight: 135, resize: "vertical" }} value={cv} onChange={e => { setCv(e.target.value); setSelectedCvId(""); setUploadedCvName(""); }} maxLength={30000} placeholder="Paste your CV if it is not in Orire" />
        </label>}
        {uploadedCvName && !selectedCvId && !showCvText && <button type="button" onClick={() => setShowCvText(true)} style={{ justifySelf: "start", fontSize: 13, border: 0, background: "transparent", color: "inherit", textDecoration: "underline" }}>View or edit extracted CV text</button>}
        {!selectedCvId && savedCvs.length > 0 && !showCvText && !cv.trim() && <button type="button" onClick={() => setShowCvText(true)} style={{ justifySelf: "start", textDecoration: "underline" }}>I need to paste a CV</button>}
        {uploadedJobName && !showRoleText ? <div style={{ display: "grid", gap: 6 }}>
          <p style={{ fontSize: 13 }}>✓ Job description attached: <strong>{uploadedJobName}</strong></p>
          <button type="button" onClick={() => setShowRoleText(true)} style={{ justifySelf: "start", fontSize: 13, border: 0, background: "transparent", color: "inherit", textDecoration: "underline" }}>View or edit job description</button>
        </div> : <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>Target job description
          <textarea style={{ ...field, minHeight: roleReady ? 95 : 130, resize: "vertical" }} value={description} onChange={e => { setDescription(e.target.value); setUploadedJobName(""); }} maxLength={15000} placeholder="Paste the requirements or describe the role in the conversation" />
        </label>}
        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" disabled={running || cv.trim().length < 30 || description.trim().length < 30}
            onClick={() => void requestAdvice()}
            style={{ justifySelf: "start", padding: "12px 20px", border: 0, borderRadius: 12, background: "#7251ae", color: "white", fontWeight: 700, cursor: "pointer" }}>
            {running ? "Reviewing your CV…" : "Review my fit"}
          </button>
          <p style={{ fontSize: 12, opacity: .78 }}>This sends your CV and role description to the Orire AI provider. You review all suggestions before making changes.</p>
        </div>
        <details open={showPrivacyOptions} onToggle={event => setShowPrivacyOptions(event.currentTarget.open)}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Privacy and history options</summary>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label><input type="checkbox" checked={useSavedProfile} onChange={e => setUseSavedProfile(e.target.checked)} /> Include my saved career profile in AI analysis</label>
            <label><input type="checkbox" checked={saveRun} onChange={e => setSaveRun(e.target.checked)} /> Save this recommendation session privately</label>
          </div>
        </details>
        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" onClick={() => setShowKeywordCheck(value => !value)} aria-expanded={showKeywordCheck} style={{ justifySelf: "start", fontSize: 13, textDecoration: "underline" }}>Other option: keyword-only check (no AI)</button>
          {showKeywordCheck && <div style={{ display: "grid", gap: 8 }}>
            <p style={{ fontSize: 13, opacity: .8 }}>Only checks whether phrases from the job description appear in your CV. It does not provide career advice or a match score.</p>
            <button type="button" disabled={running || cv.trim().length < 30 || description.trim().length < 30} onClick={() => void run()} style={{ justifySelf: "start", padding: "9px 14px", border: "1px solid #c8c1d9", borderRadius: 10, color: "inherit", background: "transparent" }}>Run keyword check</button>
          </div>}
        </div>
      </div>
      {error && <p role="alert" style={{ color: "#b44444" }}>{error}</p>}
      {result && <section aria-live="polite" style={{ padding: 24, border: "1px solid #c8c1d9", borderRadius: 18, display: "grid", gap: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Initial evidence review</h2>
        <p>{result.checked} distinct job-description terms reviewed. This is not a ranking or match percentage.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          <div><h3 style={{ fontWeight: 700 }}>Mentioned in your CV ({result.matchedTerms.length})</h3><p>{result.matchedTerms.join(", ") || "No direct keyword overlap identified."}</p></div>
          <div><h3 style={{ fontWeight: 700 }}>Not found in CV text ({result.unverifiedTerms.length})</h3><p>{result.unverifiedTerms.join(", ") || "No additional keywords identified."}</p></div>
        </div>
        <p style={{ fontSize: 13, opacity: .8 }}>{result.disclaimer}</p>

      </section>}
      </section>}
      <div hidden={section !== "interview"} className="occ2-inthread-tool" aria-label="Interview coach conversation panel"><OccMockInterview key={interviewEpoch} cv={cv} jobDescription={description} onUpdateRole={setDescription} /></div>
      {section === "versions" && <section aria-label="CV version workspace"><OccVersionedCv /></section>}
      {section === "memory" && <section aria-label="Career memory workspace"><CareerMemory /></section>}
      <div ref={bottomRef} className="occ2-bottom-anchor" aria-hidden="true" />
      {running && <p role="status" aria-live="polite" className="occ2-working-status">OCC is reviewing the supplied information…</p>}
        <form className="occ2-sticky-composer" onSubmit={event => { event.preventDefault(); ask(composer); }} style={{ display: "grid", gap: 8, padding: 12, border: "1px solid #b8afd0", borderRadius: 16, background: "rgba(114,81,174,.04)" }}>
          <textarea aria-label="Message your Career Copilot" style={{ width: "100%", background: "transparent", color: "inherit", font: "inherit", border: 0, resize: "vertical", padding: 8, minHeight: 78, outlineOffset: 2 }} maxLength={1200} value={composer} onChange={event => setComposer(event.target.value)} placeholder="Tell OCC what you want to achieve..." />
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              {uploadInput("cv", "Upload CV", true)}
              {uploadInput("jobDescription", "Upload job description", true)}
              <button type="button" className="occ2-quiet-action" aria-expanded={pasteCvOpen} onClick={() => setPasteCvOpen(value => !value)}>Paste CV</button>
              <button type="button" className="occ2-quiet-action" aria-expanded={pasteRoleOpen} onClick={() => setPasteRoleOpen(value => !value)}>Paste JD</button>
            </div>
            <button type="submit" disabled={!composer.trim()} style={{ padding: "10px 18px", border: 0, borderRadius: 12, color: "#fff", background: "#7251ae", fontWeight: 700 }}>Send</button>
          </div>
          {pasteCvOpen && <label id="occ2-cv-text-panel" className="occ2-paste-editor">CV text <small>Up to 30,000 characters; not sent as a chat message</small>
            <textarea aria-label="Paste full CV" maxLength={30000} rows={6} value={cv} onChange={event => { setCv(event.target.value); setSelectedCvId(""); setUploadedCvName(""); }} placeholder="Paste your complete CV here" />
          </label>}
          {pasteRoleOpen && <label id="occ2-jd-text-panel" className="occ2-paste-editor">Job description <small>Up to 15,000 characters; not sent as a chat message</small>
            <textarea aria-label="Paste full job description" maxLength={15000} rows={6} value={description} onChange={event => { setDescription(event.target.value); setUploadedJobName(""); }} placeholder="Paste the full job description here" />
          </label>}
        </form>

      </section>
      </div>
      <aside id="occ2-context-sidebar" className={"occ2-side occ2-side-right" + (contextRailOpen ? " occ2-side-open" : "")} aria-label="Current conversation documents and milestones">
        <h2>Session context</h2>
        <h3 className="occ2-side-label">DOCUMENTS</h3>
        <section className="occ2-document" aria-label="Current CV attachment">
          <strong>CV</strong><span>{cvReady ? uploadedCvName || selectedStructuredCv?.title || "Pasted CV" : "Not attached"}</span>
          {cvReady && <div className="occ2-document-actions">
            <button type="button" onClick={() => { setPasteCvOpen(true); setContextRailOpen(false); document.getElementById("occ2-cv-text-panel")?.scrollIntoView({ behavior: "smooth" }); }}>View / edit</button>
            <button type="button" onClick={() => detachDocument("cv")}>Remove</button>
          </div>}
          {!cvReady && savedCvs.length > 0 && <label className="occ2-rail-select">Choose saved CV
            <select aria-label="Use saved Orire CV" value="" onChange={event => selectSavedCv(event.target.value)}>
              <option value="">Select a CV</option>
              {savedCvs.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>}
        </section>
        <section className="occ2-document" aria-label="Current job-description attachment">
          <strong>Job description</strong><span>{roleReady ? uploadedJobName || "Pasted role description" : "Not attached"}</span>
          {roleReady && <div className="occ2-document-actions">
            <button type="button" onClick={() => { setPasteRoleOpen(true); setContextRailOpen(false); document.getElementById("occ2-jd-text-panel")?.scrollIntoView({ behavior: "smooth" }); }}>View / edit</button>
            <button type="button" onClick={() => detachDocument("jobDescription")}>Remove</button>
          </div>}
        </section>
        <h3 className="occ2-side-label">MILESTONES</h3>
        <nav aria-label="Conversation milestones" className="occ2-milestones">
          {turns.length === 0 && <p>No milestones yet.</p>}
          {turns.map((turn, index) => turn.role === "OCC" ? <button key={index} type="button" onClick={() => { setContextRailOpen(false); document.getElementById("occ-message-" + index)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>{turn.text.length > 64 ? turn.text.slice(0, 64) + "…" : turn.text}</button> : null)}
          {advice && <button type="button" onClick={() => { pendingMilestoneRef.current = "occ2-advice-results"; setContextRailOpen(false); setSection("recommendations"); }}>CV recommendations</button>}
        </nav>
        <h3 className="occ2-side-label">CV TEMPLATE</h3>
        <OccTemplatePreview document={selectedStructuredCv} />
        <Link className="occ2-context-link" href="/">Open Orire CV library</Link>
      </aside>
    </div>
  );
}
