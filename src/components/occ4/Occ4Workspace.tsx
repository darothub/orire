"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import { OCC_AGENTS, DEFAULT_OCC_AGENT, getOccAgent, type OccAgentId } from "@/lib/occ/agents";
import { looksLikeCV, looksLikeJobDescription } from "@/lib/occ/document-validation";
import { MAX_INTERVIEW_TURNS, type InterviewQuestion, type InterviewFeedback } from "@/lib/occ/interview";
import type { OccAdvice } from "@/lib/occ/recommendations";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { ChatMessage } from "@/components/ui/ChatMessage";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Diff } from "@/components/ui/Diff";
import { MatchRing } from "@/components/ui/MatchRing";
import { Occ4Improve } from "./Occ4Improve";
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
 * Specialists work like a model picker: CV Review (Auto) classifies the message,
 * Interview Coach runs a grounded mock interview, and CV Improvement approves a
 * wording change into a new private CV version via POST /api/occ/versions. The
 * cover-letter flow and Career Memory come to occ4 in a later slice.
 */

type Msg = { id: number; node: ReactNode };
type Intent = "review" | "match" | "interview" | "cover" | "default";
type MatchResult = { coverage: number; matched: number; matchedTerms: string[]; unverifiedTerms: string[]; checked: number; disclaimer: string };

const Spark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

const CHIPS: { label: string; intent: Intent }[] = [
  { label: "Review my CV against the role", intent: "review" },
  { label: "Keyword coverage", intent: "match" },
  { label: "Practise an interview", intent: "interview" },
  { label: "Draft a cover letter", intent: "cover" },
];

