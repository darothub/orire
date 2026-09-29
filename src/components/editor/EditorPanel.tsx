"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { AutoTextarea } from "./AutoTextarea";

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="ed-field">
      <span className="ed-label">{label}</span>
      <input
        className="ed-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function AreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="ed-field">
      <span className="ed-label">{label}</span>
      <AutoTextarea
        className="ed-input ed-area"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Card({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="ed-card"
    >
      {onRemove && (
        <button className="ed-remove" onClick={onRemove} aria-label="Remove">
          ✕
        </button>
      )}
      {children}
    </motion.div>
  );
}

export function EditorPanel() {
  const cv = useCVStore((s) => s.cv);
  const s = useCVStore();

  return (
    <div className="ed-root">
      {/* Basics */}
      <section className="ed-section">
        <h3 className="ed-h3">Basics</h3>
        <div className="ed-grid2">
          <Field label="Full name" value={cv.basics.fullName} onChange={(v) => s.setBasics({ fullName: v })} />
          <Field label="Title" value={cv.basics.title} onChange={(v) => s.setBasics({ title: v })} />
          <Field label="Email" value={cv.basics.email} onChange={(v) => s.setBasics({ email: v })} />
          <Field label="Phone" value={cv.basics.phone} onChange={(v) => s.setBasics({ phone: v })} />
          <Field label="Location" value={cv.basics.location} onChange={(v) => s.setBasics({ location: v })} />
        </div>
        <AreaField label="Summary" value={cv.basics.summary} onChange={(v) => s.setBasics({ summary: v })} />
      </section>

      {/* Experience */}
      <section className="ed-section">
        <div className="ed-section-head">
          <h3 className="ed-h3">Experience</h3>
          <button className="ed-add" onClick={s.addExperience}>+ Add</button>
        </div>
        <AnimatePresence initial={false}>
          {cv.experience.map((exp) => (
            <Card key={exp.id} onRemove={() => s.removeExperience(exp.id)}>
              <div className="ed-grid2">
                <Field label="Role" value={exp.role} onChange={(v) => s.updateExperience(exp.id, { role: v })} />
                <Field label="Company" value={exp.company} onChange={(v) => s.updateExperience(exp.id, { company: v })} />
                <Field label="Location" value={exp.location ?? ""} onChange={(v) => s.updateExperience(exp.id, { location: v })} />
                <Field label="Start" value={exp.startDate ?? ""} onChange={(v) => s.updateExperience(exp.id, { startDate: v })} />
                <Field label="End" value={exp.endDate ?? ""} onChange={(v) => s.updateExperience(exp.id, { endDate: v })} />
                <label className="ed-check">
                  <input
                    type="checkbox"
                    checked={!!exp.current}
                    onChange={(e) => s.updateExperience(exp.id, { current: e.target.checked })}
                  />
                  <span>Current role</span>
                </label>
              </div>
              <div className="ed-bullets">
                <span className="ed-label">Highlights</span>
                <AnimatePresence initial={false}>
                  {exp.highlights.map((h, i) => (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="ed-bullet"
                    >
                      <span className="ed-dot" />
                      <AutoTextarea
                        className="ed-input ed-area"
                        value={h}
                        placeholder="Describe a concrete, factual achievement…"
                        onChange={(e) => s.setHighlight(exp.id, i, e.target.value)}
                      />
                      <button className="ed-mini" onClick={() => s.removeHighlight(exp.id, i)} aria-label="Remove highlight">✕</button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <button className="ed-add ed-add-sm" onClick={() => s.addHighlight(exp.id)}>+ Highlight</button>
              </div>
            </Card>
          ))}
        </AnimatePresence>
      </section>

      {/* Education */}
      <section className="ed-section">
        <div className="ed-section-head">
          <h3 className="ed-h3">Education</h3>
          <button className="ed-add" onClick={s.addEducation}>+ Add</button>
        </div>
        <AnimatePresence initial={false}>
          {cv.education.map((ed) => (
            <Card key={ed.id} onRemove={() => s.removeEducation(ed.id)}>
              <div className="ed-grid2">
                <Field label="Degree" value={ed.degree} onChange={(v) => s.updateEducation(ed.id, { degree: v })} />
                <Field label="Field" value={ed.field ?? ""} onChange={(v) => s.updateEducation(ed.id, { field: v })} />
                <Field label="Institution" value={ed.institution} onChange={(v) => s.updateEducation(ed.id, { institution: v })} />
                <Field label="Start" value={ed.startDate ?? ""} onChange={(v) => s.updateEducation(ed.id, { startDate: v })} />
                <Field label="End" value={ed.endDate ?? ""} onChange={(v) => s.updateEducation(ed.id, { endDate: v })} />
              </div>
              <AreaField label="Details" value={ed.details ?? ""} onChange={(v) => s.updateEducation(ed.id, { details: v })} />
            </Card>
          ))}
        </AnimatePresence>
      </section>

      {/* Skills */}
      <section className="ed-section">
        <div className="ed-section-head">
          <h3 className="ed-h3">Skills</h3>
          <button className="ed-add" onClick={s.addSkillGroup}>+ Add group</button>
        </div>
        <AnimatePresence initial={false}>
          {cv.skills.map((g) => (
            <Card key={g.id} onRemove={() => s.removeSkillGroup(g.id)}>
              <Field label="Category" value={g.category} onChange={(v) => s.updateSkillGroup(g.id, { category: v })} />
              <AreaField
                label="Skills (comma separated)"
                value={g.items.join(", ")}
                placeholder="e.g. Figma, Prototyping, Research"
                onChange={(v) =>
                  s.updateSkillGroup(g.id, {
                    items: v.split(",").map((x) => x.trim()).filter(Boolean),
                  })
                }
              />
            </Card>
          ))}
        </AnimatePresence>
      </section>

      {/* Projects */}
      <section className="ed-section">
        <div className="ed-section-head">
          <h3 className="ed-h3">Projects</h3>
          <button className="ed-add" onClick={s.addProject}>+ Add</button>
        </div>
        <AnimatePresence initial={false}>
          {cv.projects.map((prj) => (
            <Card key={prj.id} onRemove={() => s.removeProject(prj.id)}>
              <div className="ed-grid2">
                <Field label="Name" value={prj.name} onChange={(v) => s.updateProject(prj.id, { name: v })} />
                <Field label="Role" value={prj.role ?? ""} onChange={(v) => s.updateProject(prj.id, { role: v })} />
                <Field label="URL" value={prj.url ?? ""} onChange={(v) => s.updateProject(prj.id, { url: v })} />
                <Field label="Start" value={prj.startDate ?? ""} onChange={(v) => s.updateProject(prj.id, { startDate: v })} />
                <Field label="End" value={prj.endDate ?? ""} onChange={(v) => s.updateProject(prj.id, { endDate: v })} />
              </div>
              <div className="ed-bullets">
                <span className="ed-label">Highlights</span>
                <AnimatePresence initial={false}>
                  {prj.highlights.map((h, i) => (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="ed-bullet"
                    >
                      <span className="ed-dot" />
                      <AutoTextarea
                        className="ed-input ed-area"
                        value={h}
                        placeholder="Describe a concrete, factual outcome…"
                        onChange={(e) => s.setProjectHighlight(prj.id, i, e.target.value)}
                      />
                      <button className="ed-mini" onClick={() => s.removeProjectHighlight(prj.id, i)} aria-label="Remove highlight">✕</button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <button className="ed-add ed-add-sm" onClick={() => s.addProjectHighlight(prj.id)}>+ Highlight</button>
              </div>
            </Card>
          ))}
        </AnimatePresence>
      </section>

      {/* Certifications */}
      <section className="ed-section">
        <div className="ed-section-head">
          <h3 className="ed-h3">Certifications</h3>
          <button className="ed-add" onClick={s.addCertification}>+ Add</button>
        </div>
        <AnimatePresence initial={false}>
          {cv.certifications.map((crt) => (
            <Card key={crt.id} onRemove={() => s.removeCertification(crt.id)}>
              <div className="ed-grid2">
                <Field label="Name" value={crt.name} onChange={(v) => s.updateCertification(crt.id, { name: v })} />
                <Field label="Issuer" value={crt.issuer ?? ""} onChange={(v) => s.updateCertification(crt.id, { issuer: v })} />
                <Field label="Date" value={crt.date ?? ""} onChange={(v) => s.updateCertification(crt.id, { date: v })} />
                <Field label="URL" value={crt.url ?? ""} onChange={(v) => s.updateCertification(crt.id, { url: v })} />
              </div>
            </Card>
          ))}
        </AnimatePresence>
      </section>
    </div>
  );
}
