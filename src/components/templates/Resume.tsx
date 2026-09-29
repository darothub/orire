"use client";

import { motion } from "framer-motion";
import type { CVData, SectionKey } from "@/lib/cv/schema";
import { container, item, dateRange, normalizedHref } from "./shared";

export type Layout = "single" | "aside-left" | "aside-right";

/**
 * Shared, semantic resume DOM used by all themed templates.
 * Visual identity comes entirely from the theme class in `root` (see resume.css);
 * structural variety comes from `layout`. Content is data-driven (fact-grounded).
 */
export function Resume({
  cv,
  layout = "single",
  root,
}: {
  cv: CVData;
  layout?: Layout;
  root: string;
}) {
  const { basics } = cv;
  const hasAside = layout !== "single";

  const Skills = cv.skills.length ? (
    <motion.section variants={item} layout className="r-section r-skills-sec">
      <h2 className="r-h2">Skills</h2>
      <div className="r-skills">
        {cv.skills.map((g) => (
          <div key={g.id} className="r-skillgroup">
            <p className="r-skillcat">{g.category}</p>
            <div className="r-chips">
              {g.items.map((s, i) => (
                <span key={i} className="r-chip">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  ) : null;

  const section = (key: SectionKey) => {
    switch (key) {
      case "summary":
        return basics.summary ? (
          <motion.section key="summary" variants={item} layout className="r-section">
            <h2 className="r-h2">Profile</h2>
            <p className="r-summary">{basics.summary}</p>
          </motion.section>
        ) : null;
      case "experience":
        return cv.experience.length ? (
          <motion.section key="experience" variants={item} layout className="r-section">
            <h2 className="r-h2">Experience</h2>
            <div className="r-list">
              {cv.experience.map((exp) => (
                <motion.div key={exp.id} variants={item} layout className="r-role">
                  <div className="r-role-top">
                    <p className="r-role-title">{exp.role || "Role"}</p>
                    <span className="r-dates">{dateRange(exp.startDate, exp.endDate, exp.current)}</span>
                  </div>
                  <p className="r-co">
                    {exp.company}
                    {exp.location ? ` · ${exp.location}` : ""}
                  </p>
                  {exp.highlights.filter(Boolean).length > 0 && (
                    <ul className="r-bullets">
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
          <motion.section key="education" variants={item} layout className="r-section">
            <h2 className="r-h2">Education</h2>
            <div className="r-list">
              {cv.education.map((ed) => (
                <motion.div key={ed.id} variants={item} layout className="r-role">
                  <div className="r-role-top">
                    <p className="r-role-title">
                      {ed.degree}
                      {ed.field ? ` · ${ed.field}` : ""}
                    </p>
                    <span className="r-dates">{dateRange(ed.startDate, ed.endDate)}</span>
                  </div>
                  <p className="r-co">{ed.institution}</p>
                  {ed.details && <p className="r-details">{ed.details}</p>}
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "skills":
        return hasAside ? null : <div key="skills">{Skills}</div>;
      default:
        return null;
    }
  };

  const header = (
    <motion.header variants={item} layout className="r-header">
      <h1 className="r-name">{basics.fullName || "Your Name"}</h1>
      {basics.title && <p className="r-title">{basics.title}</p>}
      <div className="r-contact">
        {[basics.location, basics.email, basics.phone].filter(Boolean).map((c, i) => (
          <span key={i}>{c}</span>
        ))}
        {basics.links.filter((l) => l.url).map((l) => (
          <a key={l.id} href={normalizedHref(l.url)} className="r-link">
            {l.label || l.url}
          </a>
        ))}
      </div>
    </motion.header>
  );

  const main = <div className="r-main">{cv.order.map(section)}</div>;
  const aside = hasAside ? <aside className="r-aside">{Skills}</aside> : null;

  return (
    <motion.article
      variants={container}
      initial="hidden"
      animate="show"
      className={`resume ${root} lay-${layout}`}
      aria-label="CV preview"
    >
      {header}
      {hasAside ? (
        <div className="r-grid">
          {layout === "aside-left" ? (
            <>
              {aside}
              {main}
            </>
          ) : (
            <>
              {main}
              {aside}
            </>
          )}
        </div>
      ) : (
        main
      )}
    </motion.article>
  );
}
