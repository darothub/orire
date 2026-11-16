"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import type { CVData } from "@/lib/cv/schema";
import { cvToPlainText } from "@/lib/export/plaintext";
import { planOccTurn, type OccTask } from "@/lib/occ/orchestrator";
import type { OccAdvice } from "@/lib/occ/recommendations";
import { looksLikeCV, looksLikeJobDescription } from "@/lib/occ/document-validation";
import { DEFAULT_OCC_AGENT, OCC_AGENTS, getOccAgent, type OccAgentId } from "@/lib/occ/agents";
import "./occ2.css";
import { CareerMemory } from "./CareerMemory";
import { OccReviewMessage } from "./OccReviewMessage";
import { OccCvActionsMessage } from "./OccCvActionsMessage";
import { OccInterviewQuestionMessage, OccInterviewFeedbackMessage } from "./OccInterviewMessages";
import { MAX_INTERVIEW_TURNS, type InterviewFeedback, type InterviewQuestion } from "@/lib/occ/interview";
import { OccTemplatePreview } from "./OccTemplatePreview";

type Advice = OccAdvice;
type Result = { matchedTerms: string[]; unverifiedTerms: string[]; checked: number; disclaimer: string };
type WorkspaceSection = "overview" | "analysis" | "recommendations" | "versions" | "memory" | "interview";
type Turn = { role: "you" | "OCC"; text: string; reviewEventId?: number; interviewEventId?: number; keywordEventId?: number; cvAction?: boolean };
type InterviewEvent = { id: number; index: number; question: InterviewQuestion; feedback?: InterviewFeedback };
type ReviewEvent = { id: number; advice: Advice; original: string; profileUsed: boolean; savedRunId: string | null };
type OccSessionSummary = { id: string; title: string; primaryAgent: string; usedAgents: string[]; updatedAt: string };

