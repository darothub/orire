"use client";

import { motion } from "framer-motion";
import type { CVData, SectionKey } from "@/lib/cv/schema";
import { container, item, dateRange, normalizedHref } from "./shared";
import { EditableText } from "./EditableText";
import { useCVStore } from "@/lib/store/cvStore";
import { useUIStore } from "@/lib/store/uiStore";

/** Aurora — editorial light, luminous gradient spine, two-column rhythm. */
export function Aurora({ cv }: { cv: CVData }) {
  const { basics } = cv;
  const previewEdit = useUIStore((s) => s.previewEdit);
  const setBasics = useCVStore((s) => s.setBasics);
  const updateExperience = useCVStore((s) => s.updateExperience);
  const setHighlight = useCVStore((s) => s.setHighlight);
  const updateEducation = useCVStore((s) => s.updateEducation);
  const updateProject = useCVStore((s) => s.updateProject);
  const setProjectHighlight = useCVStore((s) => s.setProjectHighlight);
  const updateCertification = useCVStore((s) => s.updateCertification);
  const updateSkillGroup = useCVStore((s) => s.updateSkillGroup);

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case "summary":
        return basics.summary || previewEdit ? (
          <motion.section key="summary" variants={item} layout className="au-block">
            <h2 className="au-h2">Profile</h2>
            <EditableText
              as="p"
              className="au-summary"
              value={basics.summary}
              placeholder="Write a short professional summary…"
              multiline
              onCommit={(v) => setBasics({ summary: v })}
            />
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
                      <EditableText
                        as="p"
                        className="au-role-title"
                        value={exp.role}
                        placeholder="Role"
                        onCommit={(v) => updateExperience(exp.id, { role: v })}
                      />
                      <p className="au-role-co">
                        <EditableText
                          as="span"
                          value={exp.company}
                          placeholder="Company"
                          onCommit={(v) => updateExperience(exp.id, { company: v })}
                        />
                        {exp.location ? ` · ${exp.location}` : ""}
                      </p>
                    </div>
                    <span className="au-dates">{dateRange(exp.startDate, exp.endDate, exp.current)}</span>
                  </div>
                  {(exp.highlights.filter(Boolean).length > 0 || previewEdit) && (
                    <ul className="au-bullets">
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
          <motion.section key="education" variants={item} layout className="au-block">
            <h2 className="au-h2">Education</h2>
            {cv.education.map((ed) => (
              <motion.div key={ed.id} variants={item} layout className="au-role">
                <div className="au-role-head">
                  <div>
                    <p className="au-role-title">
                      <EditableText
                        as="span"
                        value={ed.degree}
                        placeholder="Degree"
                        onCommit={(v) => updateEducation(ed.id, { degree: v })}
                      />
                      {ed.field ? ` · ${ed.field}` : ""}
                    </p>
                    <EditableText
                      as="p"
                      className="au-role-co"
                      value={ed.institution}
                      placeholder="Institution"
                      onCommit={(v) => updateEducation(ed.id, { institution: v })}
                    />
                  </div>
                  <span className="au-dates">{dateRange(ed.startDate, ed.endDate)}</span>
                </div>
                {ed.details && <p className="au-details">{ed.details}</p>}
              </motion.div>
            ))}
          </motion.section>
        ) : null;
      case "projects":
        return cv.projects.length ? (
          <motion.section key="projects" variants={item} layout className="au-block">
            <h2 className="au-h2">Projects</h2>
            <div className="au-timeline">
              {cv.projects.map((prj) => (
                <motion.div key={prj.id} variants={item} layout className="au-role">
                  <div className="au-role-head">
                    <div>
                      <EditableText
                        as="p"
                        className="au-role-title"
                        value={prj.name}
                        placeholder="Project"
                        onCommit={(v) => updateProject(prj.id, { name: v })}
                      />
                      {(prj.role || prj.url) && (
                        <p className="au-role-co">
                          {prj.role}
                          {prj.role && prj.url ? " · " : ""}
                          {prj.url && (
                            <a href={normalizedHref(prj.url)} className="au-link">{prj.url}</a>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="au-dates">{dateRange(prj.startDate, prj.endDate)}</span>
                  </div>
                  {(prj.highlights.filter(Boolean).length > 0 || previewEdit) && (
                    <ul className="au-bullets">
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
          <motion.section key="certifications" variants={item} layout className="au-block">
            <h2 className="au-h2">Certifications</h2>
            {cv.certifications.map((crt) => (
              <motion.div key={crt.id} variants={item} layout className="au-role">
                <div className="au-role-head">
                  <div>
                    <p className="au-role-title">
                      {crt.url ? (
                        <a href={normalizedHref(crt.url)} className="au-link">{crt.name || "Certification"}</a>
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
                        className="au-role-co"
                        value={crt.issuer ?? ""}
                        placeholder="Issuer"
                        onCommit={(v) => updateCertification(crt.id, { issuer: v })}
                      />
                    )}
                  </div>
                  {crt.date && <span className="au-dates">{crt.date}</span>}
                </div>
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
        <EditableText
          as="h1"
          className="au-name"
          value={basics.fullName}
          placeholder="Your Name"
          onCommit={(v) => setBasics({ fullName: v })}
        />
        {(basics.title || previewEdit) && (
          <EditableText
            as="p"
            className="au-title"
            value={basics.title}
            placeholder="Your professional title"
            onCommit={(v) => setBasics({ title: v })}
          />
        )}
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
          {cv.skills.length > 0 && cv.order.includes("skills") && (
            <motion.section variants={item} layout className="au-block">
              <h2 className="au-h2">Skills</h2>
              {cv.skills.map((g) => (
                <motion.div key={g.id} variants={item} layout className="au-skillgroup">
                  <EditableText
                    as="p"
                    className="au-skillcat"
                    value={g.category}
                    placeholder="Category"
                    onCommit={(v) => updateSkillGroup(g.id, { category: v })}
                  />
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
