"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Diff } from "@/components/ui/Diff";
import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { cvDataToText } from "@/lib/cv/cvDataToText";
import { useHydrated } from "@/lib/v4/useHydrated";
import { useInterview } from "@/lib/v4/useInterview";
import { answerReady, hasRole, stepLabel, TOPICS, ANSWER_MAX } from "@/lib/v4/interview";

/** Practise answers for a role, one question at a time, with feedback on each. */
export function V4Interview() {
  const hydrated = useHydrated();
  const started = useCVStore((s) => s.started);
  const cv = useCVStore((s) => s.cv);
  const jd = useTargetStore((s) => s.jd);
  const setJd = useTargetStore((s) => s.setJd);
  const label = useTargetStore((s) => s.label);
  const [editRole, setEditRole] = useState(false);
  const cvText = useMemo(() => (started ? cvDataToText(cv) : ""), [started, cv]);
  const run = useInterview({ description: jd, cv: cvText });
  const { phase, index, question, feedback, answer, error } = run;
  const busy = phase === "asking" || phase === "reviewing";

  if (!hydrated) return null;
  const roleReady = hasRole(jd);

  return (
    <div className="v4-stack">
      <Card pad className="v4-int-role">
        <div>
          <b>{roleReady ? `Practising for ${label || "this role"}` : "Choose the role to practise for"}</b>
          <div className="v4-hint">Questions come from this job description{started ? " and your CV" : ""}.</div>
        </div>
        {roleReady && phase === "idle" && !editRole && (
          <button type="button" className="or-btn" onClick={() => setEditRole(true)}>Change role</button>
        )}
      </Card>

      {(!roleReady || editRole) && phase === "idle" && (
        <Card pad>
          <label className="v4-form v4-int-jd">
            <span>Job description</span>
            <textarea rows={6} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job posting here." />
            <span className="v4-hint">At least a few sentences, so the questions fit the role.</span>
          </label>
          {roleReady && <button type="button" className="or-btn" onClick={() => setEditRole(false)}>Done</button>}
        </Card>
      )}

      {phase !== "idle" && phase !== "done" && <Stepper index={index} />}

      {phase === "idle" && roleReady && !editRole && (
        <Card pad className="v4-int-start">
          <h2 className="v4-h2">Five questions, one at a time</h2>
          <p className="v4-muted">You get a question on each of five topics, write your answer, and get feedback you can act on. Your answers are not saved.</p>
          <button type="button" className="or-btn or-btn--primary v4-int-cta" onClick={() => void run.start()}>Start the interview</button>
          <span className="v4-hint">Each question and review uses part of your daily Copilot allowance.</span>
        </Card>
      )}

      {phase === "asking" && <Card pad><p className="v4-muted" role="status">Preparing your question…</p></Card>}

      {question && (phase === "question" || phase === "reviewing") && (
        <Card pad className="v4-int-q">
          <div className="v4-int-qhead">
            <Pill tone="applied">{stepLabel(index).label}</Pill>
            <span className="v4-hint">Focus: {question.focus}</span>
          </div>
          <h2 className="v4-int-question">{question.question}</h2>
          {question.answerStarters && (
            <div className="v4-int-ways">
              <b>Ways in</b>
              <ul>{question.answerStarters.map((s) => <li key={s}>{s}</li>)}</ul>
              <span className="v4-hint">Examples only. Use your own real experience.</span>
            </div>
          )}
          <label className="v4-form v4-int-answer">
            <span className="v4-sr">Your answer</span>
            <textarea rows={5} value={answer} maxLength={ANSWER_MAX} disabled={busy} onChange={(e) => run.setAnswer(e.target.value)} placeholder="Write your answer here." />
          </label>
          <div className="v4-int-actions">
            <button type="button" className="or-btn or-btn--primary v4-int-cta" disabled={!answerReady(answer) || busy} onClick={() => void run.submit()}>
              {phase === "reviewing" ? "Reviewing…" : "Get feedback"}
            </button>
            <button type="button" className="or-btn" disabled={busy} onClick={run.skip}>Skip question</button>
            {!answerReady(answer) && <span className="v4-hint">Write a few sentences to get feedback.</span>}
          </div>
        </Card>
      )}

      {feedback && phase === "feedback" && (
        <Card pad className="v4-int-fb">
          <h2 className="v4-h2">Feedback</h2>
          <div className="v4-int-fbrows">
            <FbRow tone="offer" title="What worked" body={feedback.strength} />
            <FbRow tone="interview" title="One thing to improve" body={feedback.improvement} />
            {feedback.example && <FbRow tone="applied" title="Example outline" body={`${feedback.example} Illustrative only, not facts about you.`} />}
          </div>
          {feedback.betterWording && (
            <Diff heading="Clearer wording" grounded={feedback.wordingStatus === "grounded"} oldText={answer} newText={feedback.betterWording} why={feedback.whyBetter ?? undefined} />
          )}
          <p className="v4-muted">Follow-up: {feedback.followUp}</p>
          <div className="v4-int-actions">
            <button type="button" className="or-btn or-btn--primary v4-int-cta" onClick={run.next}>{index + 1 >= TOPICS.length ? "Finish" : "Next question"}</button>
            <button type="button" className="or-btn" onClick={run.retry}>Try this answer again</button>
          </div>
        </Card>
      )}

      {phase === "done" && (
        <Card pad className="v4-int-start">
          <h2 className="v4-h2">That was all five topics</h2>
          <p className="v4-muted">Nice work. Use what came up to sharpen your CV for this role.</p>
          <div className="v4-int-actions">
            <Link href="/v4/studio/refine" className="or-btn or-btn--primary v4-int-cta">Refine for this role</Link>
            <button type="button" className="or-btn" onClick={run.restart}>Practise again</button>
          </div>
        </Card>
      )}

      {error && <p className="v4-err" role="alert">{error}</p>}
    </div>
  );
}

function FbRow({ tone, title, body }: { tone: "offer" | "interview" | "applied"; title: string; body: string }) {
  return (
    <div className="v4-int-fbrow">
      <Pill tone={tone}>{title}</Pill>
      <p>{body}</p>
    </div>
  );
}

function Stepper({ index }: { index: number }) {
  return (
    <ol className="v4-int-steps" aria-label="Interview topics">
      {TOPICS.map((t, i) => (
        <li key={t} className={i < index ? "done" : i === index ? "now" : ""} aria-current={i === index ? "step" : undefined}>
          <span aria-hidden>{i < index ? "✓" : i + 1}</span>
          {t}
        </li>
      ))}
    </ol>
  );
}
