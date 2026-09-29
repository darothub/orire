"use client";

import { motion } from "framer-motion";
import type { CVData, SectionKey } from "@/lib/cv/schema";
import { container, item, dateRange, normalizedHref } from "./shared";

/** Meridian — Swiss minimalist: mono labels, hairline rules, gutter-aligned dates. */
export function Meridian({ cv }: { cv: CVData }) {
  const { basics } = cv;

  const section = (key: SectionKey) => {
    switch (key) {
      case "summary":
        return basics.summary ? (
          <motion.section key="summary" variants={item} layout className="md-row">
            <div className="md-label">01 — Profile</div>
            <p className="md-summary">{basics.summary}</p>
          </motion.section>
        ) : null;
      case "experience":
        return cv.experience.length ? (
          <motion.section key="experience" variants={item} layout className="md-row">
            <div className="md-label">02 — Experience</div>
            <div className="md-list">
              {cv.experience.map((exp) => (
                <motion.div key={exp.id} variants={item} layout className="md-entry">
                  <div className="md-meta">{dateRange(exp.startDate, exp.endDate, exp.current)}</div>
                  <div className="md-entry-body">
                    <p className="md-title">{exp.role || "Role"}</p>
                    <p className="md-co">
                      {exp.company}
                      {exp.location ? `, ${exp.location}` : ""}
                    </p>
                    {exp.highlights.filter(Boolean).length > 0 && (
                      <ul className="md-bullets">
                        {exp.highlights.filter(Boolean).map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "education":
        return cv.education.length ? (
          <motion.section key="education" variants={item} layout className="md-row">
            <div className="md-label">03 — Education</div>
            <div className="md-list">
              {cv.education.map((ed) => (
                <motion.div key={ed.id} variants={item} layout className="md-entry">
                  <div className="md-meta">{dateRange(ed.startDate, ed.endDate)}</div>
                  <div className="md-entry-body">
                    <p className="md-title">
                      {ed.degree}
                      {ed.field ? `, ${ed.field}` : ""}
                    </p>
                    <p className="md-co">{ed.institution}</p>
                    {ed.details && <p className="md-details">{ed.details}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "skills":
        return cv.skills.length ? (
          <motion.section key="skills" variants={item} layout className="md-row">
            <div className="md-label">04 — Skills</div>
            <div className="md-list">
              {cv.skills.map((g) => (
                <div key={g.id} className="md-entry">
                  <div className="md-meta">{g.category}</div>
                  <div className="md-entry-body">
                    <p className="md-skillitems">{g.items.join(", ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <motion.article variants={container} initial="hidden" animate="show" className="meridian" aria-label="CV preview">
      <motion.header variants={item} layout className="md-header">
        <div>
          <h1 className="md-name">{basics.fullName || "Your Name"}</h1>
          {basics.title && <p className="md-role">{basics.title}</p>}
        </div>
        <div className="md-contact">
          {[basics.location, basics.email, basics.phone].filter(Boolean).map((c, i) => (
            <span key={i}>{c}</span>
          ))}
          {basics.links.filter((l) => l.url).map((l) => (
            <a key={l.id} href={normalizedHref(l.url)} className="md-link">
              {l.label || l.url}
            </a>
          ))}
        </div>
      </motion.header>
      <div className="md-body">{cv.order.map(section)}</div>
    </motion.article>
  );
}
