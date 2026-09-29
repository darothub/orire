"use client";

import { motion } from "framer-motion";
import type { CVData, SectionKey } from "@/lib/cv/schema";
import { container, item, dateRange, normalizedHref } from "./shared";
import { EditableText } from "./EditableText";
import { useCVStore } from "@/lib/store/cvStore";
import { useUIStore } from "@/lib/store/uiStore";

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
  const previewEdit = useUIStore((s) => s.previewEdit);
  const setBasics = useCVStore((s) => s.setBasics);
  const updateExperience = useCVStore((s) => s.updateExperience);
  const setHighlight = useCVStore((s) => s.setHighlight);
  const updateEducation = useCVStore((s) => s.updateEducation);
  const updateProject = useCVStore((s) => s.updateProject);
  const setProjectHighlight = useCVStore((s) => s.setProjectHighlight);
  const updateCertification = useCVStore((s) => s.updateCertification);
  const updateSkillGroup = useCVStore((s) => s.updateSkillGroup);

  const Skills = cv.skills.length && cv.order.includes("skills") ? (
    <motion.section variants={item} layout className="r-section r-skills-sec">
      <h2 className="r-h2">Skills</h2>
      <div className="r-skills">
        {cv.skills.map((g) => (
          <div key={g.id} className="r-skillgroup">
            <EditableText
              as="p"
              className="r-skillcat"
              value={g.category}
              placeholder="Category"
              onCommit={(v) => updateSkillGroup(g.id, { category: v })}
            />
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
        return basics.summary || previewEdit ? (
          <motion.section key="summary" variants={item} layout className="r-section">
            <h2 className="r-h2">Profile</h2>
            <EditableText
              as="p"
              className="r-summary"
              value={basics.summary}
              placeholder="Write a short professional summary…"
              multiline
              onCommit={(v) => setBasics({ summary: v })}
            />
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
                    <EditableText
                      as="p"
                      className="r-role-title"
                      value={exp.role}
                      placeholder="Role"
                      onCommit={(v) => updateExperience(exp.id, { role: v })}
                    />
                    <span className="r-dates">{dateRange(exp.startDate, exp.endDate, exp.current)}</span>
                  </div>
                  <p className="r-co">
                    <EditableText
                      as="span"
                      value={exp.company}
                      placeholder="Company"
                      onCommit={(v) => updateExperience(exp.id, { company: v })}
                    />
                    {exp.location ? ` · ${exp.location}` : ""}
                  </p>
                  {(exp.highlights.filter(Boolean).length > 0 || previewEdit) && (
                    <ul className="r-bullets">
                      {exp.highlights.map((h, i) =>
                        h || previewEdit ? (
                          <EditableText
                            as="li"
                            key={i}
                            value={h}
                            placeholder="Achievement…"
                            multiline
                            onCommit={(v) => setHighlight(exp.id, i, v)}
                          />
                        ) : null,
                      )}
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
                      <EditableText
                        as="span"
                        value={ed.degree}
                        placeholder="Degree"
                        onCommit={(v) => updateEducation(ed.id, { degree: v })}
                      />
                      {ed.field ? ` · ${ed.field}` : ""}
                    </p>
                    <span className="r-dates">{dateRange(ed.startDate, ed.endDate)}</span>
                  </div>
                  <EditableText
                    as="p"
                    className="r-co"
                    value={ed.institution}
                    placeholder="Institution"
                    onCommit={(v) => updateEducation(ed.id, { institution: v })}
                  />
                  {ed.details && <p className="r-details">{ed.details}</p>}
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "projects":
        return cv.projects.length ? (
          <motion.section key="projects" variants={item} layout className="r-section">
            <h2 className="r-h2">Projects</h2>
            <div className="r-list">
              {cv.projects.map((prj) => (
                <motion.div key={prj.id} variants={item} layout className="r-role">
                  <div className="r-role-top">
                    <EditableText
                      as="p"
                      className="r-role-title"
                      value={prj.name}
                      placeholder="Project"
                      onCommit={(v) => updateProject(prj.id, { name: v })}
                    />
                    <span className="r-dates">{dateRange(prj.startDate, prj.endDate)}</span>
                  </div>
                  {(prj.role || prj.url) && (
                    <p className="r-co">
                      {prj.role}
                      {prj.role && prj.url ? " · " : ""}
                      {prj.url && (
                        <a href={normalizedHref(prj.url)} className="r-link">
                          {prj.url}
                        </a>
                      )}
                    </p>
                  )}
                  {(prj.highlights.filter(Boolean).length > 0 || previewEdit) && (
                    <ul className="r-bullets">
                      {prj.highlights.map((h, i) =>
                        h || previewEdit ? (
                          <EditableText
                            as="li"
                            key={i}
                            value={h}
                            placeholder="Detail…"
                            multiline
                            onCommit={(v) => setProjectHighlight(prj.id, i, v)}
                          />
                        ) : null,
                      )}
                    </ul>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "certifications":
        return cv.certifications.length ? (
          <motion.section key="certifications" variants={item} layout className="r-section">
            <h2 className="r-h2">Certifications</h2>
            <div className="r-certlist">
              {cv.certifications.map((crt) => (
                <motion.div key={crt.id} variants={item} layout className="r-cert">
                  <div className="r-cert-main">
                    <p className="r-cert-name">
                      {crt.url ? (
                        <a href={normalizedHref(crt.url)} className="r-link">
                          {crt.name || "Certification"}
                        </a>
                      ) : (
                        <EditableText
                          as="span"
                          value={crt.name}
                          placeholder="Certification"
                          onCommit={(v) => updateCertification(crt.id, { name: v })}
                        />
                      )}
                    </p>
                    {(crt.issuer || previewEdit) && (
                      <EditableText
                        as="p"
                        className="r-cert-issuer"
                        value={crt.issuer ?? ""}
                        placeholder="Issuer"
                        onCommit={(v) => updateCertification(crt.id, { issuer: v })}
                      />
                    )}
                  </div>
                  {crt.date && <span className="r-dates">{crt.date}</span>}
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
      <EditableText
        as="h1"
        className="r-name"
        value={basics.fullName}
        placeholder="Your Name"
        onCommit={(v) => setBasics({ fullName: v })}
      />
      {(basics.title || previewEdit) && (
        <EditableText
          as="p"
          className="r-title"
          value={basics.title}
          placeholder="Your professional title"
          onCommit={(v) => setBasics({ title: v })}
        />
      )}
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
  const showAside = hasAside && Boolean(Skills);
  const aside = showAside ? <aside className="r-aside">{Skills}</aside> : null;

  return (
    <motion.article
      variants={container}
      initial="hidden"
      animate="show"
      className={`resume ${root} lay-${layout}`}
      aria-label="CV preview"
    >
      {header}
      {showAside ? (
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