export function OccWorkspace() {
  const [section, setSection] = useState<WorkspaceSection>("overview");
  const [interviewPhase, setInterviewPhase] = useState<"idle" | "question" | "feedback">("idle");
  const [interviewBusy, setInterviewBusy] = useState(false);
  const [interviewIndex, setInterviewIndex] = useState(0);
  const [interviewQuestion, setInterviewQuestion] = useState<InterviewQuestion | null>(null);
  const [interviewEvents, setInterviewEvents] = useState<InterviewEvent[]>([]);
  const nextInterviewEventId = useRef(1);
  const interviewGeneration = useRef(0);
  const [interviewContext, setInterviewContext] = useState<{ cv: string; description: string } | null>(null);
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
  const pendingEditorRef = useRef<"cv" | "jobDescription" | null>(null);
  useEffect(() => {
    const kind = pendingEditorRef.current;
    if (!kind || (kind === "cv" ? !pasteCvOpen : !pasteRoleOpen)) return;
    pendingEditorRef.current = null;
    const id = kind === "cv" ? "occ2-cv-text-panel" : "occ2-jd-text-panel";
    const frame = requestAnimationFrame(() => {
      const editor = document.getElementById(id);
      editor?.scrollIntoView({ behavior: "auto", block: "nearest" });
      editor?.querySelector("textarea")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pasteCvOpen, pasteRoleOpen]);
  function editAttachedDocument(kind: "cv" | "jobDescription") {
    pendingEditorRef.current = kind;
    if (kind === "cv") setPasteCvOpen(true);
    else setPasteRoleOpen(true);
    setContextRailOpen(false);
    // A second click must still focus the already-mounted editor.
    const id = kind === "cv" ? "occ2-cv-text-panel" : "occ2-jd-text-panel";
    const existing = document.getElementById(id);
    if (existing) {
      pendingEditorRef.current = null;
      existing.scrollIntoView({ behavior: "auto", block: "nearest" });
      existing.querySelector("textarea")?.focus({ preventScroll: true });
    }
  }
  useEffect(() => {
    if (!pendingMilestoneRef.current) return;
    const anchor = pendingMilestoneRef.current;
    pendingMilestoneRef.current = null;
    const frame = requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [section]);

  function openCvActions() {
    setSelectedAgent("improve");
    setUsedAgents(current => current.includes("improve") ? current : [...current, "improve"]);
    setCurrentTask("versions");
    setSection("versions");
    setTurns(current => [...current, {
      role: "OCC", text: "You can compare a saved CV field, preview a template, or create a new version after reviewing your wording. Nothing is applied automatically.",
      cvAction: true,
    }]);
  }
  function chooseAgent(id: OccAgentId) {
    const agent = getOccAgent(id);
    setSelectedAgent(id);
    setUsedAgents(current => current.includes(id) ? current : [...current, id]);
    setCurrentTask(agent.task);
    setSection(agent.task === "analysis" ? "analysis" : agent.task);
    setTurns(current => [...current, { role: "OCC", text: agent.label + " selected. " + agent.description + ". Your attached documents are still available.", cvAction: id === "improve" }]);
  }

  const [composer, setComposer] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextReviewId = useRef(1);
  const [reviewEvents, setReviewEvents] = useState<ReviewEvent[]>([]);
  const [currentTask, setCurrentTask] = useState<OccTask>("unknown");
  function resetInterviewState() {
    interviewGeneration.current++;
    setInterviewPhase("idle");
    setInterviewBusy(false);
    setInterviewIndex(0);
    setInterviewQuestion(null);
    setInterviewEvents([]);
    setInterviewContext(null);
  }
  async function postInterview(mode: "question" | "feedback", index: number, context: { cv: string; description: string }, question?: string, answer?: string) {
    const response = await fetch("/api/occ/interview", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ mode, cv: context.cv, description: context.description,
        turnIndex: index, ...(mode === "feedback" ? { question, answer } : {}) }),
    });
    const result = await response.json() as { error?: string; question?: InterviewQuestion; feedback?: InterviewFeedback };
    if (!response.ok) throw new Error(result.error || "Interview coaching is temporarily unavailable.");
    return result;
  }
  async function startInterview(index = 0) {
    if (interviewBusy || interviewPhase === "question" || index >= MAX_INTERVIEW_TURNS || (index === 0 ? description : interviewContext?.description ?? "").trim().length < 30) return;
    const generation = interviewGeneration.current;
    const context = index === 0 || !interviewContext ? { cv, description } : interviewContext;
    setInterviewBusy(true);
    setError("");
    try {
      const response = await postInterview("question", index, context);
      if (generation !== interviewGeneration.current) return;
      if (!response.question) throw new Error("The interview question could not be validated.");
      const eventId = nextInterviewEventId.current++;
      setInterviewEvents(current => [...current, { id: eventId, question: response.question!, index }]);
      setTurns(current => [...current, { role: "OCC", text: "Question " + (index + 1) + " of " + MAX_INTERVIEW_TURNS, interviewEventId: eventId }]);
      setInterviewQuestion(response.question);
      setInterviewContext(context);
      setInterviewIndex(index);
      setInterviewPhase("question");
      setSelectedAgent("interview");
      setCurrentTask("interview");
      setSection("interview");
    } catch (cause) {
      if (generation === interviewGeneration.current) setError(cause instanceof Error ? cause.message : "Interview coaching unavailable.");
    } finally {
      if (generation === interviewGeneration.current) setInterviewBusy(false);
    }
  }
  async function submitInterviewAnswer(answer: string) {
    if (interviewPhase !== "question" || !interviewQuestion || !interviewContext || interviewBusy) return;
    if (answer.length < 20 || answer.length > 4000) {
      setError("Write at least 20 characters to receive interview feedback.");
      return;
    }
    const generation = interviewGeneration.current;
    setInterviewBusy(true);
    setError("");
    try {
      const response = await postInterview("feedback", interviewIndex, interviewContext, interviewQuestion.question, answer);
      if (generation !== interviewGeneration.current) return;
      if (!response.feedback) throw new Error("The interview feedback could not be validated.");
      const eventId = nextInterviewEventId.current++;
      setInterviewEvents(current => [...current, {
        id: eventId, index: interviewIndex, question: interviewQuestion!, feedback: response.feedback!,
      }]);
      setTurns(current => [...current,
        { role: "you", text: answer },
        { role: "OCC", text: "Feedback on your answer", interviewEventId: eventId },
      ]);
      setInterviewPhase("feedback");
      setComposer("");
    } catch (cause) {
      if (generation === interviewGeneration.current) setError(cause instanceof Error ? cause.message : "Unable to review your answer.");
    } finally {
      if (generation === interviewGeneration.current) setInterviewBusy(false);
    }
  }
  function restartInterview() {
    // Keep historical cards in this conversation. Only a new or restored
    // conversation should clear the event timeline.
    interviewGeneration.current++;
    setInterviewPhase("idle");
    setInterviewBusy(false);
    setInterviewIndex(0);
    setInterviewQuestion(null);
    setInterviewContext(null);
    setComposer("");
    setTurns(current => [...current, { role: "OCC", text: "Practice complete. Start another mock interview when ready. Answers were not saved automatically." }]);
  }

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
      setAdvice(null); setReviewEvents([]); setKeywordEvents([]); setResult(null); setComposer("");
      setCurrentTask("unknown"); setSection("overview"); resetInterviewState();
      setPasteCvOpen(false); setPasteRoleOpen(false);
      setSessionNotice("Conversation restored. Reattach your CV and job description to continue. Historical coaching result cards were not included in this transcript-only save.");
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
    if (!text || running || interviewBusy) return;
    if (selectedAgent === "interview" && interviewPhase === "question") {
      void submitInterviewAnswer(text);
      return;
    }
    const plan = planOccTurn(text, {
      priorTask: currentTask,
      hasCv: cv.trim().length >= 30,
      hasJobDescription: description.trim().length >= 30,
      hasAdvice: advice !== null,
    });
    if (plan.task === "interview") {
      setSelectedAgent("interview");
      setUsedAgents(current => current.includes("interview") ? current : [...current, "interview"]);
    }
    if (plan.captureJobDescription) setDescription(text.slice(0, 15000));
    setCurrentTask(plan.task);
    setTurns(current => [...current, { role: "you", text }, { role: "OCC", text: plan.reply, cvAction: plan.task === "versions" }]);
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
  const [keywordEvents, setKeywordEvents] = useState<{ id: number; data: Result }[]>([]);
  const nextKeywordId = useRef(1);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [saveRun, setSaveRun] = useState(false);
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
    setKeywordEvents([]);
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
    resetInterviewState();
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
      } else {
        setDescription(text);
        setUploadedJobName(file.name);
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
      const comparison = data as Result;
      const keywordEventId = nextKeywordId.current++;
      setResult(comparison);
      setKeywordEvents(current => [...current, { id: keywordEventId, data: comparison }]);
      setTurns(current => [...current, { role: "OCC", text: "Here is your keyword-only comparison. This is not a hiring score.", keywordEventId }]);
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
  const cvReady = cv.trim().length >= 30;
  const roleReady = description.trim().length >= 30;
  const selectedStructuredCv = savedCvs.find(item => item.id === selectedCvId) ?? null;
  function selectSavedCv(id: string) {
    const document = savedCvs.find(item => item.id === id);
    if (!document) return;
    setSelectedCvId(document.id);
    setCv(cvToPlainText(document.data));
    setUploadedCvName("");
    setPasteCvOpen(false);
  }
  function detachDocument(kind: "cv" | "jobDescription") {
    if (kind === "cv") {
      setCv("");
      setSelectedCvId("");
      setUploadedCvName("");
        setPasteCvOpen(false);
      setAdvice(null);
      setResult(null);
    } else {
      setDescription("");
      setUploadedJobName("");
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
          const interviewEvent = interviewEvents.find(event => event.id === turn.interviewEventId);
          const keywordEvent = keywordEvents.find(event => event.id === turn.keywordEventId);
          return <div id={"occ-message-" + index} key={index} className={"occ2-turn " + (turn.role === "you" ? "occ2-turn-user" : "occ2-turn-assistant")}>
            <div className="occ2-message-bubble">
              <strong>{turn.role === "you" ? "You" : "OCC"}:</strong> {turn.text}
            </div>
            {keywordEvent && <section aria-label="Keyword comparison results" className="occ2-keyword-message">
              <h3>Keyword-only evidence check</h3>
              <p>{keywordEvent.data.checked} role terms checked. This is not a hiring score, match percentage or AI advice.</p>
              <details><summary>Mentioned in your CV ({keywordEvent.data.matchedTerms.length})</summary>
                <p>{keywordEvent.data.matchedTerms.join(", ") || "No exact overlapping terms found."}</p></details>
              <details><summary>Not found in CV text ({keywordEvent.data.unverifiedTerms.length})</summary>
                <p>{keywordEvent.data.unverifiedTerms.join(", ") || "No missing keywords identified."}</p></details>
              <p className="occ2-review-note">{keywordEvent.data.disclaimer}</p>
            </section>}
            {turn.cvAction && <OccCvActionsMessage document={selectedStructuredCv} availableDocuments={savedCvs} onChooseDocument={selectSavedCv} />}
            {review && <OccReviewMessage advice={review.advice} original={review.original} analysisId={review.id}
              profileUsed={review.profileUsed} savedRunId={review.savedRunId}
              isLatest={review.id === reviewEvents[reviewEvents.length - 1]?.id}
              onOpenCvActions={openCvActions} />}
            {interviewEvent && (interviewEvent.feedback
              ? <OccInterviewFeedbackMessage feedback={interviewEvent.feedback}
                  busy={interviewBusy} hasNext={interviewEvent.index + 1 < MAX_INTERVIEW_TURNS}
                  isLatest={interviewPhase === "feedback" && interviewEvent.id === interviewEvents[interviewEvents.length - 1]?.id}
                  onNext={() => void startInterview(interviewEvent.index + 1)}
                  onRestart={restartInterview}
                  onUseWording={text => { setComposer(text); setInterviewPhase("question"); setSelectedAgent("interview"); }} />
              : <OccInterviewQuestionMessage question={interviewEvent.question} index={interviewEvent.index}
                  awaitingAnswer={interviewPhase === "question" && interviewEvent.id === interviewEvents[interviewEvents.length - 1]?.id} />)}
          </div>;
        })}
        {turns.length > 2 && <button type="button" className="occ2-jump" onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}>↓ Jump to latest</button>}
        {(cvReady || roleReady) && <div role="status" aria-label="Attached career documents" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {cvReady && <span style={{ border: "1px solid #c8c1d9", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>✓ CV ready · {uploadedCvName || savedCvs.find(item => item.id === selectedCvId)?.title || "Pasted text"}</span>}
          {roleReady && <span style={{ border: "1px solid #c8c1d9", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>✓ Role ready · {uploadedJobName || "Pasted text"}</span>}
        </div>}
        {error && <p role="alert" style={{ color: "#b44444" }}>{error}</p>}
        <p className="occ2-input-note">PDF and DOCX files are parsed when uploaded. CV and role text is used for AI review only when you choose Review · Saving conversations is optional</p>
      {section === "analysis" && <section aria-label="CV review controls" className="occ2-analysis-inline">
        <p className="occ2-review-kicker">CV Review · Conversation tools</p>
        <h2>Review the documents in this conversation</h2>
        <p>Attach or paste a CV and job description using the chat composer. You can also select an existing Orire CV here. No AI review begins until you choose the review action.</p>
        {savedCvs.length > 0 && <label className="occ2-inline-cv-picker">Use a saved Orire CV
          <select aria-label="Select your CV" value={selectedCvId} onChange={event => {
            if (event.target.value) selectSavedCv(event.target.value);
            else detachDocument("cv");
          }}>
            <option value="">Use an attached or pasted CV</option>
            {savedCvs.map(document => <option value={document.id} key={document.id}>{document.title}</option>)}
          </select>
        </label>}
        <div className="occ2-review-ready" role="status">
          <span>{cvReady ? "✓ CV ready" : "CV needed · Upload or paste in composer"}</span>
          <span>{roleReady ? "✓ Job description ready" : "Job description needed · Upload or paste in composer"}</span>
        </div>
        <details className="occ2-review-options">
          <summary>Review preferences and keyword-only comparison</summary>
          <div className="occ2-review-options-body">
            <label><input type="checkbox" checked={useSavedProfile} onChange={event => setUseSavedProfile(event.target.checked)} /> Include my saved career profile in AI analysis</label>
            <label><input type="checkbox" checked={saveRun} onChange={event => setSaveRun(event.target.checked)} /> Save this recommendation session privately</label>
            <p>Optional keyword comparison checks which role phrases occur in your supplied CV text. It is not a match score and does not call an AI model.</p>
            <button type="button" className="occ2-quiet-action" disabled={running || !cvReady || !roleReady}
              onClick={() => void run()}>Run keyword check (no AI)</button>
          </div>
        </details>
      </section>}
      {selectedAgent === "interview" && <section aria-label="Mock interview workspace" className="occ2-interview-actions-panel">
        {interviewPhase === "idle" && <>
          <h2>Practice interviews in this conversation</h2>
          <p>{roleReady ? "Target role ready. Interview questions, your answers and feedback will appear in the conversation above." : "Attach or paste a target job description using the chat composer. Your CV is optional."}</p>
          <button type="button" disabled={!roleReady || interviewBusy} onClick={() => void startInterview(0)}>
            {interviewBusy ? "Preparing interview…" : "Start mock interview"}
          </button>
        </>}
        {interviewPhase === "question" && <p role="status">Write your own answer in the chat composer below. Use at least 20 characters to receive feedback.</p>}
        {interviewPhase === "feedback" && <p>Review the feedback above, then choose the next question or try clearer wording.</p>}
      </section>}
      
      {section === "memory" && <section aria-label="Career memory workspace"><CareerMemory /></section>}
      <div ref={bottomRef} className="occ2-bottom-anchor" aria-hidden="true" />
      {(running || interviewBusy) && <p role="status" aria-live="polite" className="occ2-working-status">{interviewBusy ? "OCC is preparing your interview coaching…" : "OCC is reviewing the supplied information…"}</p>}
        <form className="occ2-sticky-composer" onSubmit={event => { event.preventDefault(); ask(composer); }} style={{ display: "grid", gap: 8, padding: 12, border: "1px solid #b8afd0", borderRadius: 16, background: "rgba(114,81,174,.04)" }}>
          <textarea aria-label="Message your Career Copilot" style={{ width: "100%", background: "transparent", color: "inherit", font: "inherit", border: 0, resize: "vertical", padding: 8, minHeight: 78, outlineOffset: 2 }} maxLength={selectedAgent === "interview" && interviewPhase === "question" ? 4000 : 1200} value={composer} onChange={event => setComposer(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(composer); } }} placeholder={selectedAgent === "interview" && interviewPhase === "question" ? "Write your interview answer in your own words…" : "Tell OCC what you want to achieve…"} />
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              {uploadInput("cv", "Upload CV", true)}
              {uploadInput("jobDescription", "Upload job description", true)}
              <button type="button" className="occ2-quiet-action" aria-expanded={pasteCvOpen} onClick={() => setPasteCvOpen(value => !value)}>Paste CV</button>
              <button type="button" className="occ2-quiet-action" aria-expanded={pasteRoleOpen} onClick={() => setPasteRoleOpen(value => !value)}>Paste JD</button>
            </div>
            <div className="occ2-composer-cta">
              {selectedAgent === "review" && cvReady && roleReady && <button type="button" className="occ2-review-action" disabled={running} onClick={() => void requestAdvice()}>✦ {running ? "Reviewing…" : "Review attached CV"}</button>}
              <button type="submit" disabled={!composer.trim() || interviewBusy || (selectedAgent === "interview" && interviewPhase === "question" && composer.trim().length < 20)} style={{ padding: "10px 18px", border: 0, borderRadius: 12, color: "#fff", background: "#7251ae", fontWeight: 700 }}>{selectedAgent === "interview" && interviewPhase === "question" ? "Get feedback" : "Send"}</button>
            </div>
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
            <button type="button" onClick={() => editAttachedDocument("cv")}>View / edit</button>
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
            <button type="button" onClick={() => editAttachedDocument("jobDescription")}>View / edit</button>
            <button type="button" onClick={() => detachDocument("jobDescription")}>Remove</button>
          </div>}
        </section>
        <h3 className="occ2-side-label">MILESTONES</h3>
        <nav aria-label="Conversation milestones" className="occ2-milestones">
          {turns.length === 0 && <p>No milestones yet.</p>}
          {turns.map((turn, index) => turn.role === "OCC" ? <button key={index} type="button"
            aria-label={"Go to milestone " + (index + 1) + ": " + (turn.reviewEventId ? "CV review findings" : turn.interviewEventId ? "Interview coaching" : turn.cvAction ? "CV revision actions" : turn.text.slice(0, 40))}
            onClick={() => {
              setContextRailOpen(false);
              document.getElementById("occ-message-" + index)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>
            <span className="occ2-milestone-dot" aria-hidden="true" />
            <span>{turn.reviewEventId ? "CV review findings" : turn.interviewEventId ? "Interview coaching" : turn.cvAction ? "CV revision actions" : turn.text.length > 60 ? turn.text.slice(0, 60) + "…" : turn.text}</span>
          </button> : null)}

        </nav>
        <h3 className="occ2-side-label">CV TEMPLATE</h3>
        <OccTemplatePreview document={selectedStructuredCv} />
        <Link className="occ2-context-link" href="/">Open Orire CV library</Link>
      </aside>
    </div>
  );
}
