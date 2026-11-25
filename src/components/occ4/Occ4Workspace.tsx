"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import { looksLikeCV, looksLikeJobDescription } from "@/lib/occ/document-validation";
import { MAX_INTERVIEW_TURNS, type InterviewQuestion, type InterviewFeedback } from "@/lib/occ/interview";
import type { OccAdvice } from "@/lib/occ/recommendations";
import type { CVData } from "@/lib/cv/schema";
import type { ParsedCV } from "@/lib/ingest/parse";
import { cvDataFromParsed } from "@/lib/cv/fromParsed";
import { cvDataToText } from "@/lib/cv/cvDataToText";
import { parseCVText } from "@/lib/ingest/parse";
import { authorizeRefineRun } from "@/app/actions/refine";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { parseModelJSON, factGround } from "@/lib/ai/guardrails";
import { diffCv, applyReviewed } from "@/lib/ai/cvDiff";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { exportCVtoPDF } from "@/lib/export/pdf";
import { exportCVtoDocx } from "@/lib/export/docx";
import { cvToPlainText } from "@/lib/export/plaintext";
import { coerceCoverLetter } from "@/lib/ai/coverLetter";
import type { CoverLetter } from "@/lib/cv/coverLetter";
import { createVersion } from "@/app/actions/library";
import { type CvField, readCvField, patchCvField, writeCvField } from "@/lib/occ/versionPatch";
import type { SavedOccTurn } from "@/lib/occ/conversationSave";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { ChatMessage } from "@/components/ui/ChatMessage";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Diff } from "@/components/ui/Diff";
import { MatchRing } from "@/components/ui/MatchRing";
import { getTemplate } from "@/components/templates/registry";
import { Occ4Review } from "./Occ4Review";
import { Occ4Templates } from "./Occ4Templates";
import { Occ4Library, type SavedDoc } from "./Occ4Library";
import { Occ4Refine } from "./Occ4Refine";
import { Occ4Export } from "./Occ4Export";
import { Occ4Editor } from "./Occ4Editor";
import { Occ4Applications } from "./Occ4Applications";
import "./occ4.css";

/**
 * occ4 — the Career Copilot conversational surface, rebuilt on the Orire design
 * system (parallel to occ2/occ3; occ2's orchestrator and logic are untouched).
 *
 * Slice 2 wires the real backend: it calls the same gated routes occ2 uses —
 * POST /api/occ/advise (grounded AI review) and POST /api/occ/match (deterministic
 * keyword comparison) — with the same request shape, and renders the real
 * responses on the design-system primitives. The product deliberately does NOT
 * produce a hiring score, so the match result is a keyword comparison, not a %.
 *
 * The flow is one working draft: import a CV (structured into a draft), review
 * with Apply, restyle with templates, draft a grounded cover letter, and save
 * the draft as a new private library version — all on the same draft.
 */

type Msg = { id: number; node: ReactNode };
type Intent = "review" | "refine" | "match" | "simulate" | "template" | "interview" | "cover" | "save" | "library" | "export" | "applications" | "default";
type MatchResult = { coverage: number; matched: number; matchedTerms: string[]; unverifiedTerms: string[]; checked: number; disclaimer: string };

// occ4's specialists behave like a model picker. Kept local (not the shared
// OCC_AGENTS) so occ2/occ3 are untouched: Review is Auto, Simulate/Interview/
// Cover are explicit. Selecting one runs it.
type Specialist = "review" | "simulate" | "interview" | "cover";
const DEFAULT_SPECIALIST: Specialist = "review";
const SPECIALISTS: { id: Specialist; label: string; desc: string }[] = [
  { id: "review", label: "CV Review", desc: "Compare your CV with the JD and suggest fixes" },
  { id: "simulate", label: "Simulate", desc: "Model the gap against the JD and score coverage" },
  { id: "interview", label: "Interview Coach", desc: "Practise questions with grounded feedback" },
  { id: "cover", label: "Cover letter", desc: "Draft a grounded letter from your CV" },
];

const Spark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

// Chips are quick ACTIONS on the draft — specialists (Interview, Cover) live in
// the picker, so they're not duplicated here.
const CHIPS: { label: string; intent: Intent }[] = [
  { label: "Review", intent: "review" },
  { label: "Refine for the JD", intent: "refine" },
  { label: "Keyword coverage", intent: "match" },
  { label: "Templates", intent: "template" },
  { label: "My library", intent: "library" },
  { label: "Save to library", intent: "save" },
  { label: "Export", intent: "export" },
  { label: "Applications", intent: "applications" },
];

// A conversation is scoped to one CV + JD. occ4 keeps several in memory and
// swaps the full working state when you switch — so you can tailor for a few
// jobs in parallel. (Cross-reload/device persistence of the transcript is a
// follow-up that reuses /api/occ/conversations.)
type ConvMeta = { id: string; title: string; backendId?: string; readOnly?: boolean };
type ConvSnapshot = {
  messages: Msg[]; agent: Specialist; cv: string; draft: CVData | null; description: string;
  cvFileName: string; roleFileName: string; coverage: number | null; templateId: string;
  intPhase: "idle" | "question" | "feedback"; intIndex: number; intQuestion: InterviewQuestion | null;
  lastStructured: string; transcript: SavedOccTurn[];
};

