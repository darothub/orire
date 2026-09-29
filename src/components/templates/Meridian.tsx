"use client";

import { motion } from "framer-motion";
import type { CVData, SectionKey } from "@/lib/cv/schema";
import { container, item, dateRange, normalizedHref } from "./shared";
import { EditableText } from "./EditableText";
import { useCVStore } from "@/lib/store/cvStore";
import { useUIStore } from "@/lib/store/uiStore";

/** Meridian — Swiss minimalist: mono labels, hairline rules, gutter-aligned dates. */
export function Meridian({ cv }: { cv: CVData }) {
  const { basics } = cv;
  const previewEdit = useUIStore((s) => s.previewEdit);
  const setBasics = useCVStore((s) => s.setBasics);
  const updateExperience = useCVStore((s) => s.updateExperience);
  const setHighlight = useCVStore((s) => s.setHighlight);
  const updateEducation = useCVStore((s) => s.updateEducation);
  const updateProject = useCVStore((s) => s.updateProject);
  const setProjectHighlight = useCVStore((s) => s.setProjectHighlight);
  const updateCertification = useCVStore((s) => s.updateCertification);
  const num = (key: SectionKey) => String(cv.order.indexOf(key) + 1).padStart(2, "0");

  const section = (key: SectionKey) => {
    switch (key) {
      case "summary":
        return basics.summary || previewEdit ? (
          <motion.section key="summary" variants={item} layout className="md-row">
            <div className="md-label">{num("summary")} — Profile</div>
            <EditableText
              as="p"
              className="md-summary"
              value={basics.summary}
              placeholder="Write a short professional summary…"
              multiline
              onCommit={(v) => setBasics({ summary: v })}
            />
          </motion.section>
        ) : null;
      case "experience":
        return cv.experience.length ? (
          <motion.section key="experience" variants={item} layout className="md-row">
            <div className="md-label">{num("experience")} — Experience</div>
            <div className="md-list">
              {cv.experience.map((exp) => (
                <motion.div key={exp.id} variants={item} layout className="md-entry">
                  <div className="md-meta">{dateRange(exp.startDate, exp.endDate, exp.current)}</div>
                  <div className="md-entry-body">
                    <EditableText
                      as="p"
                      className="md-title"
                      value={exp.role}
                      placeholder="Role"
                      onCommit={(v) => updateExperience(exp.id, { role: v })}
                    />
                    <p className="md-co">
                      <EditableText
                        as="span"
                        value={exp.company}
                        placeholder="Company"
                        onCommit={(v) => updateExperience(exp.id, { company: v })}
                      />
                      {exp.location ? `, ${exp.location}` : ""}
                    </p>
                    {(exp.highlights.filter(Boolean).length > 0 || previewEdit) && (
                      <ul className="md-bullets">
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
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "education":
        return cv.education.length ? (
          <motion.section key="education" variants={item} layout className="md-row">
            <div className="md-label">{num("education")} — Education</div>
            <div className="md-list">
              {cv.education.map((ed) => (
                <motion.div key={ed.id} variants={item} layout className="md-entry">
                  <div className="md-meta">{dateRange(ed.startDate, ed.endDate)}</div>
                  <div className="md-entry-body">
                    <p className="md-title">
                      <EditableText
                        as="span"
                        value={ed.degree}
                        placeholder="Degree"
                        onCommit={(v) => updateEducation(ed.id, { degree: v })}
                      />
                      {ed.field ? `, ${ed.field}` : ""}
                    </p>
                    <EditableText
                      as="p"
                      className="md-co"
                      value={ed.institution}
                      placeholder="Institution"
                      onCommit={(v) => updateEducation(ed.id, { institution: v })}
                    />
                    {ed.details && <p className="md-details">{ed.details}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "projects":
        return cv.projects.length ? (
          <motion.section key="projects" variants={item} layout className="md-row">
            <div className="md-label">{num("projects")} — Projects</div>
            <div className="md-list">
              {cv.projects.map((prj) => (
                <motion.div key={prj.id} variants={item} layout className="md-entry">
                  <div className="md-meta">{dateRange(prj.startDate, prj.endDate)}</div>
                  <div className="md-entry-body">
                    <EditableText
                      as="p"
                      className="md-title"
                      value={prj.name}
                      placeholder="Project"
                      onCommit={(v) => updateProject(prj.id, { name: v })}
                    />
                    {(prj.role || prj.url) && (
                      <p className="md-co">
                        {prj.role}
                        {prj.role && prj.url ? ", " : ""}
                        {prj.url && (
                          <a href={normalizedHref(prj.url)} className="md-link">{prj.url}</a>
                        )}
                      </p>
                    )}
                    {(prj.highlights.filter(Boolean).length > 0 || previewEdit) && (
                      <ul className="md-bullets">
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
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "certifications":
        return cv.certifications.length ? (
          <motion.section key="certifications" variants={item} layout className="md-row">
            <div className="md-label">{num("certifications")} — Certifications</div>
            <div className="md-list">
              {cv.certifications.map((crt) => (
                <div key={crt.id} className="md-entry">
                  <div className="md-meta">{crt.date}</div>
                  <div className="md-entry-body">
                    <p className="md-title">
                      {crt.url ? (
                        <a href={normalizedHref(crt.url)} className="md-link">{crt.name || "Certification"}</a>
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
                        className="md-co"
                        value={crt.issuer ?? ""}
                        placeholder="Issuer"
                        onCommit={(v) => updateCertification(crt.id, { issuer: v })}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        ) : null;
      case "skills":
        return cv.skills.length ? (
          <motion.section key="skills" variants={item} layout className="md-row">
            <div className="md-label">{num("skills")} — Skills</div>
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
          <EditableText
            as="h1"
            className="md-name"
            value={basics.fullName}
            placeholder="Your Name"
            onCommit={(v) => setBasics({ fullName: v })}
          />
          {(basics.title || previewEdit) && (
            <EditableText
              as="p"
              className="md-role"
              value={basics.title}
              placeholder="Your professional title"
              onCommit={(v) => setBasics({ title: v })}
            />
          )}
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
