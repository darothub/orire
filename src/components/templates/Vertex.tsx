"use client";

import { motion } from "framer-motion";
import type { CVData, SectionKey } from "@/lib/cv/schema";
import { container, item, dateRange, normalizedHref } from "./shared";

/** Vertex — bold full-height gradient sidebar with crisp white main column. */
export function Vertex({ cv }: { cv: CVData }) {
  const { basics } = cv;
  const initials = (basics.fullName || "Y N")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const section = (key: SectionKey) => {
    switch (key) {
      case "summary":
        return basics.summary ? (
          <motion.section key="summary" variants={item} layout className="vx-block">
            <h2 className="vx-h2">Profile</h2>
            <p className="vx-summary">{basics.summary}</p>
          </motion.section>
        ) : null;
      case "experience":
        return cv.experience.length ? (
          <motion.section key="experience" variants={item} layout className="vx-block">
            <h2 className="vx-h2">Experience</h2>
            {cv.experience.map((exp) => (
              <motion.div key={exp.id} variants={item} layout className="vx-role">
                <span className="vx-node" />
                <div className="vx-role-head">
                  <p className="vx-role-title">{exp.role || "Role"}</p>
                  <span className="vx-dates">{dateRange(exp.startDate, exp.endDate, exp.current)}</span>
                </div>
                <p className="vx-co">
                  {exp.company}
                  {exp.location ? ` · ${exp.location}` : ""}
                </p>
                {exp.highlights.filter(Boolean).length > 0 && (
                  <ul className="vx-bullets">
                    {exp.highlights.filter(Boolean).map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </motion.section>
        ) : null;
      case "education":
        return cv.education.length ? (
          <motion.section key="education" variants={item} layout className="vx-block">
            <h2 className="vx-h2">Education</h2>
            {cv.education.map((ed) => (
              <motion.div key={ed.id} variants={item} layout className="vx-role">
                <span className="vx-node" />
                <div className="vx-role-head">
                  <p className="vx-role-title">
                    {ed.degree}
                    {ed.field ? ` · ${ed.field}` : ""}
                  </p>
                  <span className="vx-dates">{dateRange(ed.startDate, ed.endDate)}</span>
                </div>
                <p className="vx-co">{ed.institution}</p>
                {ed.details && <p className="vx-details">{ed.details}</p>}
              </motion.div>
            ))}
          </motion.section>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <motion.article variants={container} initial="hidden" animate="show" className="vertex" aria-label="CV preview">
      <aside className="vx-side">
        <motion.div variants={item} className="vx-avatar">{initials}</motion.div>
        <motion.h1 variants={item} className="vx-name">{basics.fullName || "Your Name"}</motion.h1>
        {basics.title && <motion.p variants={item} className="vx-title">{basics.title}</motion.p>}

        <motion.div variants={item} className="vx-side-block">
          <h3 className="vx-side-h">Contact</h3>
          <div className="vx-contact">
            {[basics.location, basics.email, basics.phone].filter(Boolean).map((c, i) => (
              <span key={i}>{c}</span>
            ))}
            {basics.links.filter((l) => l.url).map((l) => (
              <a key={l.id} href={normalizedHref(l.url)} className="vx-link">
                {l.label || l.url}
              </a>
            ))}
          </div>
        </motion.div>

        {cv.skills.length > 0 && (
          <motion.div variants={item} className="vx-side-block">
            <h3 className="vx-side-h">Skills</h3>
            {cv.skills.map((g) => (
              <div key={g.id} className="vx-skillgroup">
                <p className="vx-skillcat">{g.category}</p>
                <div className="vx-chips">
                  {g.items.map((s, i) => (
                    <span key={i} className="vx-chip">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </aside>

      <div className="vx-main">{cv.order.filter((k) => k !== "skills").map(section)}</div>
    </motion.article>
  );
}
