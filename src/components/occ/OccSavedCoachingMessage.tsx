"use client";

import type { OccCoachingSnapshot } from "@/lib/occ/coachingSnapshot";

/** Historical cards are intentionally read-only. No source document is restored,
 * no inferred CV edits are applied, and old interview answers cannot be resubmitted.
 */
export function OccSavedCoachingMessage({ snapshot }: { snapshot: OccCoachingSnapshot }) {
  if (snapshot.kind === "review") {
    return <section aria-label="Saved CV review results" className="occ2-review-message occ2-saved-coaching">
      <p className="occ2-review-kicker">Saved coaching history · CV review</p>
      <h3>Previously saved review</h3>
      <p>{snapshot.summary}</p>
      <p className="occ2-review-facts">CV excerpts below are from your previously supplied CV; the full file was not saved with this result. Claims were not independently verified.</p>
      {snapshot.recommendations.map((rec, i) => <details key={i} className="occ2-review-finding">
        <summary>{rec.requirement} · {rec.assessment === "supported" ? "Mentioned in CV" : rec.assessment === "not-found" ? "Not found in CV" : "Clarify"}</summary>
        <div className="occ2-review-finding-body">
          {rec.cvEvidence && <blockquote><strong>Stored CV excerpt:</strong><p>{rec.cvEvidence}</p></blockquote>}
          <p>{rec.suggestion}</p>
          {rec.sampleWording && <p><strong>Suggested wording to verify:</strong> {rec.sampleWording}</p>}
          {rec.question && <p><strong>Question:</strong> {rec.question}</p>}
        </div>
      </details>)}
      {snapshot.nextSteps.length > 0 && <details><summary>Next steps</summary>
        <ol>{snapshot.nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ol>
      </details>}
      <p className="occ2-review-note">{snapshot.disclaimer}</p>
      <p className="occ2-review-note">Read-only historical result. Reattach your CV and target role to run a new review.</p>
    </section>;
  }
  return <section aria-label="Saved interview feedback" className="occ2-interview-card occ2-saved-coaching">
    <p className="occ2-interview-eyebrow">Saved coaching history · Interview</p>
    <h3>{snapshot.question}</h3>
    <p><strong>Focus:</strong> {snapshot.focus}</p>
    <details><summary>Your previously saved answer</summary><p>{snapshot.answer}</p></details>
    <div><strong>What worked</strong><p>{snapshot.strength}</p></div>
    <div><strong>One improvement</strong><p>{snapshot.improvement}</p></div>
    {snapshot.betterWording && <details><summary>Suggested clearer wording</summary><blockquote>{snapshot.betterWording}</blockquote></details>}
    <p><strong>Follow-up:</strong> {snapshot.followUp}</p>
    <p className="occ2-interview-helper">{snapshot.disclaimer} · Read-only history; no source CV/JD reattached.</p>
  </section>;
}
