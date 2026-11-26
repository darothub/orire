import type { CvChange } from "@/lib/ai/cvDiff";

/**
 * Proposed CV changes as before/after blocks. With `onToggle`, each change gets
 * an Accept/Skip button (Refine); without it the list is read-only (Rewrite
 * voice, which is applied or discarded as a whole).
 */
export function V4ChangeList({ changes, skipped, onToggle }: { changes: CvChange[]; skipped?: ReadonlySet<string>; onToggle?: (id: string) => void }) {
  return (
    <>
      {changes.map((c) => {
        const off = skipped?.has(c.id) ?? false;
        return (
          <div key={c.id} className={`v4-change${off ? " skipped" : ""}`}>
            <b>{c.label}</b>
            <p className="v4-was">{c.before.join("\n")}</p>
            <p className="v4-now">{c.after.join("\n")}</p>
            {onToggle && <button type="button" className="or-btn" onClick={() => onToggle(c.id)}>{off ? "Accept" : "Skip"}</button>}
          </div>
        );
      })}
    </>
  );
}
