"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { OCC_AGENTS, DEFAULT_OCC_AGENT, getOccAgent, type OccAgentId } from "@/lib/occ/agents";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { ChatMessage } from "@/components/ui/ChatMessage";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Diff } from "@/components/ui/Diff";
import { MatchRing } from "@/components/ui/MatchRing";
import "./occ4.css";

/**
 * occ4 — the Career Copilot conversational surface, rebuilt on the Orire design
 * system (parallel to occ2/occ3; occ2's orchestrator and logic are untouched).
 *
 * This slice is the presentation layer: the shell, the message/result rendering
 * on the design-system primitives, and the real specialist taxonomy from
 * OCC_AGENTS. The responses are design placeholders — wiring the live
 * orchestrator (planOccTurn + the OCC server actions) is the next slice.
 */

type Msg = { id: number; node: ReactNode };
type Intent = "refine" | "match" | "interview" | "cover" | "default";

const Spark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

const CHIPS: { label: string; intent: Intent }[] = [
  { label: "Tailor my CV for a role", intent: "refine" },
  { label: "How well do I match?", intent: "match" },
  { label: "Draft a cover letter", intent: "cover" },
  { label: "Practise an interview", intent: "interview" },
];

export function Occ4Workspace() {
  const [agent, setAgent] = useState<OccAgentId>(DEFAULT_OCC_AGENT);
  const [input, setInput] = useState("");
  const idRef = useRef(1);
  const threadRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      node: (
        <CardRow>
          <CopilotCard
            title="Recommended next"
            icon={<Spark />}
            tag={<span style={{ color: "var(--or-violet-soft)" }}>70% now</span>}
            footer={<Button variant="gold" size="sm">Tailor it now</Button>}
          >
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--or-ink-soft)", margin: 0 }}>
              Your CV closes 70% of the Stripe role. Three focused fixes — design-system ownership,
              Core Web Vitals, and a WCAG mention — would lift it into interview range.
            </p>
          </CopilotCard>
        </CardRow>
      ),
    },
  ]);

  function push(node: ReactNode) {
    const id = idRef.current++;
    setMessages((m) => [...m, { id, node }]);
    requestAnimationFrame(() => {
      if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    });
  }

  function respond(intent: Intent) {
    push(<ChatMessage role="bot">{RESPONSE_TEXT[intent]}</ChatMessage>);
    const card = RESPONSE_CARD[intent];
    if (card) push(<CardRow>{card}</CardRow>);
  }

  function send(text: string, intent?: Intent) {
    const value = text.trim();
    if (!value) return;
    push(<ChatMessage role="user">{value}</ChatMessage>);
    const resolved = intent ?? classify(value);
    window.setTimeout(() => respond(resolved), 420);
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
          <span className="occ4-preview-note">occ4 · design preview</span>
          <span className="occ4-ctx">Context · Stripe — Senior Frontend</span>
        </header>

        <div className="occ4-thread" ref={threadRef}>
          <ChatMessage role="bot">
            Morning, Amara. Ask me to tailor your CV, check how you match a role, draft a cover
            letter, or practise an interview — I&rsquo;ll do it here and you can open it in full
            whenever you want.
          </ChatMessage>
          {messages.map((m) => (
            <div key={m.id}>{m.node}</div>
          ))}
        </div>

        <div className="occ4-composer">
          <div className="occ4-chips">
            {CHIPS.map((c) => (
              <button key={c.intent} type="button" className="occ4-chip" onClick={() => send(c.label, c.intent)}>
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
              placeholder="Ask Orire to do something…"
              aria-label="Message the Career Copilot"
            />
            <button
              type="button"
              className="occ4-send"
              aria-label="Send"
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
      <div style={{ maxWidth: 440, width: "100%" }}>{children}</div>
    </div>
  );
}

function classify(text: string): Intent {
  const t = text.toLowerCase();
  if (/tailor|refine|improve|rewrite|better/.test(t)) return "refine";
  if (/match|score|gap|fit|chance/.test(t)) return "match";
  if (/cover|letter/.test(t)) return "cover";
  if (/interview|practi[cs]e|question/.test(t)) return "interview";
  return "default";
}

const RESPONSE_TEXT: Record<Intent, string> = {
  refine: "Done — I tailored your CV to the Stripe role. Three fact-grounded changes, each tied to something you've shipped:",
  match: "Here's how your current CV reads against the Stripe role:",
  cover: "Here's a first draft, grounded in your CV and the Stripe job description:",
  interview: "Let's practise. Answer in your own words and I'll give grounded feedback:",
  default: "I can tailor your CV, score your match, draft a cover letter, or practise an interview — try one of the suggestions above and I'll run it right here.",
};

const RESPONSE_CARD: Record<Intent, ReactNode | null> = {
  refine: (
    <CopilotCard
      title="CV tailored for Stripe"
      icon={<Spark />}
      tag="70% → 93%"
      footer={
        <>
          <Button variant="primary" size="sm">Review in Studio</Button>
          <Button variant="ghost" size="sm">Save as version</Button>
        </>
      }
    >
      <Diff
        oldText="Responsible for the component library used across the product."
        newText="Owned the company-wide component library, cutting new-feature build time ~30% across 6 product teams."
        why="Stronger verb + your real metric — signals the design-system ownership the role wants."
      />
    </CopilotCard>
  ),
  match: (
    <CopilotCard title="Match analysis" icon={<Spark />}>
      <div className="occ4-ring-row">
        <MatchRing value={70} tone="gold" size={84} label="" />
        <div className="occ4-gaps">
          <div><span className="d" style={{ background: "var(--or-match)" }} />React + TypeScript — strong</div>
          <div><span className="d" style={{ background: "var(--or-gold)" }} />Design-system ownership — partial</div>
          <div><span className="d" style={{ background: "var(--or-gap)" }} />Core Web Vitals — missing</div>
          <div><span className="d" style={{ background: "var(--or-gap)" }} />Accessibility (WCAG) — missing</div>
        </div>
      </div>
    </CopilotCard>
  ),
  cover: (
    <CopilotCard title="Cover letter · draft" icon={<Spark />} tag="grounded">
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--or-ink-soft)", margin: 0 }}>
        Dear Stripe team — I build fast, accessible React interfaces, and I&rsquo;ve spent five years
        turning product ideas into shipped UI. Most recently I owned Vista&rsquo;s component library
        and cut new-feature build time by ~30%. Your Checkout work is exactly where I do my best…
      </p>
    </CopilotCard>
  ),
  interview: (
    <CopilotCard title="Interview practice" icon={<Spark />}>
      <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--or-ink-soft)", margin: 0 }}>
        Tell me about a time you owned a design system end to end. What was broken, what did you
        change, and how did you measure the impact?
      </p>
    </CopilotCard>
  ),
  default: null,
};