export function Occ4Workspace() {
  const [agent, setAgent] = useState<OccAgentId>(DEFAULT_OCC_AGENT);
  const [input, setInput] = useState("");
  const [cv, setCv] = useState("");
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
  const [improveOpen, setImproveOpen] = useState(false);
  const idRef = useRef(1);
  const threadRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Msg[]>([]);

  const cvReady = cv.trim().length >= 30;
  const roleReady = description.trim().length >= 30;

  function push(node: ReactNode) {
    const id = idRef.current++;
    setMessages((m) => [...m, { id, node }]);
    requestAnimationFrame(() => {
      if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    });
  }
  const sayUser = (text: string) => push(<ChatMessage role="user">{text}</ChatMessage>);
  const sayBot = (text: string) => push(<ChatMessage role="bot">{text}</ChatMessage>);

  function needContext() {
    sayBot("First, add your CV and the job description so I can work against the real role.");
    setContextOpen(true);
  }

  // CV Improvement surfaces a workbench card once per conversation: pick a saved
  // CV and one field, approve the wording, and it saves a new private version.
  function openImprove() {
    if (improveOpen) {
      sayBot("Use the CV Improvement panel above — pick a saved CV and a field, edit the wording, then approve it.");
      return;
    }
    setImproveOpen(true);
    sayBot("CV Improvement — approve a wording change into a new, private version of one of your saved CVs. Your original is never overwritten.");
    push(
      <CardRow>
        <Occ4Improve />
      </CardRow>,
    );
  }

  async function runReview(goal: string) {
    if (!cvReady || !roleReady) return needContext();
    setRunning(true);
    sayBot("Reviewing your CV against the role…");
    try {
      const response = await fetch("/api/occ/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, description, goal: goal.slice(0, 300), saveRun: false, useSavedProfile: false }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : data.error?.message ?? "OCC could not analyse your CV.");
      }
      push(<CardRow>{renderAdvice(data.advice as OccAdvice)}</CardRow>);
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
      const response = await fetch("/api/occ/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv, description }),
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
    if (intent === "match") return void runMatch();
    if (intent === "interview") return void askQuestion(0);
    if (intent === "cover") {
      return sayBot("Cover-letter drafting is coming to occ4 in a later slice.");
    }
    sayBot("I can review your CV against a role, run a keyword comparison, or practise an interview — add your CV and the job description, then ask.");
  }

  function send(text: string, intent?: Intent) {
    const value = text.trim();
    if (!value || running) return;
    sayUser(value);
    // An explicit action (a chip or a panel button) always wins. Otherwise the
    // selected specialist/mode routes the message — except CV Review, which is
    // Auto: it classifies the message by what you actually asked for.
    if (intent) return handle(intent, value);
    if (agent === "interview") {
      if (intPhase === "question") return void submitAnswer(value);
      if (intPhase === "feedback") return sayBot("Tap “Next question” to continue, or switch to CV Review.");
      return void askQuestion(0);
    }
    if (agent === "improve") {
      return openImprove();
    }
    if (agent === "memory") {
      return sayBot("Career Memory — reviewing what the copilot remembers about you — is coming to occ4 in a later slice.");
    }
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
      if (kind === "cv" && !looksLikeCV(text)) throw new Error("This document does not look like a CV. Upload a résumé showing work experience, skills or education.");
      if (kind === "jobDescription" && !looksLikeJobDescription(text)) throw new Error("This does not look like a job description. Upload a role with responsibilities or requirements.");
      if (kind === "cv") {
        setCv(text);
        setCvFileName(file.name);
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

  return (
    <div className="occ4-layout">
      <aside className="occ4-side">
        <div className="occ4-brand">
          <BrandMark size={28} />
          <div>
            <b>Orire</b>
            <small>CAREER COPILOT</small>
          </div>
        </div>
        <button
          type="button"
          className="occ4-newchat"
          onClick={() => {
            setMessages([]);
            setImproveOpen(false);
            setIntPhase("idle");
          }}
        >
          ＋ New conversation
        </button>
        <p className="occ4-side-hint">
          Pick a specialist from the mode selector at the top — <b>CV Review</b> is Auto.
        </p>
        <div className="occ4-side-foot">
          <Link href="/occ" className="occ4-back">
            ← Current Career Copilot
          </Link>
        </div>
      </aside>

      <main className="occ4-main">
        <header className="occ4-head">
          <div className="occ4-modepick">
            <button
              type="button"
              className="occ4-mode-btn"
              aria-haspopup="menu"
              aria-expanded={modeOpen}
              onClick={() => setModeOpen((o) => !o)}
            >
              <span className="occ4-mode-dot" aria-hidden />
              <span className="occ4-mode-label">{getOccAgent(agent).label}</span>
              {agent === DEFAULT_OCC_AGENT && <span className="occ4-mode-auto">Auto</span>}
              <svg className="occ4-mode-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {modeOpen && (
              <>
                <button type="button" className="occ4-mode-backdrop" aria-label="Close specialist menu" onClick={() => setModeOpen(false)} />
                <div className="occ4-mode-menu" role="menu">
                  {OCC_AGENTS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={a.id === agent}
                      className={`occ4-mode-item${a.id === agent ? " on" : ""}`}
                      onClick={() => {
                        setAgent(a.id);
                        setModeOpen(false);
                        if (a.id === "improve") openImprove();
                      }}
                    >
                      <span className="occ4-mode-item-top">
                        <b>{a.label}</b>
                        {a.id === DEFAULT_OCC_AGENT ? (
                          <span className="occ4-mode-auto">Auto</span>
                        ) : a.id === "interview" || a.id === "improve" ? null : (
                          <span className="occ4-mode-soon">soon</span>
                        )}
                      </span>
                      <span className="occ4-mode-desc">{a.description}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <span className="occ4-preview-note">occ4 · preview</span>
          <span className="occ4-ctx">
            {cvReady ? "CV ✓" : "CV —"} · {roleReady ? "Role ✓" : "Role —"}
          </span>
        </header>

        <div className="occ4-thread" ref={threadRef}>
          <ChatMessage role="bot">
            Morning, Amara. Add your CV and a job description, then ask me to review your CV against
            the role or run a keyword comparison. Everything stays grounded in what&rsquo;s actually
            in your documents.
          </ChatMessage>
          {messages.map((m) => (
            <div key={m.id}>{m.node}</div>
          ))}
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
                    send("Review my CV against the role", "review");
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
                  <span className="occ4-context-hint">Add both your CV and the role to continue.</span>
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
              {contextOpen ? "Hide CV & role" : cvReady && roleReady ? "CV & role ✓" : "Add CV & role"}
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

const ASSESSMENT: Record<OccAdvice["recommendations"][number]["assessment"], { label: string; cls: string }> = {
  supported: { label: "Supported", cls: "occ4-badge--supported" },
  "needs-clarification": { label: "Needs clarification", cls: "occ4-badge--needs" },
  "not-found": { label: "Not found", cls: "occ4-badge--missing" },
};

function renderAdvice(advice: OccAdvice): ReactNode {
  return (
    <CopilotCard title="CV review" icon={<Spark />}>
      <p className="occ4-advice-summary">{advice.summary}</p>
      <div className="occ4-recs">
        {advice.recommendations.map((r, i) => (
          <div className="occ4-rec" key={i}>
            <div className="occ4-rec-head">
              <b>{r.requirement}</b>
              <span className={`occ4-badge ${ASSESSMENT[r.assessment].cls}`}>{ASSESSMENT[r.assessment].label}</span>
            </div>
            <p className="occ4-rec-sug">{r.suggestion}</p>
            {r.cvEvidence && r.sampleWording && (
              <Diff
                oldText={r.cvEvidence}
                newText={r.sampleWording}
                why="Evidence-only rewrite — verify before applying it to your CV."
              />
            )}
            {r.question && <p className="occ4-rec-q">Q · {r.question}</p>}
          </div>
        ))}
      </div>
      {advice.nextSteps.length > 0 && (
        <div className="occ4-next">
          <b>Next steps</b>
          <ul>
            {advice.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="occ4-disclaimer">{advice.disclaimer}</p>
    </CopilotCard>
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

function classify(text: string): Intent {
  const t = text.toLowerCase();
  if (/review|tailor|improve|rewrite|better|advi[cs]e|recommend/.test(t)) return "review";
  if (/match|keyword|compare|overlap|coverage/.test(t)) return "match";
  if (/cover|letter/.test(t)) return "cover";
  if (/interview|practi[cs]e|question/.test(t)) return "interview";
  return "default";
}
