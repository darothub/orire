"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRefineStore } from "@/lib/store/refineStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { scoreGrounding } from "@/lib/ai/guardrails";
import { diffCv, applyReviewed, type CvChange } from "@/lib/ai/cvDiff";

/**
 * Story 2 — AI-edit transparency. Before a refined CV touches the editor, show
 * exactly what the assistant changed, line by line (before → after), and let
 * the user accept or reject each change. The guardrail result (`factGround`) is
 * surfaced up top so the user can see nothing was invented. Accepting
 * everything applies the full refined CV; rejecting a change surgically keeps
 * that one piece of the original (see `applyReviewed`).
 */
export function ReviewChanges({ provider }: { provider: ProviderId }) {
  const cols = useRefineStore((s) => s.cols);
  const baseCV = useRefineStore((s) => s.baseCV);
  const closeReview = useRefineStore((s) => s.closeReview);
  const markApplied = useRefineStore((s) => s.markApplied);
  const liveCV = useCVStore((s) => s.cv);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const setView = useViewStore((s) => s.setView);

  const meta = PROVIDERS[provider];
  const state = cols[provider];
  const result = state?.phase === "done" ? state.result : undefined;
  // Diff against the CV as it was when the run started (baseCV) — that is what
  // the assistant actually rewrote. Fall back to the live CV defensively.
  const before = baseCV ?? liveCV;
  const after = result?.cv ?? null;

  const changes = useMemo<CvChange[]>(() => (after ? diffCv(before, after) : []), [before, after]);
  const [rejected, setRejected] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setRejected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const accepted = changes.length - rejected.size;
  const grounding = result ? scoreGrounding(result) : null;
  const warnings = result?.warnings ?? [];

  const apply = () => {
    if (!after) return;
    applyRefinedCV(applyReviewed(before, after, rejected));
    markApplied(provider);
    closeReview();
    setView("edit");
  };

  if (!result || !after) {
    return (
      <div className="rev">
        <p className="rev-empty">This version isn’t ready to review yet.</p>
        <button className="flow-btn ghost" onClick={closeReview}>Back to comparison</button>
      </div>
    );
  }

  return (
    <motion.div
      className="rev"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rev-head">
        <button className="rev-back" onClick={closeReview}>← Comparison</button>
        <div className="rev-title">
          <strong>Review {meta.label}’s changes</strong>
          <span>Accept or reject each edit before it touches your CV. Nothing is applied until you confirm.</span>
        </div>
      </div>

      <div className={`rev-ground ${grounding?.label ?? "clean"}`}>
        {warnings.length === 0 ? (
          <p>✓ Every change is grounded in your original — <strong>nothing was invented</strong>. Fidelity {grounding?.score ?? 100}%.</p>
        ) : (
          <>
            <p>
              <strong>Fidelity {grounding?.score ?? 0}%</strong> · changes stay grounded in your facts, with{" "}
              {warnings.length} guardrail note{warnings.length > 1 ? "s" : ""} to check below.
            </p>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </>
        )}
      </div>

      {changes.length === 0 ? (
        <div className="rev-none">
          <p>This version is identical to your current CV — there’s nothing to apply.</p>
        </div>
      ) : (
        <>
          <div className="rev-bulk">
            <span>{accepted} of {changes.length} change{changes.length > 1 ? "s" : ""} selected</span>
            <div className="rev-bulk-btns">
              <button onClick={() => setRejected(new Set())} disabled={rejected.size === 0}>Accept all</button>
              <button onClick={() => setRejected(new Set(changes.map((c) => c.id)))} disabled={rejected.size === changes.length}>Reject all</button>
            </div>
          </div>

          <div className="rev-list">
            {changes.map((c) => {
              const isRejected = rejected.has(c.id);
              return (
                <div key={c.id} className={`rev-change${isRejected ? " rejected" : ""}`}>
                  <div className="rev-change-head">
                    <span className="rev-change-label">{c.label}</span>
                    <button
                      className={`rev-toggle${isRejected ? "" : " on"}`}
                      onClick={() => toggle(c.id)}
                      aria-pressed={!isRejected}
                    >
                      {isRejected ? "Rejected — keeping original" : "✓ Accepted"}
                    </button>
                  </div>
                  <div className="rev-diff">
                    <div className="rev-side before">
                      <span className="rev-side-tag">Your original</span>
                      {c.before.filter((l) => l.trim()).length ? (
                        <ul>{c.before.filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}</ul>
                      ) : (
                        <p className="rev-side-empty">— empty —</p>
                      )}
                    </div>
                    <div className="rev-side after">
                      <span className="rev-side-tag">{isRejected ? "Suggested (not applied)" : "Will apply"}</span>
                      {c.after.filter((l) => l.trim()).length ? (
                        <ul>{c.after.filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}</ul>
                      ) : (
                        <p className="rev-side-empty">— empty —</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="rev-foot">
        <button className="flow-btn ghost" onClick={closeReview}>Cancel</button>
        <button className="flow-btn primary lg" onClick={changes.length === 0 ? closeReview : apply}>
          {changes.length === 0
            ? "Back to comparison"
            : accepted === 0
              ? "Keep my original CV"
              : `Apply ${accepted} change${accepted > 1 ? "s" : ""} to my CV`}
        </button>
      </div>
    </motion.div>
  );
}
