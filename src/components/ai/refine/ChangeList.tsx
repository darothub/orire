"use client";

import type { CvChange } from "@/lib/ai/cvDiff";

/** Accept/reject list of before→after changes. Safe by default: the caller owns
 *  the `rejected` set and should start with every change rejected. */
export function ChangeList({
  changes,
  rejected,
  setRejected,
}: {
  changes: CvChange[];
  rejected: Set<string>;
  setRejected: (next: Set<string>) => void;
}) {
  const accepted = changes.length - rejected.size;
  const toggle = (id: string) => {
    const next = new Set(rejected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRejected(next);
  };

  return (
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
  );
}