export function Occ4Workspace() {
  const [agent, setAgent] = useState<Specialist>(DEFAULT_SPECIALIST);
  const [input, setInput] = useState("");
  const [cv, setCv] = useState("");
  // The working draft — the structured spine every tool reads and writes. When
  // present, review/match run on it (serialized) rather than the raw paste.
  const [draft, setDraft] = useState<CVData | null>(null);
  const [description, setDescription] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [uploading, setUploading] = useState<null | "cv" | "jobDescription">(null);
  const [uploadError, setUploadError] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [roleFileName, setRoleFileName] = useState("");
  const [intPhase, setIntPhase] = useState<"idle" | "question" | "feedback">("idle");
  const [intIndex, setIntIndex] = useState(0);
  const [intQuestion, setIntQuestion] = useState<InterviewQuestion | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editOpenSeq, setEditOpenSeq] = useState(0);
  const [coverage, setCoverage] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState("aurora");
  const descriptionRef = useRef("");
  // Latest draft, so a pushed export card always exports the current CV.
  const liveDraftRef = useRef<CVData | null>(null);
  // Text that produced the current draft, so blurring the paste box or
  // re-uploading the same CV doesn't restructure and re-announce it.
  const lastStructuredRef = useRef("");
  const idRef = useRef(1);
  const threadRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversations, setConversations] = useState<ConvMeta[]>([{ id: "c1", title: "New conversation" }]);
  const [activeId, setActiveId] = useState("c1");
  const [transcript, setTranscript] = useState<SavedOccTurn[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const snapshots = useRef<Map<string, ConvSnapshot>>(new Map());
  const convSeq = useRef(1);

  const cvReady = cv.trim().length >= 30;
  const roleReady = description.trim().length >= 30;
  // In-flight work on the active conversation. While busy, navigation between
  // conversations is locked so a resolving run can't write into another thread.
  const busy = running || !!uploading;

  useEffect(() => { descriptionRef.current = description; }, [description]);
  useEffect(() => { liveDraftRef.current = draft; }, [draft]);
  // Keep the preview's coverage ring in step with the working draft — recomputes
  // whenever the draft changes (e.g. after an applied rewrite) or a JD arrives.
  useEffect(() => {
    if (!draft || !roleReady) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/occ/match", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cv: cvDataToText(draft), description: descriptionRef.current }), cache: "no-store",
        });
        const data = await response.json();
        if (!cancelled && response.ok && typeof data.coverage === "number") setCoverage(data.coverage);
      } catch {
        // Keep the last coverage; the draft edit still stands.
      }
    })();
    return () => { cancelled = true; };
  }, [draft, roleReady]);

  // On mount, list the user's saved conversations in the sidebar (metadata only).
  // Opening one fetches its transcript on demand.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/occ/conversations", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        const saved: { id: string; title: string }[] = Array.isArray(data.conversations) ? data.conversations : [];
        if (cancelled || !saved.length) return;
        setConversations((cs) => [...cs, ...saved.map((s) => ({ id: "saved-" + s.id, title: s.title, backendId: s.id, readOnly: true }))]);
      } catch {
        // Offline or not available — just the in-session conversation.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function captureSnapshot(): ConvSnapshot {
    return { messages, agent, cv, draft, description, cvFileName, roleFileName, coverage, templateId, intPhase, intIndex, intQuestion, lastStructured: lastStructuredRef.current, transcript };
  }
  function resetActiveState() {
    setMessages([]); setAgent(DEFAULT_SPECIALIST); setCv(""); setDraft(null); setDescription("");
    setCvFileName(""); setRoleFileName(""); setCoverage(null); setTemplateId("aurora");
    setIntPhase("idle"); setIntIndex(0); setIntQuestion(null); lastStructuredRef.current = "";
    setContextOpen(false); setPreviewOpen(false); setEditMode(false); setUploadError(""); setTranscript([]); setSaveState("idle");
  }
  function applySnapshot(s: ConvSnapshot) {
    setMessages(s.messages); setAgent(s.agent); setCv(s.cv); setDraft(s.draft); setDescription(s.description);
    setCvFileName(s.cvFileName); setRoleFileName(s.roleFileName); setCoverage(s.coverage); setTemplateId(s.templateId);
    setIntPhase(s.intPhase); setIntIndex(s.intIndex); setIntQuestion(s.intQuestion); lastStructuredRef.current = s.lastStructured;
    setUploadError(""); setTranscript(s.transcript); setSaveState("idle"); setEditMode(false);
  }
  // A conversation counts as empty when it's a local (unsaved) one the user
  // hasn't interacted with yet — no transcript turns. Saved conversations
  // never qualify. The active one reads live state; others read their snapshot.
  function isEmptyConversation(id: string): boolean {
    const c = conversations.find((x) => x.id === id);
    if (!c || c.readOnly || c.backendId) return false;
    if (id === activeId) return transcript.length === 0;
    const snap = snapshots.current.get(id);
    return !snap || snap.transcript.length === 0;
  }
  function newConversation() {
    setNavOpen(false);
    setConfirmDel(null);
    if (busy) return;
    // Don't stack empty conversations: if the current one is untouched, stay on
    // it; otherwise reuse any existing empty one before creating a fresh one.
    if (isEmptyConversation(activeId)) return;
    const existingEmpty = conversations.find((c) => c.id !== activeId && isEmptyConversation(c.id));
    if (existingEmpty) return switchConversation(existingEmpty.id);
    snapshots.current.set(activeId, captureSnapshot());
    const id = "c" + (++convSeq.current);
    setConversations((cs) => [...cs, { id, title: "New conversation" }]);
    setActiveId(id);
    resetActiveState();
  }
  // Delete a conversation. Local ones just drop from the list + snapshots;
  // saved ones are also removed server-side (userId-scoped). The active one is
  // replaced by the next in the list, and we always keep at least one.
  async function deleteConversation(id: string) {
    if (busy) return;
    const c = conversations.find((x) => x.id === id);
    if (!c) return;
    setConfirmDel(null);
    snapshots.current.delete(id);
    if (c.backendId) {
      void fetch(`/api/occ/conversations/${encodeURIComponent(c.backendId)}`, { method: "DELETE" }).catch(() => {});
    }
    const remaining = conversations.filter((x) => x.id !== id);
    if (remaining.length === 0) {
      const nid = "c" + (++convSeq.current);
      setConversations([{ id: nid, title: "New conversation" }]);
      setActiveId(nid);
      resetActiveState();
      return;
    }
    setConversations(remaining);
    if (id === activeId) {
      const next = remaining[0];
      setActiveId(next.id);
      const snap = snapshots.current.get(next.id);
      if (snap) applySnapshot(snap);
      else { resetActiveState(); if (next.backendId) void loadSavedTranscript(next.backendId); }
    }
  }
  function switchConversation(id: string) {
    setNavOpen(false);
    setConfirmDel(null);
    // Don't switch mid-run: a conversation's in-flight result must land in its
    // own thread, never leak into another. The composer is already locked while
    // busy; this locks navigation for the same reason.
    if (busy) return;
    if (id === activeId) return;
    snapshots.current.set(activeId, captureSnapshot());
    const snap = snapshots.current.get(id);
    const target = conversations.find((c) => c.id === id);
    setActiveId(id);
    if (snap) {
      applySnapshot(snap);
    } else {
      resetActiveState();
      // A saved conversation opened for the first time: load its transcript
      // (text history only — the draft and JD were never persisted).
      if (target?.backendId) void loadSavedTranscript(target.backendId);
    }
  }
  async function loadSavedTranscript(backendId: string) {
    try {
      const r = await fetch(`/api/occ/conversations/${encodeURIComponent(backendId)}`, { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      const msgs: { sender: string; text: string }[] = Array.isArray(data.conversation?.messages) ? data.conversation.messages : [];
      setTranscript(msgs.map((m) => ({ role: m.sender === "you" ? "you" : "OCC", text: m.text })));
      sayBot("Here's your saved conversation. Your CV and the JD aren't stored, so add them again to continue working.");
      for (const m of msgs) {
        push(
          <ChatMessage role={m.sender === "you" ? "user" : "bot"} avatar={m.sender === "you" ? "You" : undefined}>
            {m.text}
          </ChatMessage>,
        );
      }
    } catch {
      // Offline or gone — leave the fresh conversation as-is.
    }
  }
  // Explicit save of the active conversation's transcript (text only; CV/JD are
  // never persisted). Upserts by the stored backend id.
  async function saveActive() {
    if (saveState === "saving" || transcript.length === 0) return;
    setSaveState("saving");
    const active = conversations.find((c) => c.id === activeId);
    const title = active && active.title !== "New conversation" ? active.title : (transcript[0]?.text.slice(0, 60) || "Conversation");
    try {
      const r = await fetch("/api/occ/conversations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: active?.backendId, title, primaryAgent: "review", usedAgents: ["review"], turns: transcript }),
      });
      const data = await r.json();
      if (!r.ok || typeof data?.id !== "string") return setSaveState("error");
      const backendId = data.id as string;
      setConversations((cs) => cs.map((c) => (c.id === activeId ? { ...c, backendId, title } : c)));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function push(node: ReactNode) {
    const id = idRef.current++;
    setMessages((m) => [...m, { id, node }]);
    requestAnimationFrame(() => {
      if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    });
  }
  // Keep a text transcript (you/OCC turns) for persistence — alongside the rich
  // card messages, which aren't serialised. Capped to the save limits.
  const logTurn = (role: "you" | "OCC", text: string) => {
    setSaveState("idle");
    setTranscript((t) => (t.length >= 100 ? t : [...t, { role, text: text.slice(0, 2500) }]));
  };
  const sayUser = (text: string) => { logTurn("you", text); push(<ChatMessage role="user" avatar="You">{text}</ChatMessage>); };
  const sayBot = (text: string) => { logTurn("OCC", text); push(<ChatMessage role="bot">{text}</ChatMessage>); };

  function needContext() {
    sayBot("First, add your CV and the job description so I can work against the real role.");
    setContextOpen(true);
  }

  // Refine — a full-CV, JD-tailored rewrite. Reuses the studio's metered,
  // plan-gated flow: authorizeRefineRun consumes one monthly refine and mints a
  // run token that /api/ai/refine requires. The refined CV is grounded, diffed
  // against the draft, and the user accepts/rejects each change before applying.
  async function runRefine() {
    if (!draft) return sayBot("Import or open a CV first so I can refine it.");
    if (!roleReady) return sayBot("Add the job description first — Refine tailors the whole CV to it.");
    setRunning(true);
    sayBot("Refining your whole CV against the JD… this uses one of your monthly refines.");
    try {
      const { provider, models } = useSettingsStore.getState();
      const model = models[provider] ?? "";
      const authz = await authorizeRefineRun([{ provider, model }]);
      if (!authz.ok || !authz.token) {
        return sayBot(authz.block ? `${authz.block.title}: ${authz.block.body}` : "Refine isn't available on your plan.");
      }
      const response = await fetch("/api/ai/refine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, jobDescription: description, cv: draft, runToken: authz.token, facts: [] }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!data?.ok || !data.raw) {
        return sayBot(typeof data?.error?.message === "string" ? data.error.message : "Couldn't refine the CV — try again in a moment.");
      }
      const before = draft;
      const grounded = factGround(before, applyRefinePatch(before, parseModelJSON(data.raw)));
      const changes = diffCv(before, grounded.cv);
      if (changes.length === 0) return sayBot("Your CV already reads well for this role — Refine suggested no changes.");
      push(<CardRow><Occ4Refine changes={changes} onApply={(rejected) => applyRefine(before, grounded.cv, rejected)} /></CardRow>);
    } catch {
      sayBot("Couldn't run Refine. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  }
  function applyRefine(before: CVData, after: CVData, rejected: Set<string>) {
    const next = applyReviewed(before, after, rejected);
    const text = cvDataToText(next);
    setDraft(next);
    setCv(text);
    lastStructuredRef.current = text;
    setPreviewOpen(true);
    sayBot("Applied your accepted changes to the working draft. Save it to your library when you're happy with it.");
  }

  async function runReview(goal: string) {
    if (!cvReady || !roleReady) return needContext();
    setRunning(true);
    sayBot("Reviewing your CV against the JD…");
    try {
      const cvText = draft ? cvDataToText(draft) : cv;
      const response = await fetch("/api/occ/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv: cvText, description, goal: goal.slice(0, 300), saveRun: false, useSavedProfile: false }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : data.error?.message ?? "OCC could not analyse your CV.");
      }
      push(<CardRow><Occ4Review advice={data.advice as OccAdvice} draft={draft} onApply={handleApply} /></CardRow>);
    } catch (e) {
      sayBot(e instanceof Error ? e.message : "The review failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  async function runMatch() {
    if (!cvReady || !roleReady) return needContext();
    setRunning(true);
    sayBot("Comparing the role's keywords against your CV…");
    try {
      const cvText = draft ? cvDataToText(draft) : cv;
      const response = await fetch("/api/occ/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv: cvText, description }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not compare the documents.");
      push(<CardRow>{renderMatch(data as MatchResult)}</CardRow>);
    } catch (e) {
      sayBot(e instanceof Error ? e.message : "The comparison failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  // Apply an approved review rewrite straight into the working draft, then open
  // the preview. Client-side only — saving a version is a later step. Uses a
  // functional update so "Apply all" chains patches instead of clobbering them;
  // the coverage ring refreshes from the effect above.
  function handleApply(field: CvField, replacement: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const existing = readCvField(prev, field);
      if (existing === null) return prev;
      return patchCvField(prev, field, existing, replacement) ?? prev;
    });
    setPreviewOpen(true);
  }

  // Free inline edit from the preview's edit mode.
  function handleInlineEdit(field: CvField, text: string) {
    setDraft((prev) => (prev ? writeCvField(prev, field, text) ?? prev : prev));
  }
  function toggleEdit() {
    setEditMode((on) => {
      if (!on) setEditOpenSeq((s) => s + 1);
      return !on;
    });
    setPreviewOpen(true);
  }

  // Structure pasted CV text into the working draft in-browser (same heuristic
  // parser the upload path uses) when the paste box loses focus — so paste users
  // get the connected flow, not just PDF/DOCX uploaders. Skips re-announcing the
  // same text.
  function structurePastedCv() {
    const text = cv.trim();
    if (text.length < 50 || !looksLikeCV(text) || text === lastStructuredRef.current) return;
    const built = cvDataFromParsed(parseCVText(text));
    lastStructuredRef.current = text;
    setDraft(built);
    push(<CardRow>{renderDraftCard(built, "pasted CV")}</CardRow>);
  }

  // Templates are an action on the draft, not a specialist: the picker restyles
  // the working draft live in the preview. Needs a structured draft to render.
  function runTemplates() {
    if (!draft) {
      sayBot("Import a CV (PDF or DOCX) first and I'll preview it in any template.");
      return;
    }
    setPreviewOpen(true);
    push(<CardRow><Occ4Templates current={templateId} onPick={handlePickTemplate} /></CardRow>);
  }
  function handlePickTemplate(id: string) {
    setTemplateId(id);
    setPreviewOpen(true);
  }

  // Cover letter — reuses the server-keyed, plan-gated /api/ai/cover-letter with
  // the working draft as the grounding CV, so the letter can only restate facts
  // already in the draft.
  // Simulate the gap — reuses the deterministic keyword match and reframes it as
  // a gap view (covered vs missing terms + a coverage reading). Honest by design:
  // it's keyword overlap with the role, never an AI hiring prediction.
  async function runSimulate() {
    if (!cvReady || !roleReady) return needContext();
    setRunning(true);
    sayBot("Modelling the gap between your CV and the role…");
    try {
      const cvText = draft ? cvDataToText(draft) : cv;
      const response = await fetch("/api/occ/match", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv: cvText, description }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) return sayBot(typeof data?.error === "string" ? data.error : "Couldn't run the simulation — try again in a moment.");
      const result = data as MatchResult;
      setCoverage(result.coverage);
      push(<CardRow>{renderSimulate(result)}</CardRow>);
    } catch {
      sayBot("Couldn't reach the simulation service. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  }

  async function runCover() {
    if (!draft) return sayBot("Import a CV (PDF or DOCX) first so I can ground the cover letter in it.");
    if (!roleReady) return sayBot("Add the job description first and I'll tailor the letter to it.");
    setRunning(true);
    sayBot("Drafting a cover letter grounded in your CV…");
    try {
      const response = await fetch("/api/ai/cover-letter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv: draft, jobDescription: description }), cache: "no-store",
      });
      const data = await response.json();
      if (!data?.ok) {
        return sayBot(typeof data?.error?.message === "string" ? data.error.message : "Couldn't draft the cover letter — try again in a moment.");
      }
      const letter = coerceCoverLetter(typeof data.raw === "string" ? data.raw : "");
      push(<CardRow>{renderCover(letter)}</CardRow>);
      sayBot("Grounded in your draft. When you're happy with the CV, save it to your library.");
    } catch {
      sayBot("Couldn't reach the cover-letter service. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  }

  // Save — persists the working draft as a NEW private library version (never the
  // active editor CV: makeActive=false), carrying the chosen template.
  // In-chat export of the working draft, via the studio's export functions.
  // PDF rasterises the hidden off-screen #cv-paper render; Word and text are
  // built from the CVData directly.
  const exportFileName = (c: CVData) => `${c.basics.fullName.trim() || "cv"} CV`;
  async function exportPdf() {
    const c = liveDraftRef.current;
    if (!c) return false;
    return exportCVtoPDF("continuous", exportFileName(c), c);
  }
  async function exportDocx() {
    const c = liveDraftRef.current;
    if (!c) return false;
    return exportCVtoDocx(exportFileName(c), c);
  }
  async function copyDraftText() {
    const c = liveDraftRef.current;
    if (!c) return false;
    try { await navigator.clipboard.writeText(cvToPlainText(c)); return true; } catch { return false; }
  }
  function runApplications() {
    push(<CardRow><Occ4Applications seedRole={draft?.basics.title.trim() || ""} /></CardRow>);
  }
  function runExport() {
    if (!draft) return sayBot("Nothing to export yet — add or open a CV first.");
    push(<CardRow><Occ4Export onPdf={exportPdf} onDocx={exportDocx} onCopy={copyDraftText} /></CardRow>);
  }

  // Library — browse saved CV versions and open one as the working draft,
  // closing the Save → retrieve loop.
  async function runLibrary() {
    setRunning(true);
    sayBot("Fetching your saved CVs…");
    try {
      const response = await fetch("/api/occ/versions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return sayBot(typeof data?.error === "string" ? data.error : "Couldn't load your library — try again in a moment.");
      const docs = (Array.isArray(data.documents) ? data.documents : []) as SavedDoc[];
      push(<CardRow><Occ4Library docs={docs} onOpen={openVersion} /></CardRow>);
    } catch {
      sayBot("Couldn't reach your library. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  }
  function openVersion(doc: SavedDoc) {
    const text = cvDataToText(doc.data);
    setDraft(doc.data);
    setTemplateId(doc.template || "aurora");
    setCv(text);
    lastStructuredRef.current = text;
    setCvFileName(doc.title);
    setPreviewOpen(true);
    sayBot(`Loaded “${doc.title}” as your working draft. Add a job description and I'll review or simulate against it.`);
  }

  async function runSave() {
    if (!draft) return sayBot("There's no working draft to save yet — import a CV first.");
    setRunning(true);
    sayBot("Saving your draft as a new library version…");
    try {
      const name = draft.basics.fullName.trim();
      const title = name ? `${name} — tailored CV` : "OCC tailored CV";
      const res = await createVersion({ title, template: templateId, data: draft, baseline: null, makeActive: false });
      if (!res.ok) {
        return sayBot(res.reason === "unauthenticated" ? "You'll need to sign in to save to your library." : "Couldn't save the version — try again in a moment.");
      }
      push(<CardRow>{renderSaved(title)}</CardRow>);
    } catch {
      sayBot("Couldn't save the version. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  }

  async function askQuestion(index: number) {
    if (!roleReady) {
      needContext();
      return;
    }
    setRunning(true);
    sayBot(index === 0 ? "Let's practise — here's your first question." : "Next question coming up.");
    try {
      const response = await fetch("/api/occ/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "question", description, ...(cvReady ? { cv } : {}), turnIndex: index }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not start the interview.");
      const q = data.question as InterviewQuestion;
      setIntQuestion(q);
      setIntIndex(index);
      setIntPhase("question");
      push(<CardRow>{questionCard(q, index)}</CardRow>);
    } catch (e) {
      sayBot(e instanceof Error ? e.message : "Interview coaching failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  async function submitAnswer(answer: string) {
    const q = intQuestion;
    if (!q) return;
    setRunning(true);
    try {
      const response = await fetch("/api/occ/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "feedback", description, ...(cvReady ? { cv } : {}), question: q.question, answer, turnIndex: intIndex }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not review your answer.");
      setIntPhase("feedback");
      push(<CardRow>{feedbackCard(data.feedback as InterviewFeedback, intIndex, answer)}</CardRow>);
    } catch (e) {
      sayBot(e instanceof Error ? e.message : "Interview coaching failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  function nextQuestion() {
    if (intIndex + 1 >= MAX_INTERVIEW_TURNS) {
      setIntPhase("idle");
      sayBot("That's all five topics — nice work. Switch to CV Review when you're ready to tailor your CV.");
      return;
    }
    void askQuestion(intIndex + 1);
  }

  function questionCard(q: InterviewQuestion, index: number): ReactNode {
    return (
      <CopilotCard title={`Interview question ${index + 1} of ${MAX_INTERVIEW_TURNS}`} icon={<Spark />}>
        <p className="occ4-advice-summary">{q.question}</p>
        <p className="occ4-int-focus">Focus · {q.focus}</p>
        {q.answerStarters && (
          <div className="occ4-starters">
            <b>Ways in</b>
            <ul>
              <li>{q.answerStarters[0]}</li>
              <li>{q.answerStarters[1]}</li>
            </ul>
          </div>
        )}
        <p className="occ4-disclaimer">Type your answer below and press send. Starters are examples — use your own real experience.</p>
      </CopilotCard>
    );
  }

  function feedbackCard(fb: InterviewFeedback, index: number, answer: string): ReactNode {
    const last = index + 1 >= MAX_INTERVIEW_TURNS;
    return (
      <CopilotCard
        title="Feedback"
        icon={<Spark />}
        footer={
          <Button variant="primary" size="sm" onClick={nextQuestion}>
            {last ? "Finish" : "Next question"}
          </Button>
        }
      >
        <div className="occ4-fb">
          <p>
            <b className="occ4-fb-ok">Strength</b> {fb.strength}
          </p>
          <p>
            <b className="occ4-fb-warn">Improve</b> {fb.improvement}
          </p>
          {fb.example && (
            <p>
              <b className="occ4-fb-mute">Example</b> {fb.example}
            </p>
          )}
        </div>
        {fb.betterWording && (
          <Diff
            heading="Clearer wording"
            grounded={fb.wordingStatus === "grounded"}
            oldText={answer}
            newText={fb.betterWording}
            why={fb.whyBetter ?? undefined}
          />
        )}
        <p className="occ4-rec-q">Follow-up · {fb.followUp}</p>
      </CopilotCard>
    );
  }

  function handle(intent: Intent, text: string) {
    if (intent === "review") return void runReview(text);
    if (intent === "refine") return void runRefine();
    if (intent === "match") return void runMatch();
    if (intent === "simulate") return void runSimulate();
    if (intent === "template") return runTemplates();
    if (intent === "interview") return void askQuestion(0);
    if (intent === "cover") return void runCover();
    if (intent === "save") return void runSave();
    if (intent === "library") return void runLibrary();
    if (intent === "export") return runExport();
    if (intent === "applications") return runApplications();
    sayBot("I can review your CV against a role, run a keyword comparison, or practise an interview — add your CV and the job description, then ask.");
  }

  function send(text: string, intent?: Intent) {
    const value = text.trim();
    if (!value || running) return;
    sayUser(value);
    // Name the conversation from its first message.
    setConversations((cs) => cs.map((c) => (c.id === activeId && c.title === "New conversation" ? { ...c, title: value.length > 40 ? value.slice(0, 40) + "…" : value } : c)));
    // An explicit action (a chip or a panel button) always wins. Otherwise the
    // selected specialist/mode routes the message — except CV Review, which is
    // Auto: it classifies the message by what you actually asked for.
    if (intent) return handle(intent, value);
    if (agent === "interview") {
      if (intPhase === "question") return void submitAnswer(value);
      if (intPhase === "feedback") return sayBot("Tap “Next question” to continue, or switch to CV Review.");
      return void askQuestion(0);
    }
    if (agent === "simulate") return void runSimulate();
    if (agent === "cover") return void runCover();
    handle(classify(value), value);
  }

  // Upload an existing CV / JD (PDF, DOCX, TXT) and extract its text via the same
  // /api/parse route occ2 uses — for users who don't have their CV as plain text.
  async function uploadDocument(kind: "cv" | "jobDescription", event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || uploading || running) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "docx", "txt"].includes(ext)) {
      setUploadError("Upload a PDF, DOCX or TXT document.");
      return;
    }
    const maxBytes = ext === "txt" ? 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size === 0 || file.size > maxBytes) {
      setUploadError(ext === "txt" ? "TXT files must be under 1 MB." : "PDF and DOCX files must be under 15 MB.");
      return;
    }
    setUploading(kind);
    setUploadError("");
    try {
      let extracted: string;
      // When the parser can structure the document, keep its ParsedCV so a CV
      // upload becomes an editable working draft, not just a text blob.
      let structured: ParsedCV | null = null;
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
        structured = (parsed.parsed ?? null) as ParsedCV | null;
      }
      const limit = kind === "cv" ? 30000 : 15000;
      const text = extracted.trim();
      if (text.length < 30) throw new Error("Not enough readable text found. Try a text-based PDF, DOCX or TXT file.");
      if (text.length > limit) throw new Error(`Document text exceeds the ${limit.toLocaleString()} character limit. Please shorten it.`);
      if (kind === "cv" && !looksLikeCV(text)) throw new Error("This document does not look like a CV. Upload a résumé showing work experience, skills or education.");
      if (kind === "jobDescription" && !looksLikeJobDescription(text)) throw new Error("This does not look like a job description. Upload a role with responsibilities or requirements.");
      if (kind === "cv") {
        setCv(text);
        setCvFileName(file.name);
        // PDF/DOCX carry a parsed structure from /api/parse; a TXT upload is
        // structured in-browser with the same heuristic parser.
        const built = cvDataFromParsed(structured ?? parseCVText(text));
        lastStructuredRef.current = text;
        setDraft(built);
        push(<CardRow>{renderDraftCard(built, file.name)}</CardRow>);
      } else {
        setDescription(text);
        setRoleFileName(file.name);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not read that document.");
    } finally {
      setUploading(null);
    }
  }

  const DraftTemplate = draft ? getTemplate(templateId).Component : null;

  return (
    <div className={`occ4-layout${previewOpen ? " with-preview" : ""}${navOpen ? " nav-open" : ""}`}>
      <button type="button" className="occ4-nav-backdrop" aria-label="Close conversations" onClick={() => setNavOpen(false)} />
      <aside className="occ4-side">
        <div className="occ4-brand">
          <BrandMark size={28} />
          <div>
            <b>Orire</b>
            <small>CAREER COPILOT</small>
          </div>
        </div>
        <button type="button" className="occ4-newchat" onClick={newConversation} disabled={busy}>
          ＋ New conversation
        </button>
        <div className="occ4-side-label">Conversations</div>
        <div className="occ4-convlist">
          {conversations.map((c) => (
            <div key={c.id} className={`occ4-conv${c.id === activeId ? " on" : ""}`}>
              <button
                type="button"
                className="occ4-conv-open"
                aria-current={c.id === activeId}
                disabled={busy}
                onClick={() => switchConversation(c.id)}
              >
                {c.title}
              </button>
              {confirmDel === c.id ? (
                <span className="occ4-conv-confirm">
                  <button type="button" className="occ4-conv-yes" onClick={() => void deleteConversation(c.id)}>Delete</button>
                  <button type="button" className="occ4-conv-no" aria-label="Keep conversation" onClick={() => setConfirmDel(null)}>✕</button>
                </span>
              ) : (
                <button
                  type="button"
                  className="occ4-conv-del"
                  disabled={busy}
                  aria-label={`Delete ${c.title}`}
                  onClick={() => setConfirmDel(c.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="occ4-side-hint">
          Each conversation keeps its own CV, JD and draft — start a new one for a different job.
        </p>
        <button
          type="button"
          className="occ4-save-conv"
          onClick={() => void saveActive()}
          disabled={transcript.length === 0 || saveState === "saving"}
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Save failed — retry" : "Save conversation"}
        </button>
        <div className="occ4-side-foot">
          <Link href="/occ" className="occ4-back">
            ← Current Career Copilot
          </Link>
        </div>
      </aside>

      <main className="occ4-main">
        <header className="occ4-head">
          <button type="button" className="occ4-navtoggle" aria-label="Conversations" onClick={() => setNavOpen(true)}>☰</button>
          <div className="occ4-modepick">
            <button
              type="button"
              className="occ4-mode-btn"
              aria-haspopup="menu"
              aria-expanded={modeOpen}
              onClick={() => setModeOpen((o) => !o)}
            >
              <span className="occ4-mode-dot" aria-hidden />
              <span className="occ4-mode-label">{SPECIALISTS.find((s) => s.id === agent)?.label}</span>
              {agent === DEFAULT_SPECIALIST && <span className="occ4-mode-auto">Auto</span>}
              <svg className="occ4-mode-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {modeOpen && (
              <>
                <button type="button" className="occ4-mode-backdrop" aria-label="Close specialist menu" onClick={() => setModeOpen(false)} />
                <div className="occ4-mode-menu" role="menu">
                  {SPECIALISTS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={a.id === agent}
                      className={`occ4-mode-item${a.id === agent ? " on" : ""}`}
                      onClick={() => {
                        setAgent(a.id);
                        setModeOpen(false);
                        // A specialist runs when picked (Review stays Auto).
                        if (a.id === "simulate") void runSimulate();
                        else if (a.id === "interview") void askQuestion(0);
                        else if (a.id === "cover") void runCover();
                      }}
                    >
                      <span className="occ4-mode-item-top">
                        <b>{a.label}</b>
                        {a.id === DEFAULT_SPECIALIST && <span className="occ4-mode-auto">Auto</span>}
                      </span>
                      <span className="occ4-mode-desc">{a.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <span className="occ4-preview-note">occ4 · preview</span>
          <span className="occ4-ctx">
            {cvReady ? "CV ✓" : "CV —"} · {roleReady ? "JD ✓" : "JD —"}
          </span>
          <button
            type="button"
            className={`occ4-pv-toggle${previewOpen ? " on" : ""}`}
            aria-pressed={previewOpen}
            onClick={() => setPreviewOpen((o) => !o)}
          >
            ▦ CV
          </button>
        </header>

        <div className="occ4-thread" ref={threadRef} aria-busy={running}>
          <ChatMessage role="bot">
            Add your CV and the job description, then pick a specialist or ask me to review, simulate the
            gap, preview a template or draft a cover letter. Everything stays grounded in what&rsquo;s
            actually in your documents.
          </ChatMessage>
          {messages.map((m) => (
            <div key={m.id}>{m.node}</div>
          ))}
          {running && (
            <ChatMessage role="bot">
              <span className="occ4-working" role="status" aria-live="polite">
                Working<span className="occ4-dots" aria-hidden><i /><i /><i /></span>
              </span>
            </ChatMessage>
          )}
        </div>

        <div className="occ4-composer">
          {contextOpen && (
            <div className="occ4-context">
              <div className="occ4-field">
                <div className="occ4-field-head">
                  <span>Your CV</span>
                  <label className={`occ4-upload${uploading || running ? " disabled" : ""}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
                    </svg>
                    {uploading === "cv" ? "Reading…" : "Upload PDF / DOCX / TXT"}
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      disabled={!!uploading || running}
                      onChange={(e) => void uploadDocument("cv", e)}
                    />
                  </label>
                </div>
                <textarea
                  value={cv}
                  onChange={(e) => setCv(e.target.value)}
                  onBlur={structurePastedCv}
                  placeholder="…or paste your CV text"
                  rows={4}
                />
                {cvFileName && <p className="occ4-file">✓ {cvFileName}</p>}
              </div>
              <div className="occ4-field">
                <div className="occ4-field-head">
                  <span>Job description</span>
                  <label className={`occ4-upload${uploading || running ? " disabled" : ""}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
                    </svg>
                    {uploading === "jobDescription" ? "Reading…" : "Upload PDF / DOCX / TXT"}
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      disabled={!!uploading || running}
                      onChange={(e) => void uploadDocument("jobDescription", e)}
                    />
                  </label>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="…or paste the role's job description"
                  rows={4}
                />
                {roleFileName && <p className="occ4-file">✓ {roleFileName}</p>}
              </div>
              {uploadError && (
                <p className="occ4-upload-error" role="alert">
                  {uploadError}
                </p>
              )}
              <div className="occ4-context-actions">
                <Button
                  variant="gold"
                  size="sm"
                  disabled={!cvReady || !roleReady || !!uploading || running}
                  onClick={() => {
                    setContextOpen(false);
                    send("Review my CV against the JD", "review");
                  }}
                >
                  Review my CV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!cvReady || !roleReady || !!uploading || running}
                  onClick={() => {
                    setContextOpen(false);
                    send("Keyword coverage", "match");
                  }}
                >
                  Keyword coverage
                </Button>
                {(!cvReady || !roleReady) && (
                  <span className="occ4-context-hint">Add both your CV and the JD to continue.</span>
                )}
              </div>
              <p className="occ4-context-note">
                Upload a PDF, DOCX or TXT, or paste text. Used only to run your request — nothing is
                sent anywhere until you ask for a review or comparison.
              </p>
            </div>
          )}
          <div className="occ4-chips">
            <button type="button" className="occ4-chip" onClick={() => setContextOpen((o) => !o)}>
              {contextOpen ? "Hide CV & JD" : cvReady && roleReady ? "CV & JD ✓" : "Add CV & JD"}
            </button>
            {CHIPS.map((c) => (
              <button key={c.intent} type="button" className="occ4-chip" disabled={running} onClick={() => send(c.label, c.intent)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="occ4-box">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  send(input);
                  setInput("");
                }
              }}
              placeholder={
                running
                  ? "Working…"
                  : agent === "interview" && intPhase === "question"
                    ? "Type your answer…"
                    : "Ask Orire to do something…"
              }
              aria-label="Message the Career Copilot"
              disabled={running}
            />
            <button
              type="button"
              className="occ4-send"
              aria-label="Send"
              disabled={running}
              onClick={() => {
                send(input);
                setInput("");
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {draft && DraftTemplate && (
        <div id="cv-paper" aria-hidden className="occ4-export-paper">
          <DraftTemplate cv={draft} />
        </div>
      )}

      {previewOpen && (
        <aside className="occ4-preview" aria-label="Working CV preview">
          <div className="occ4-pv-head">
            <span className="occ4-pv-ctx">
              {cvReady ? "CV ✓" : "CV —"} · {roleReady ? "JD ✓" : "JD —"}
            </span>
            {coverage !== null && <MatchRing value={coverage} tone="gold" size={64} label="coverage" />}
            {draft && (
              <button type="button" className={`occ4-pv-edit${editMode ? " on" : ""}`} aria-pressed={editMode} onClick={toggleEdit}>
                {editMode ? "Done" : "Edit"}
              </button>
            )}
            <button type="button" className="occ4-pv-close" aria-label="Close preview" onClick={() => setPreviewOpen(false)}>
              ✕
            </button>
          </div>
          <div className="occ4-pv-scroll">
            {!draft ? (
              <p className="occ4-pv-empty">Bring a CV (PDF or DOCX) to see your working draft here.</p>
            ) : editMode ? (
              <Occ4Editor key={editOpenSeq} cv={draft} onEdit={handleInlineEdit} />
            ) : DraftTemplate ? (
              <div className="occ4-pv-page paper"><DraftTemplate cv={draft} /></div>
            ) : null}
          </div>
        </aside>
      )}
    </div>
  );
}


/** Bot avatar + a result card, aligned left (no bubble around the card). */
function CardRow({ children }: { children: ReactNode }) {
  return (
    <div className="or-msg or-msg--bot">
      <div className="or-msg__av" aria-hidden>
        ✦
      </div>
      <div style={{ maxWidth: 460, width: "100%" }}>{children}</div>
    </div>
  );
}

function renderMatch(result: MatchResult): ReactNode {
  return (
    <CopilotCard title="Keyword coverage" icon={<Spark />} tag={`${result.coverage}%`}>
      <div className="occ4-cov">
        <MatchRing value={result.coverage} tone="gold" size={82} label="coverage" />
        <p className="occ4-advice-summary" style={{ margin: 0 }}>
          {result.matched} of {result.checked} role term{result.checked === 1 ? "" : "s"} appear in your
          CV. This is keyword coverage, not a hiring score.
        </p>
      </div>
      <div className="occ4-terms">
        <div>
          <b>Found in your CV</b>
          <div className="occ4-chiprow">
            {result.matchedTerms.length ? (
              result.matchedTerms.map((t) => (
                <span key={t} className="occ4-term occ4-term--ok">
                  {t}
                </span>
              ))
            ) : (
              <span className="occ4-term-empty">None matched yet.</span>
            )}
          </div>
        </div>
        <div>
          <b>Not found in your CV</b>
          <div className="occ4-chiprow">
            {result.unverifiedTerms.length ? (
              result.unverifiedTerms.map((t) => (
                <span key={t} className="occ4-term occ4-term--miss">
                  {t}
                </span>
              ))
            ) : (
              <span className="occ4-term-empty">Nothing missing.</span>
            )}
          </div>
        </div>
      </div>
      <p className="occ4-disclaimer">{result.disclaimer}</p>
    </CopilotCard>
  );
}

function renderSimulate(result: MatchResult): ReactNode {
  const gaps = result.unverifiedTerms;
  return (
    <CopilotCard title="Simulate the gap" icon={<Spark />} tag={`${result.coverage}% covered`}>
      <div className="occ4-cov">
        <MatchRing value={result.coverage} tone="gold" size={82} label="coverage" />
        <p className="occ4-advice-summary" style={{ margin: 0 }}>
          Against this role, your CV covers {result.matched} of {result.checked} key term
          {result.checked === 1 ? "" : "s"}.{" "}
          {gaps.length
            ? `Closing the ${gaps.length} gap${gaps.length === 1 ? "" : "s"} below would raise that.`
            : "No obvious keyword gaps."}
        </p>
      </div>
      {gaps.length > 0 && (
        <div className="occ4-terms">
          <div>
            <b>Gaps to close</b>
            <div className="occ4-chiprow">
              {gaps.map((t) => <span key={t} className="occ4-term occ4-term--miss">{t}</span>)}
            </div>
          </div>
        </div>
      )}
      <p className="occ4-disclaimer">
        A deterministic keyword model of the role, not an AI hiring prediction. A missing term is a prompt
        to add evidence, not proof you lack the skill.
      </p>
    </CopilotCard>
  );
}

function renderDraftCard(cv: CVData, source: string): ReactNode {
  const roles = cv.experience.filter((e) => e.company.trim() || e.role.trim()).length;
  const bullets = cv.experience.reduce((n, e) => n + e.highlights.filter((h) => h.trim()).length, 0);
  const skills = cv.skills.reduce((n, g) => n + g.items.filter((s) => s.trim()).length, 0);
  const name = cv.basics.fullName.trim() || "your CV";
  const title = cv.basics.title.trim();
  return (
    <CopilotCard title="Imported your CV" icon={<Spark />} tag="draft ready">
      <p className="occ4-advice-summary">
        I read <b>{source}</b> into an editable working draft — {name}
        {title ? `, ${title}` : ""}. {roles} role{roles === 1 ? "" : "s"}, {bullets} bullet
        {bullets === 1 ? "" : "s"}, {skills} skill{skills === 1 ? "" : "s"}. Add a job description and I&rsquo;ll
        tailor everything to it.
      </p>
      <p className="occ4-disclaimer">
        Structured with the same importer the editor uses — nothing invented. This is your working draft:
        every tool reads and writes it.
      </p>
    </CopilotCard>
  );
}

function renderCover(letter: CoverLetter): ReactNode {
  const full = [letter.opening, ...letter.body, letter.closing, letter.signoff].filter(Boolean).join("\n\n");
  return (
    <CopilotCard title="Cover letter" icon={<Spark />} tag="grounded draft">
      <div className="occ4-cover">
        {letter.opening && <p>{letter.opening}</p>}
        {letter.body.map((p, i) => <p key={i}>{p}</p>)}
        {letter.closing && <p>{letter.closing}</p>}
        {letter.signoff && <p>{letter.signoff}</p>}
      </div>
      <div className="occ4-rec-apply">
        <Button variant="ghost" size="sm" onClick={() => { void navigator.clipboard?.writeText(full); }}>Copy letter</Button>
      </div>
      <p className="occ4-disclaimer">
        Grounded in your working draft — it only restates facts already in your CV. Check names and dates
        before sending.
      </p>
    </CopilotCard>
  );
}

function renderSaved(title: string): ReactNode {
  return (
    <CopilotCard title="Saved to your library" icon={<Spark />} tag="done">
      <p className="occ4-advice-summary">
        Saved <b>{title}</b> as a new private version. Your active CV is untouched — open Orire to find it in
        your library and export to PDF or DOCX.
      </p>
      <div className="occ4-rec-apply"><Link className="occ4-pv-toggle" href="/">Open Orire</Link></div>
    </CopilotCard>
  );
}

function classify(text: string): Intent {
  const t = text.toLowerCase();
  if (/review|tailor|improve|rewrite|better|advi[cs]e|recommend/.test(t)) return "review";
  if (/\brefine\b|full[- ]?cv|whole cv|tailor everything|rewrite the whole/.test(t)) return "refine";
  if (/simulate|gap|ideal candidate|how do i stack/.test(t)) return "simulate";
  if (/match|keyword|compare|overlap|coverage/.test(t)) return "match";
  if (/template|layout|design|theme|style|look/.test(t)) return "template";
  if (/cover|letter/.test(t)) return "cover";
  if (/application|applied|track|pipeline|kanban/.test(t)) return "applications";
  if (/export|download|pdf|docx|word file|copy as text/.test(t)) return "export";
  if (/my library|saved cv|open a cv|load a cv|my cvs|my versions|browse/.test(t)) return "library";
  if (/\bsave\b|keep this|store it|new version/.test(t)) return "save";
  if (/interview|practi[cs]e|question/.test(t)) return "interview";
  return "default";
}
