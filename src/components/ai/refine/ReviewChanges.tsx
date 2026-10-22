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
 * what the assistant proposes, line by line (before → after). Automated checks
 * flag some risks but cannot verify the truth of every sentence. Nothing is
 * applied until the user explicitly accepts changes; only reviewed wording is
 * copied to the unchanged source CV (see `applyReviewed`).
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
  // Safe-by-default: all suggestions are rejected until the user opts in.
  const [rejected, setRejected] = useState<Set<string>>(
    () => new Set(after ? diffCv(before, after).map((change) => change.id) : []),
  );
  // The comparison is against the CV captured when the run began. If the
  // editor has changed since, refusing to apply prevents overwriting new work.
  const sourceChanged = JSON.stringify(before) !== JSON.stringify(liveCV);

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
    if (!after || sourceChanged) return;
    if (accepted === 0) {
      closeReview();
      return;
    }
    // Re-read the store at click time: an edit made since render must never
    // get overwritten by a stale AI result even if React hasn't rerendered.
    if (JSON.stringify(useCVStore.getState().cv) !== JSON.stringify(before)) return;
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
          <p>✓ No issues flagged by automated checks. <strong>This does not prove the AI wording is accurate.</strong> Verify every claim against your original CV before accepting.</p>
        ) : (
          <>
            <p>
              <strong>Review required:</strong> automated checks flagged{" "}
              {warnings.length} possible unsupported detail{warnings.length > 1 ? "s" : ""}.
              Only accept wording you can confirm from your experience.
            </p>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </>
        )}
      </div>

      {sourceChanged && (
        <div className="rev-ground review" role="alert">
          <strong>Your CV changed since this AI comparison.</strong>{" "}
          Applying the old result could erase your newer edits. Cancel and run
          Refine again using the current CV.
        </div>
      )}

      {changes.length === 0 ? (
        <div className="rev-none">
          <p>This version is identical to your current CV — there’s nothing to apply.</p>
        </div>
      ) : (
        <>
          <div className="rev-bulk">
            <span>{accepted} of {changes.length} suggestion{changes.length > 1 ? "s" : ""} explicitly accepted</span>
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
                      {isRejected ? "Keep original" : "✓ Accepted"}
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
        <button className="flow-btn primary lg" onClick={changes.length === 0 ? closeReview : apply} disabled={sourceChanged}>
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
