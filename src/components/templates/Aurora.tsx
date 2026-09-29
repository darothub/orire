"use client";

import { motion } from "framer-motion";
import type { CVData, SectionKey } from "@/lib/cv/schema";
import { container, item, dateRange, normalizedHref } from "./shared";

/** Aurora — editorial light, luminous gradient spine, two-column rhythm. */
export function Aurora({ cv }: { cv: CVData }) {
  const { basics } = cv;

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case "summary":
        return basics.summary ? (
          <motion.section key="summary" variants={item} layout className="au-block">
            <h2 className="au-h2">Profile</h2>
            <p className="au-summary">{basics.summary}</p>
          </motion.section>
        ) : null;
      case "experience":
        return cv.experience.length ? (
          <motion.section key="experience" variants={item} layout className="au-block">
            <h2 className="au-h2">Experience</h2>
            <div className="au-timeline">
              {cv.experience.map((exp) => (
                <motion.div key={exp.id} variants={item} layout className="au-role">
                  <div className="au-role-head">
                    <div>
                      <p className="au-role-title">{exp.role || "Role"}</p>
                      <p className="au-role-co">
                        {exp.company}
                        {exp.location ? ` · ${exp.location}` : ""}
                      </p>
                    </div>
                    <span className="au-dates">{dateRange(exp.startDate, exp.endDate, exp.current)}</span>
                  </div>
                  {exp.highlights.filter(Boolean).length > 0 && (
                    <ul className="au-bullets">
                      {exp.highlights.filter(Boolean).map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "education":
        return cv.education.length ? (
          <motion.section key="education" variants={item} layout className="au-block">
            <h2 className="au-h2">Education</h2>
            {cv.education.map((ed) => (
              <motion.div key={ed.id} variants={item} layout className="au-role">
                <div className="au-role-head">
                  <div>
                    <p className="au-role-title">
                      {ed.degree}
                      {ed.field ? ` · ${ed.field}` : ""}
                    </p>
                    <p className="au-role-co">{ed.institution}</p>
                  </div>
                  <span className="au-dates">{dateRange(ed.startDate, ed.endDate)}</span>
                </div>
                {ed.details && <p className="au-details">{ed.details}</p>}
              </motion.div>
            ))}
          </motion.section>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <motion.article variants={container} initial="hidden" animate="show" className="aurora" aria-label="CV preview">
      <motion.header variants={item} layout className="au-header">
        <h1 className="au-name">{basics.fullName || "Your Name"}</h1>
        {basics.title && <p className="au-title">{basics.title}</p>}
        <div className="au-contact">
          {[basics.location, basics.email, basics.phone].filter(Boolean).map((c, i) => (
            <span key={i}>{c}</span>
          ))}
          {basics.links.filter((l) => l.url).map((l) => (
            <a key={l.id} href={normalizedHref(l.url)} className="au-link">
              {l.label || l.url}
            </a>
          ))}
        </div>
      </motion.header>

      <div className="au-grid">
        <div className="au-main">{cv.order.filter((k) => k !== "skills").map(renderSection)}</div>
        <aside className="au-side">
          {cv.skills.length > 0 && (
            <motion.section variants={item} layout className="au-block">
              <h2 className="au-h2">Skills</h2>
              {cv.skills.map((g) => (
                <motion.div key={g.id} variants={item} layout className="au-skillgroup">
                  <p className="au-skillcat">{g.category}</p>
                  <div className="au-chips">
                    {g.items.map((s, i) => (
                      <span key={i} className="au-chip">{s}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.section>
          )}
        </aside>
      </div>
    </motion.article>
  );
}
