"use client";

import { OccDraftReview } from "./OccDraftReview";
import type { OccAdvice } from "@/lib/occ/recommendations";

type Props = {
  advice: OccAdvice;
  original: string;
  analysisId: number;
  profileUsed: boolean;
  savedRunId: string | null;
  isLatest: boolean;
};

/** A result attached to its assistant turn, never an unrelated page section.
 * Historical in-memory results are read-only with respect to saved CV data.
 */
export function OccReviewMessage({ advice, original, analysisId, profileUsed, savedRunId, isLatest }: Props) {
  return <section
    id={isLatest ? "occ2-advice-results" : undefined}
    aria-label="OCC recommendations workspace"
    className="occ2-review-message"
  >
    <div className="occ2-review-heading">
      <span className="occ2-review-kicker">CV Review · Career Copilot</span>
      <span className="occ2-review-count">{advice.recommendations.length} areas reviewed</span>
    </div>
    <h2>Review findings</h2>
    <p>{advice.summary}</p>
    <p className="occ2-review-facts">Based on the CV and job description supplied for this review. CV statements are not independently verified.</p>
    <div className="occ2-review-findings">
      {advice.recommendations.map((item, index) =>
        <details className="occ2-review-finding" key={index}>
          <summary>
            <span className="occ2-review-number">{index + 1}</span>
            <span className="occ2-review-requirement">{item.requirement}</span>
            <span className="occ2-review-assessment">{item.assessment === "supported" ? "Mentioned in CV" : item.assessment === "not-found" ? "Not found in CV" : "Clarify"}</span>
          </summary>
          <div className="occ2-review-finding-body">
            {item.cvEvidence && <blockquote><strong>CV excerpt</strong><p>{item.cvEvidence}</p></blockquote>}
            <p>{item.suggestion}</p>
            {item.sampleWording && <p><strong>Sample wording — check every fact:</strong> {item.sampleWording}</p>}
            {item.question && <p><strong>Question to clarify:</strong> {item.question}</p>}
          </div>
        </details>)}
    </div>
    {advice.nextSteps.length > 0 && <details className="occ2-review-next">
      <summary>Suggested next steps ({advice.nextSteps.length})</summary>
      <ol>{advice.nextSteps.map((step, index) => <li key={index}>{step}</li>)}</ol>
    </details>}
    <details className="occ2-review-edit">
      <summary>Review and approve suggested CV wording</summary>
      <OccDraftReview key={analysisId} original={original} recommendations={advice.recommendations} />
    </details>
    <p className="occ2-review-note">{advice.disclaimer}</p>
    <p className="occ2-review-note">Saved career profile used: {profileUsed ? "Yes" : "No"} · {savedRunId ? "Recommendation run saved separately" : "Recommendation run not saved"}. The current chat transcript and its result cards are not automatically saved.</p>
  </section>;
}
