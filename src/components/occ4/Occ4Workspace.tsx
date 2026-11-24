"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { OCC_AGENTS, DEFAULT_OCC_AGENT, getOccAgent, type OccAgentId } from "@/lib/occ/agents";
import type { OccAdvice } from "@/lib/occ/recommendations";
import { BrandMark } from "@/components/BrandMark";
import { ChatMessage } from "@/components/ui/ChatMessage";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Diff } from "@/components/ui/Diff";
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
 * Interview and cover-letter flows stay in the current Career Copilot (/occ) and
 * come to occ4 in a later slice.
 */

type Msg = { id: number; node: ReactNode };
type Intent = "review" | "match" | "interview" | "cover" | "default";
type MatchResult = { matchedTerms: string[]; unverifiedTerms: string[]; checked: number; disclaimer: string };

const Spark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

const CHIPS: { label: string; intent: Intent }[] = [
  { label: "Review my CV against the role", intent: "review" },
  { label: "Keyword comparison", intent: "match" },
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

  function handle(intent: Intent, text: string) {
    if (intent === "review") return void runReview(text);
    if (intent === "match") return void runMatch();
    if (intent === "interview") {
      return sayBot("Interview practice is live in the current Career Copilot (/occ) and arrives in occ4 in a later slice.");
    }
    if (intent === "cover") {
      return sayBot("Cover-letter drafting is coming to occ4 in a later slice.");
    }
    sayBot("I can review your CV against a role or run a keyword comparison — add your CV and the job description, then ask.");
  }

  function send(text: string, intent?: Intent) {
    const value = text.trim();
    if (!value || running) return;
    sayUser(value);
    handle(intent ?? classify(value), value);
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
        <button type="button" className="occ4-newchat" onClick={() => setMessages([])}>
          ＋ New conversation
        </button>
        <h2 className="occ4-side-label">Specialists</h2>
        {OCC_AGENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`occ4-spec${a.id === agent ? " on" : ""}`}
            onClick={() => setAgent(a.id)}
          >
            <b>{a.label}</b>
            <span>{a.description}</span>
          </button>
        ))}
        <div className="occ4-side-foot">
          <Link href="/occ" className="occ4-back">
            ← Current Career Copilot
          </Link>
        </div>
      </aside>

      <main className="occ4-main">
        <header className="occ4-head">
          <div className="occ4-id">
            <b>{getOccAgent(agent).label}</b>
            <small>Every Orire feature, by conversation</small>
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
              <label>
                Your CV (plain text)
                <textarea
                  value={cv}
                  onChange={(e) => setCv(e.target.value)}
                  placeholder="Paste your CV text…"
                  rows={4}
                />
              </label>
              <label>
                Job description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Paste the role's job description…"
                  rows={4}
                />
              </label>
              <p className="occ4-context-note">
                Used only to run your request. Nothing is sent anywhere until you ask for a review or
                comparison.
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
              placeholder={running ? "Working…" : "Ask Orire to do something…"}
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
    <CopilotCard title="Keyword comparison" icon={<Spark />}>
      <p className="occ4-advice-summary">
        Checked {result.checked} role term{result.checked === 1 ? "" : "s"} against your CV. This is a
        keyword overlap, not a hiring score.
      </p>
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
