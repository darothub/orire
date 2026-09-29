"use client";

import { motion } from "framer-motion";
import type { CVData, SectionKey } from "@/lib/cv/schema";
import { container, item, dateRange, normalizedHref } from "./shared";
import { EditableText } from "./EditableText";
import { useCVStore } from "@/lib/store/cvStore";
import { useUIStore } from "@/lib/store/uiStore";

/** Vertex — bold full-height gradient sidebar with crisp white main column. */
export function Vertex({ cv }: { cv: CVData }) {
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
        return basics.summary || previewEdit ? (
          <motion.section key="summary" variants={item} layout className="vx-block">
            <h2 className="vx-h2">Profile</h2>
            <EditableText
              as="p"
              className="vx-summary"
              value={basics.summary}
              placeholder="Write a short professional summary…"
              multiline
              onCommit={(v) => setBasics({ summary: v })}
            />
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
                  <EditableText
                    as="p"
                    className="vx-role-title"
                    value={exp.role}
                    placeholder="Role"
                    onCommit={(v) => updateExperience(exp.id, { role: v })}
                  />
                  <span className="vx-dates">{dateRange(exp.startDate, exp.endDate, exp.current)}</span>
                </div>
                <p className="vx-co">
                  <EditableText
                    as="span"
                    value={exp.company}
                    placeholder="Company"
                    onCommit={(v) => updateExperience(exp.id, { company: v })}
                  />
                  {exp.location ? ` · ${exp.location}` : ""}
                </p>
                {(exp.highlights.filter(Boolean).length > 0 || previewEdit) && (
                  <ul className="vx-bullets">
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
                    <EditableText
                      as="span"
                      value={ed.degree}
                      placeholder="Degree"
                      onCommit={(v) => updateEducation(ed.id, { degree: v })}
                    />
                    {ed.field ? ` · ${ed.field}` : ""}
                  </p>
                  <span className="vx-dates">{dateRange(ed.startDate, ed.endDate)}</span>
                </div>
                <EditableText
                  as="p"
                  className="vx-co"
                  value={ed.institution}
                  placeholder="Institution"
                  onCommit={(v) => updateEducation(ed.id, { institution: v })}
                />
                {ed.details && <p className="vx-details">{ed.details}</p>}
              </motion.div>
            ))}
          </motion.section>
        ) : null;
      case "projects":
        return cv.projects.length ? (
          <motion.section key="projects" variants={item} layout className="vx-block">
            <h2 className="vx-h2">Projects</h2>
            {cv.projects.map((prj) => (
              <motion.div key={prj.id} variants={item} layout className="vx-role">
                <span className="vx-node" />
                <div className="vx-role-head">
                  <EditableText
                    as="p"
                    className="vx-role-title"
                    value={prj.name}
                    placeholder="Project"
                    onCommit={(v) => updateProject(prj.id, { name: v })}
                  />
                  <span className="vx-dates">{dateRange(prj.startDate, prj.endDate)}</span>
                </div>
                {(prj.role || prj.url) && (
                  <p className="vx-co">
                    {prj.role}
                    {prj.role && prj.url ? " · " : ""}
                    {prj.url && (
                      <a href={normalizedHref(prj.url)} className="vx-link">{prj.url}</a>
                    )}
                  </p>
                )}
                {(prj.highlights.filter(Boolean).length > 0 || previewEdit) && (
                  <ul className="vx-bullets">
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
          </motion.section>
        ) : null;
      case "certifications":
        return cv.certifications.length ? (
          <motion.section key="certifications" variants={item} layout className="vx-block">
            <h2 className="vx-h2">Certifications</h2>
            {cv.certifications.map((crt) => (
              <motion.div key={crt.id} variants={item} layout className="vx-role">
                <span className="vx-node" />
                <div className="vx-role-head">
                  <p className="vx-role-title">
                    {crt.url ? (
                      <a href={normalizedHref(crt.url)} className="vx-link">{crt.name || "Certification"}</a>
                    ) : (
                      <EditableText
                        as="span"
                        value={crt.name}
                        placeholder="Certification"
                        onCommit={(v) => updateCertification(crt.id, { name: v })}
                      />
                    )}
                  </p>
                  {crt.date && <span className="vx-dates">{crt.date}</span>}
                </div>
                {(crt.issuer || previewEdit) && (
                  <EditableText
                    as="p"
                    className="vx-co"
                    value={crt.issuer ?? ""}
                    placeholder="Issuer"
                    onCommit={(v) => updateCertification(crt.id, { issuer: v })}
                  />
                )}
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
        <EditableText
          as="h1"
          className="vx-name"
          value={basics.fullName}
          placeholder="Your Name"
          onCommit={(v) => setBasics({ fullName: v })}
        />
        {(basics.title || previewEdit) && (
          <EditableText
            as="p"
            className="vx-title"
            value={basics.title}
            placeholder="Your professional title"
            onCommit={(v) => setBasics({ title: v })}
          />
        )}

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

        {cv.skills.length > 0 && cv.order.includes("skills") && (
          <motion.div variants={item} className="vx-side-block">
            <h3 className="vx-side-h">Skills</h3>
            {cv.skills.map((g) => (
              <div key={g.id} className="vx-skillgroup">
                <EditableText
                  as="p"
                  className="vx-skillcat"
                  value={g.category}
                  placeholder="Category"
                  onCommit={(v) => updateSkillGroup(g.id, { category: v })}
                />
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
