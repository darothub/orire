"use client";

import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { useProposalStore } from "@/lib/store/proposalStore";
import { cvHash, rebaseProposal, type ProposalTool } from "@/lib/tailor/proposal";

const TOOL_LABEL: Record<ProposalTool, string> = { refine: "Refine", coach: "Coach" };

/**
 * One inbox for pending changes from any tool, plus a one-step undo of the last
 * accepted proposal. Nothing here writes to the CV except the explicit undo.
 */
export function TailorInbox() {
  const live = useCVStore((s) => s.cv);
  const loadCV = useCVStore((s) => s.loadCV);
  const setView = useViewStore((s) => s.setView);
  const proposals = useProposalStore((s) => s.proposals);
  const lastApplied = useProposalStore((s) => s.lastApplied);
  const clearApplied = useProposalStore((s) => s.clearApplied);

  const canUndo = !!lastApplied && cvHash(live) === lastApplied.resultHash;
  if (proposals.length === 0 && !canUndo) return null;

  return (
    <section className="tailor-inbox" aria-labelledby="tailor-inbox-title">
      <h3 id="tailor-inbox-title" className="tailor-tools-title">Review changes</h3>
      {proposals.length > 0 && (
        <ul className="tailor-tools">
          {proposals.map((p) => {
            const r = rebaseProposal(p.base, p.after, live);
            return (
              <li key={p.id} className="tailor-tool">
                <div className="tailor-tool-main">
                  <strong>{TOOL_LABEL[p.tool]}: {r.changes.length} change{r.changes.length === 1 ? "" : "s"} ready to review</strong>
                  <p>
                    {r.stale
                      ? `Your CV changed since this was made.${r.skipped.length ? ` ${r.skipped.length} skipped because you edited the same part.` : " The rest apply on top of your edits."}`
                      : "Nothing is applied until you accept it."}
                  </p>
                </div>
                <button type="button" className="flow-btn primary" onClick={() => setView(p.tool)}>Review</button>
              </li>
            );
          })}
        </ul>
      )}
      {canUndo && lastApplied && (
        <p className="tailor-undo" role="status">
          {TOOL_LABEL[lastApplied.tool]} changes applied.{" "}
          <button
            type="button"
            className="tailor-link"
            onClick={() => {
              loadCV(lastApplied.previous);
              clearApplied();
            }}
          >
            Undo
          </button>
        </p>
      )}
    </section>
  );
}
