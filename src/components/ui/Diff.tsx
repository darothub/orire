"use client";

import "./surfaces.css";

interface DiffProps {
  /** The current text (struck through). */
  oldText: string;
  /** The proposed replacement (highlighted). */
  newText: string;
  /** Why the change was made — surfaces the fact-grounding. */
  why?: string;
  /** Header label. Default "Suggested edit". */
  heading?: string;
  /** Show the "fact-grounded" note in the header. Default true. */
  grounded?: boolean;
  /** Accept handler — the Accept button renders only when provided. */
  onAccept?: () => void;
  /** Reject handler — the Reject button renders only when provided. */
  onReject?: () => void;
}

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/**
 * The trust primitive: every AI edit shown before → after with a reason and an
 * accept/reject choice. Reused by the quality coach, full Refine, and OCC.
 */
export function Diff({
  oldText,
  newText,
  why,
  heading = "Suggested edit",
  grounded = true,
  onAccept,
  onReject,
}: DiffProps) {
  return (
    <div className="or-diff">
      <div className="or-diff__head">
        <span>{heading}</span>
        {grounded && <span className="or-diff__grounded">fact-grounded</span>}
      </div>
      <div className="or-diff__body">
        <div className="or-diff__old">{oldText}</div>
        <div className="or-diff__new">{newText}</div>
        {why && (
          <div className="or-diff__why">
            <Check />
            {why}
          </div>
        )}
      </div>
      {(onAccept || onReject) && (
        <div className="or-diff__actions">
          {onReject && (
            <button type="button" className="or-diff__rej" onClick={onReject}>
              Reject
            </button>
          )}
          {onAccept && (
            <button type="button" className="or-diff__acc" onClick={onAccept}>
              Accept change
            </button>
          )}
        </div>
      )}
    </div>
  );
}
