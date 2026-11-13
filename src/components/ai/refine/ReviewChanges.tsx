"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRefineStore } from "@/lib/store/refineStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { scoreGrounding } from "@/lib/ai/guardrails";
import { diffCv } from "@/lib/ai/cvDiff";
import { applyOffered, rebaseProposal } from "@/lib/tailor/proposal";
import { useProposalStore } from "@/lib/store/proposalStore";
import { ChangeList } from "@/components/ai/refine/ChangeList";

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

  const registerProposal = useProposalStore((s) => s.register);
  const recordApplied = useProposalStore((s) => s.recordApplied);
  useEffect(() => {
    if (after) registerProposal("refine", before, after);
  }, [before, after, registerProposal]);

  // Re-based onto the live CV, so a review stays usable after the CV moved on.
  const rebased = useMemo(
    () => (after ? rebaseProposal(before, after, liveCV) : { stale: false, changes: [], skipped: [] }),
    [before, after, liveCV],
  );
  const changes = rebased.changes;
  // Safe-by-default: all suggestions are rejected until the user opts in.
  const [rejected, setRejected] = useState<Set<string>>(
    () => new Set(after ? diffCv(before, after).map((change) => change.id) : []),
  );
  const accepted = changes.filter((c) => !rejected.has(c.id)).length;
  const grounding = result ? scoreGrounding(result) : null;
  const warnings = result?.warnings ?? [];

  const apply = () => {
    if (!after) return;
    if (accepted === 0) {
      closeReview();
      return;
    }
    // Re-read the store at click time so an edit made since render is kept.
    const live = useCVStore.getState().cv;
    const fresh = rebaseProposal(before, after, live);
    const next = applyOffered(live, after, fresh.changes, rejected);
    applyRefinedCV(next);
    recordApplied("refine", live, next);
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

      {rebased.stale && (
        <div className="rev-ground review" role="status">
          <strong>Your CV changed since this was made.</strong>{" "}
          {rebased.skipped.length > 0
            ? `${rebased.skipped.length} change${rebased.skipped.length > 1 ? "s were" : " was"} skipped because you edited the same part${rebased.skipped.length > 1 ? "s" : ""} (${rebased.skipped.map((c) => c.label).join(", ")}). `
            : ""}
          The rest still apply on top of your edits.
        </div>
      )}

      {changes.length === 0 ? (
        <div className="rev-none">
          <p>This version is identical to your current CV, there’s nothing to apply.</p>
        </div>
      ) : (
        <ChangeList changes={changes} rejected={rejected} setRejected={setRejected} />
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
