"use client";

import { motion } from "framer-motion";

interface Principle {
  icon: string;
  title: string;
  body: string;
}

const PRINCIPLES: Principle[] = [
  {
    icon: "✦",
    title: "Grounded in your facts",
    body: "Every rewrite, refinement and cover letter is built from the facts in your CV. orire restructures and sharpens — it never invents jobs, dates or numbers you didn't provide.",
  },
  {
    icon: "⚖",
    title: "Deterministic rating",
    body: "Your CV is scored against a fixed rubric with no model call, so the same CV always earns the same score. You can measure a real improvement, not a mood.",
  },
  {
    icon: "⟂",
    title: "Compare, then judge",
    body: "Run two assistants in parallel, see them side by side, and let an LLM-as-judge pick the strongest result — with the reasoning shown, never hidden.",
  },
  {
    icon: "◎",
    title: "Simulate the perfect match",
    body: "Paste a job description and orire renders the CV that would match it 100% — a concrete target to aim for, then refines your real experience toward it without inventing anything.",
  },
];

/** About orire — mission and operating principles. */
export function AboutView() {
  return (
    <motion.div
      className="ws-view about-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>About us</h2>
          <p>Why orire exists and the principles we build it on.</p>
        </div>
      </div>

      <motion.section
        className="about-hero"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="about-lead">
          orire turns the CV you already have into one that’s structured,
          elegant and tailored to the role you want. Upload what you have,
          re-brand it into an out-of-the-world template, refine it against a job
          description, and edit live with the real CV on the right.
        </p>
        <p className="about-lead sub">
          We think a great CV should be honest and yours. So orire works from
          your facts, shows its reasoning, and keeps a deterministic score so you
          can see exactly how far a draft has moved.
        </p>
      </motion.section>

      <div className="about-grid">
        {PRINCIPLES.map((p, i) => (
          <motion.div
            key={p.title}
            className="about-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="about-card-icon" aria-hidden>{p.icon}</span>
            <h3 className="about-card-title">{p.title}</h3>
            <p className="about-card-body">{p.body}</p>
          </motion.div>
        ))}
      </div>

      <motion.section
        className="about-foot"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <p>
          Questions, feedback or trouble with your account? Reach us any time
          from your account menu — we read everything.
        </p>
        <span className="about-mark" aria-hidden>orire</span>
      </motion.section>
    </motion.div>
  );
}
