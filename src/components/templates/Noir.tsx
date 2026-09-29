"use client";

import { motion } from "framer-motion";
import type { CVData, SectionKey } from "@/lib/cv/schema";
import { container, item, dateRange, normalizedHref } from "./shared";

/** Noir — dark, luxe, gold-accented single column with oversized serif. */
export function Noir({ cv }: { cv: CVData }) {
  const { basics } = cv;

  const section = (key: SectionKey) => {
    switch (key) {
      case "summary":
        return basics.summary ? (
          <motion.section key="summary" variants={item} layout className="nr-block">
            <h2 className="nr-h2">Profile</h2>
            <p className="nr-summary">{basics.summary}</p>
          </motion.section>
        ) : null;
      case "experience":
        return cv.experience.length ? (
          <motion.section key="experience" variants={item} layout className="nr-block">
            <h2 className="nr-h2">Experience</h2>
            {cv.experience.map((exp) => (
              <motion.div key={exp.id} variants={item} layout className="nr-role">
                <div className="nr-role-head">
                  <p className="nr-role-title">{exp.role || "Role"}</p>
                  <span className="nr-dates">{dateRange(exp.startDate, exp.endDate, exp.current)}</span>
                </div>
                <p className="nr-co">
                  {exp.company}
                  {exp.location ? ` · ${exp.location}` : ""}
                </p>
                {exp.highlights.filter(Boolean).length > 0 && (
                  <ul className="nr-bullets">
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
          <motion.section key="education" variants={item} layout className="nr-block">
            <h2 className="nr-h2">Education</h2>
            {cv.education.map((ed) => (
              <motion.div key={ed.id} variants={item} layout className="nr-role">
                <div className="nr-role-head">
                  <p className="nr-role-title">
                    {ed.degree}
                    {ed.field ? ` · ${ed.field}` : ""}
                  </p>
                  <span className="nr-dates">{dateRange(ed.startDate, ed.endDate)}</span>
                </div>
                <p className="nr-co">{ed.institution}</p>
                {ed.details && <p className="nr-details">{ed.details}</p>}
              </motion.div>
            ))}
          </motion.section>
        ) : null;
      case "skills":
        return cv.skills.length ? (
          <motion.section key="skills" variants={item} layout className="nr-block">
            <h2 className="nr-h2">Skills</h2>
            <div className="nr-skills">
              {cv.skills.map((g) => (
                <div key={g.id} className="nr-skillrow">
                  <span className="nr-skillcat">{g.category}</span>
                  <span className="nr-skillitems">{g.items.join(" · ")}</span>
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
    <motion.article variants={container} initial="hidden" animate="show" className="noir" aria-label="CV preview">
      <motion.header variants={item} layout className="nr-header">
        <span className="nr-kicker">Curriculum Vitae</span>
        <h1 className="nr-name">{basics.fullName || "Your Name"}</h1>
        {basics.title && <p className="nr-title">{basics.title}</p>}
        <div className="nr-contact">
          {[basics.location, basics.email, basics.phone].filter(Boolean).map((c, i) => (
            <span key={i}>{c}</span>
          ))}
          {basics.links.filter((l) => l.url).map((l) => (
            <a key={l.id} href={normalizedHref(l.url)} className="nr-link">
              {l.label || l.url}
            </a>
          ))}
        </div>
      </motion.header>
      <div className="nr-body">{cv.order.map(section)}</div>
    </motion.article>
  );
}
