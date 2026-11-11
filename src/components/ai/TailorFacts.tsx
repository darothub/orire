"use client";

import { useFactStore } from "@/lib/store/factStore";
import { liveFacts } from "@/lib/tailor/facts";

/**
 * What you have told us, in one place. Coach and Refine reuse these so nothing
 * is asked twice; delete any fact you no longer want used.
 */
export function TailorFacts() {
  const facts = useFactStore((s) => s.facts);
  const remove = useFactStore((s) => s.remove);
  const clearAll = useFactStore((s) => s.clearAll);
  const live = liveFacts(facts);
  if (live.length === 0) return null;

  return (
    <section className="tailor-facts" aria-labelledby="tailor-facts-title">
      <h3 id="tailor-facts-title" className="tailor-tools-title">Your verified facts ({live.length})</h3>
      <p className="tailor-sub">Your own answers. Coach and Refine reuse them, and only what you typed is ever added.</p>
      <ul className="tailor-fact-list">
        {live.map((f) => (
          <li key={f.id} className="tailor-fact">
            <div>
              <strong>{f.area || "Answer"}</strong>
              <p>{f.answer}</p>
            </div>
            <button type="button" className="tailor-link" onClick={() => remove(f.id)} aria-label={`Delete fact: ${f.area || f.answer.slice(0, 30)}`}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="tailor-link" onClick={clearAll}>Clear all facts</button>
    </section>
  );
}
