"use client";

import { motion } from "framer-motion";

type Status = "done" | "planned";

interface Req {
  n: number;
  title: string;
  status: Status;
  note: string;
}

/** The original 21-point spec, mapped to what's shipped in the app today. */
const REQS: Req[] = [
  { n: 1, title: "Named “orire”", status: "done", note: "Brand, studio shell." },
  { n: 2, title: "Interactive UI with smooth animation", status: "done", note: "Framer-motion throughout — panels, cards, template transitions." },
  { n: 3, title: "Re-brand a CV into a new structure", status: "done", note: "Import → parse → pick a template with live preview." },
  { n: 4, title: "Refine a CV to a job description", status: "done", note: "“Refine to JD”, grounded rewrite with before→after deltas." },
  { n: 5, title: "Integrate a user-provided AI assistant", status: "done", note: "Settings: bring-your-own OpenAI or Anthropic key + model." },
  { n: 6, title: "Compare outputs of different assistants", status: "done", note: "Side-by-side compare with per-column apply." },
  { n: 7, title: "LLM-as-judge picks the best output", status: "done", note: "Impartial model ranks both, animated verdict + winner." },
  { n: 8, title: "Two assistants working in parallel", status: "done", note: "Both providers run concurrently in Compare." },
  { n: 9, title: "20 templates, animated transitions", status: "done", note: "20 designs; blur-in + light-sweep switch, cascading sections." },
  { n: 10, title: "Live edit — left edits, right live preview", status: "done", note: "Two-pane editor + click-to-edit directly on the preview." },
  { n: 11, title: "Editing allowed on the final result", status: "done", note: "AI-applied CVs flow into the same editable store." },
  { n: 12, title: "Capture AI errors verbatim", status: "done", note: "Provider proxy returns raw error bodies unchanged." },
  { n: 13, title: "Out-of-this-world template design", status: "done", note: "Bespoke + themed engine; no star ratings or skill bars." },
  { n: 14, title: "Built with Next.js", status: "done", note: "Next.js 16 + Turbopack, App Router." },
  { n: 15, title: "Local now, Tauri/desktop later", status: "planned", note: "Runs locally today; desktop packaging is deferred." },
  { n: 16, title: "Rate final CV against the initial", status: "done", note: "“Rate” — deterministic 6-metric score, initial→final delta." },
  { n: 17, title: "Drag to rearrange edit boxes/items", status: "done", note: "Section chips, cards and bullets all drag-reorder." },
  { n: 18, title: "Auto-expanding edit boxes (no inner scroll)", status: "done", note: "AutoTextarea grows to fit content." },
  { n: 19, title: "Upload multiple CVs incl. PDF & DOCX", status: "done", note: "Multi-file import with text extraction + mapping." },
  { n: 20, title: "Simulate a 100%-match CV for a JD", status: "done", note: "“Simulate” — ideal benchmark CV + deterministic gap analysis." },
  { n: 21, title: "Guardrails, evaluation, determinism", status: "done", note: "Post-hoc fact-grounding; deterministic scoring & gaps." },
];

export function ProgressView() {
  const done = REQS.filter((r) => r.status === "done").length;
  const planned = REQS.length - done;
  const pct = Math.round((done / REQS.length) * 100);

  return (
    <motion.div
      className="ws-view prog-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
        <div className="ws-head">
          <div>
            <h2>What’s shipped</h2>
            <p>Progress against the original 21-point brief.</p>
          </div>
        </div>

        <div className="prog-summary">
          <div className="prog-bar">
            <motion.div
              className="prog-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
          <div className="prog-counts">
            <span><strong>{done}</strong>/{REQS.length} shipped</span>
            {planned > 0 && <span className="prog-planned-count">{planned} planned</span>}
          </div>
        </div>

        <ul className="prog-list">
          {REQS.map((r, i) => (
            <motion.li
              key={r.n}
              className={`prog-item is-${r.status}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.25 }}
            >
              <span className="prog-mark" aria-hidden>{r.status === "done" ? "✓" : "◷"}</span>
              <span className="prog-num">{String(r.n).padStart(2, "0")}</span>
              <div className="prog-text">
                <span className="prog-title">{r.title}</span>
                <span className="prog-note">{r.note}</span>
              </div>
              <span className={`prog-tag prog-tag-${r.status}`}>
                {r.status === "done" ? "Done" : "Planned"}
              </span>
            </motion.li>
          ))}
        </ul>
    </motion.div>
  );
}
