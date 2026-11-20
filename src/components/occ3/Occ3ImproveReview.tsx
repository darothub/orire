"use client";
import { useState } from "react";
import type { OccRecommendation } from "@/lib/occ/recommendations";
import { previewCvEdit } from "@/lib/occ/editPreview";

type Props = { original: string; recommendations: OccRecommendation[] };

/** Local, user-approved working draft only. This component never persists CV edits. */
export function Occ3ImproveReview({ original, recommendations }: Props) {
  const [working, setWorking] = useState(original);
  const [selected, setSelected] = useState<number | null>(null);
  const [replacement, setReplacement] = useState("");
  const [verified, setVerified] = useState(false);
  const [rejected, setRejected] = useState<number[]>([]);
  const [approved, setApproved] = useState<number[]>([]);
  const [previousDraft, setPreviousDraft] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const evidence = recommendations
    .map((item, id) => ({ ...item, id }))
    .filter(item => item.assessment === "supported" && item.cvEvidence && item.cvEvidence.length >= 10);
  const chosen = evidence.find(item => item.id === selected);
  const before = chosen?.cvEvidence ?? "";
  const preview = selected !== null ? previewCvEdit(working, { before, after: replacement }) : null;

  function select(id: number) {
    const item = evidence.find(candidate => candidate.id === id);
    if (!item) return;
    setSelected(id); setReplacement(item.sampleWording || item.cvEvidence || "");
    setVerified(false); setStatus("");
  }
  function accept() {
    if (selected === null || preview === null || !verified) return;
    setPreviousDraft(working);
    setWorking(preview);
    setApproved(current => [...current, selected]);
    setSelected(null); setVerified(false); setReplacement("");
    setStatus("Approved for your local draft only. Your saved CV has not changed.");
  }
  function reject() {
    if (selected === null) return;
    setRejected(current => [...current, selected]);
    setSelected(null); setVerified(false); setReplacement("");
    setStatus("Suggestion rejected. No wording was changed.");
  }
  function undo() {
    if (previousDraft === null) return;
    setWorking(previousDraft); setPreviousDraft(null);
    setApproved(current => current.slice(0,-1));
    setSelected(null); setVerified(false);
    setStatus("Last local revision undone.");
  }

  return <section className="occ3-improve" role="region" aria-label="Improve CV suggestions">
    <div className="occ3-improve-heading">
      <strong>Review suggested changes</strong>
      <span>{approved.length} accepted</span>
    </div>
    <p className="occ3-improve-help">Every change is optional. Original wording and suggested wording appear together. Only a local working draft changes when you approve.</p>
    {evidence.length === 0 && <p>No supported CV passages are available for an evidence-based edit. Nothing has been changed.</p>}
    {evidence.map(item => <div className="occ3-improve-item" key={item.id}>
      <div className="occ3-improve-item-heading">
        <strong>{item.requirement}</strong>
        <span>{approved.includes(item.id) ? "Accepted" : rejected.includes(item.id) ? "Rejected" : "Suggested"}</span>
      </div>
      <p>{item.suggestion}</p>
      <div className="occ3-improve-diff">
        <div><small>BEFORE — FROM YOUR CV</small><p>{item.cvEvidence}</p></div>
        <div><small>AFTER — PROPOSED</small><p>{item.sampleWording || "No verified automatic rewrite available. You can propose wording using your own experience."}</p></div>
      </div>
      {!approved.includes(item.id) && !rejected.includes(item.id) && <button className="occ3-improve-edit" type="button" onClick={() => select(item.id)}>
        {selected === item.id ? "Editing this suggestion" : "Review / edit"}
      </button>}
      {selected === item.id && <div className="occ3-improve-editor">
        <label htmlFor={"occ3-improve-text-" + item.id}>Your wording</label>
        <textarea id={"occ3-improve-text-" + item.id} aria-label="Edit proposed CV wording" value={replacement} maxLength={1000}
          onChange={event => { setReplacement(event.target.value); setVerified(false); }} rows={3}/>
        <small>{preview === null
          ? "This passage cannot be replaced in the current draft. It must appear exactly once, and the new wording cannot be blank."
          : "Preview ready. Check that your new wording is factually accurate."}</small>
        <label className="occ3-improve-check">
          <input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)}/>
          I confirm this wording is true, preserves the original meaning and does not add unsupported claims.
        </label>
        <div className="occ3-improve-actions">
          <button type="button" disabled={preview === null || !verified} onClick={accept}>Accept into draft</button>
          <button type="button" onClick={reject}>Reject</button>
          <button type="button" onClick={() => setSelected(null)}>Cancel</button>
        </div>
      </div>}
    </div>)}
    {recommendations.filter(item => !item.cvEvidence || item.assessment !== "supported").length > 0 &&
      <details className="occ3-improve-unverified"><summary>Additional advice needing clarification</summary>
        {recommendations.filter(item => !item.cvEvidence || item.assessment !== "supported").map((item,i)=><p key={i}>{item.suggestion}{item.question ? " — " + item.question : ""}</p>)}
      </details>}
    <details className="occ3-improve-draft"><summary>View local working draft</summary><textarea aria-label="Local working draft" readOnly rows={8} value={working}/></details>
    <div className="occ3-improve-actions">
      <button type="button" disabled={previousDraft === null} onClick={undo}>Undo last edit</button>
      <button type="button" onClick={() => {
        void navigator.clipboard.writeText(working)
          .then(() => setStatus("Working draft copied. Your saved CV is unchanged."))
          .catch(() => setStatus("Unable to copy; open the working draft to select its text."));
      }}>Copy draft</button>
      <button type="button" onClick={() => {
        setWorking(original); setApproved([]); setRejected([]); setPreviousDraft(null);
        setSelected(null); setVerified(false); setStatus("Local draft reset to the original CV.");
      }}>Reset draft</button>
    </div>
    <p className="occ3-improve-note">Suggestions must be verified by you. This preview does not save or overwrite a CV in Orire.</p>
    <p role="status" className="occ3-improve-feedback">{status}</p>
  </section>;
}
