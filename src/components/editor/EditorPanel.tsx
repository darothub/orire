"use client";

import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useState } from "react";
import { AutoTextarea } from "./AutoTextarea";
import { EvidenceHelper } from "./EvidenceHelper";
import { hasMeasurable } from "@/lib/ai/evidence";

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

/**
 * A draggable editor card (req 17). Only the grip handle starts a drag
 * (dragListener={false} + dragControls), so the inputs inside stay fully
 * editable and selectable.
 */
function SortableCard<T>({
  value,
  onRemove,
  children,
}: {
  value: T;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="ed-card"
      whileDrag={{ scale: 1.02, boxShadow: "0 14px 34px rgba(0,0,0,0.18)", zIndex: 5 }}
    >
      <div className="ed-card-tools">
        <button
          className="ed-grip"
          onPointerDown={(e) => controls.start(e)}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
        {onRemove && (
          <button className="ed-remove-inline" onClick={onRemove} aria-label="Remove">
            ✕
          </button>
        )}
      </div>
      {children}
    </Reorder.Item>
  );
}

/** A single draggable highlight bullet ("edit box", req 17 + 18). */
function HighlightItem({
  index,
  value,
  placeholder,
  onChange,
  onRemove,
}: {
  index: number;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={index}
      dragListener={false}
      dragControls={controls}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="ed-bullet"
      whileDrag={{ scale: 1.01 }}
    >
      <button
        className="ed-grip ed-grip-sm"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Drag highlight"
        title="Drag to reorder"
      >
        ⋮⋮
      </button>
      <AutoTextarea
        className="ed-input ed-area"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <button className="ed-mini" onClick={onRemove} aria-label="Remove highlight">
        ✕
      </button>
    </Reorder.Item>
  );
}

/** Draggable list of highlight bullets. Reorders by index permutation. */
function Highlights({
  items,
  placeholder,
  onReorder,
  onChange,
  onRemove,
  onAdd,
}: {
  items: string[];
  placeholder?: string;
  onReorder: (next: string[]) => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const indices = items.map((_, i) => i);
  return (
    <div className="ed-bullets">
      <span className="ed-label">Highlights — drag ⋮⋮ to reorder</span>
      <Reorder.Group
        axis="y"
        values={indices}
        onReorder={(order) => onReorder((order as number[]).map((i) => items[i]))}
        className="ed-bullet-list"
      >
        <AnimatePresence initial={false}>
          {items.map((h, i) => (
            <HighlightItem
              key={i}
              index={i}
              value={h}
              placeholder={placeholder}
              onChange={(v) => onChange(i, v)}
              onRemove={() => onRemove(i)}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <button className="ed-add ed-add-sm" onClick={onAdd}>+ Highlight</button>
    </div>
  );
}

/** Soft nudge + guided helper for adding measurable evidence to a role. */
function EvidenceSection({
  role,
  company,
  highlights,
  onAdd,
}: {
  role: string;
  company: string;
  highlights: string[];
  onAdd: (bullet: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const filled = highlights.filter((h) => h.trim());
  const missing = filled.length > 0 && !filled.some(hasMeasurable);
  return (
    <div className="ed-evidence-wrap">
      {open ? (
        <EvidenceHelper role={role} company={company} onAdd={onAdd} onClose={() => setOpen(false)} />
      ) : (
        <button className="ed-evidence-btn" onClick={() => setOpen(true)}>
          📈 Add numbers &amp; evidence
          {missing && <span className="ed-evidence-nudge"> — none of your bullets show a measurable result yet</span>}
        </button>
      )}
    </div>
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
        <Reorder.Group axis="y" values={cv.experience} onReorder={s.setExperience} className="ed-list">
          <AnimatePresence initial={false}>
            {cv.experience.map((exp) => (
              <SortableCard key={exp.id} value={exp} onRemove={() => s.removeExperience(exp.id)}>
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
                <EvidenceSection
                  role={exp.role}
                  company={exp.company}
                  highlights={exp.highlights}
                  onAdd={(b) => s.setHighlights(exp.id, [...exp.highlights.filter((h) => h.trim()), b])}
                />
                <Highlights
                  items={exp.highlights}
                  placeholder="Describe a concrete, factual achievement…"
                  onReorder={(next) => s.setHighlights(exp.id, next)}
                  onChange={(i, v) => s.setHighlight(exp.id, i, v)}
                  onRemove={(i) => s.removeHighlight(exp.id, i)}
                  onAdd={() => s.addHighlight(exp.id)}
                />
              </SortableCard>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </section>

      {/* Education */}
      <section className="ed-section">
        <div className="ed-section-head">
          <h3 className="ed-h3">Education</h3>
          <button className="ed-add" onClick={s.addEducation}>+ Add</button>
        </div>
        <Reorder.Group axis="y" values={cv.education} onReorder={s.setEducation} className="ed-list">
          <AnimatePresence initial={false}>
            {cv.education.map((ed) => (
              <SortableCard key={ed.id} value={ed} onRemove={() => s.removeEducation(ed.id)}>
                <div className="ed-grid2">
                  <Field label="Degree" value={ed.degree} onChange={(v) => s.updateEducation(ed.id, { degree: v })} />
                  <Field label="Field" value={ed.field ?? ""} onChange={(v) => s.updateEducation(ed.id, { field: v })} />
                  <Field label="Institution" value={ed.institution} onChange={(v) => s.updateEducation(ed.id, { institution: v })} />
                  <Field label="Start" value={ed.startDate ?? ""} onChange={(v) => s.updateEducation(ed.id, { startDate: v })} />
                  <Field label="End" value={ed.endDate ?? ""} onChange={(v) => s.updateEducation(ed.id, { endDate: v })} />
                </div>
                <AreaField label="Details" value={ed.details ?? ""} onChange={(v) => s.updateEducation(ed.id, { details: v })} />
              </SortableCard>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </section>

      {/* Skills */}
      <section className="ed-section">
        <div className="ed-section-head">
          <h3 className="ed-h3">Skills</h3>
          <button className="ed-add" onClick={s.addSkillGroup}>+ Add group</button>
        </div>
        {s.skillSuggestions.length > 0 && (
          <div className="ed-suggest">
            <div className="ed-suggest-head">
              <span className="ed-suggest-title">Suggested from the ideal match</span>
              <div className="ed-suggest-actions">
                {s.ignoredSkills.length > 0 && (
                  <button className="ed-suggest-clear" onClick={s.clearIgnoredSkills} title="Allow previously dismissed skills to be suggested again">
                    Reset ignored ({s.ignoredSkills.length})
                  </button>
                )}
                <button className="ed-suggest-clear" onClick={s.clearSkillSuggestions}>Dismiss all</button>
              </div>
            </div>
            <p className="ed-suggest-note">Add only skills you genuinely have — these come from the target role, not your CV.</p>
            <div className="ed-suggest-chips">
              <AnimatePresence initial={false}>
                {s.skillSuggestions.map((sk) => (
                  <motion.span
                    key={sk}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.18 }}
                    className="ed-suggest-chip"
                  >
                    <button className="ed-suggest-add" onClick={() => s.acceptSkillSuggestion(sk)} title="Add to your skills">＋ {sk}</button>
                    <button className="ed-suggest-x" onClick={() => s.dismissSkillSuggestion(sk)} aria-label={`Dismiss ${sk}`}>×</button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
        <Reorder.Group axis="y" values={cv.skills} onReorder={s.setSkills} className="ed-list">
          <AnimatePresence initial={false}>
            {cv.skills.map((g) => (
              <SortableCard key={g.id} value={g} onRemove={() => s.removeSkillGroup(g.id)}>
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
              </SortableCard>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </section>

      {/* Projects */}
      <section className="ed-section">
        <div className="ed-section-head">
          <h3 className="ed-h3">Projects</h3>
          <button className="ed-add" onClick={s.addProject}>+ Add</button>
        </div>
        <Reorder.Group axis="y" values={cv.projects} onReorder={s.setProjects} className="ed-list">
          <AnimatePresence initial={false}>
            {cv.projects.map((prj) => (
              <SortableCard key={prj.id} value={prj} onRemove={() => s.removeProject(prj.id)}>
                <div className="ed-grid2">
                  <Field label="Name" value={prj.name} onChange={(v) => s.updateProject(prj.id, { name: v })} />
                  <Field label="Role" value={prj.role ?? ""} onChange={(v) => s.updateProject(prj.id, { role: v })} />
                  <Field label="URL" value={prj.url ?? ""} onChange={(v) => s.updateProject(prj.id, { url: v })} />
                  <Field label="Start" value={prj.startDate ?? ""} onChange={(v) => s.updateProject(prj.id, { startDate: v })} />
                  <Field label="End" value={prj.endDate ?? ""} onChange={(v) => s.updateProject(prj.id, { endDate: v })} />
                </div>
                <Highlights
                  items={prj.highlights}
                  placeholder="Describe a concrete, factual outcome…"
                  onReorder={(next) => s.setProjectHighlights(prj.id, next)}
                  onChange={(i, v) => s.setProjectHighlight(prj.id, i, v)}
                  onRemove={(i) => s.removeProjectHighlight(prj.id, i)}
                  onAdd={() => s.addProjectHighlight(prj.id)}
                />
              </SortableCard>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </section>

      {/* Certifications */}
      <section className="ed-section">
        <div className="ed-section-head">
          <h3 className="ed-h3">Certifications</h3>
          <button className="ed-add" onClick={s.addCertification}>+ Add</button>
        </div>
        <Reorder.Group axis="y" values={cv.certifications} onReorder={s.setCertifications} className="ed-list">
          <AnimatePresence initial={false}>
            {cv.certifications.map((crt) => (
              <SortableCard key={crt.id} value={crt} onRemove={() => s.removeCertification(crt.id)}>
                <div className="ed-grid2">
                  <Field label="Name" value={crt.name} onChange={(v) => s.updateCertification(crt.id, { name: v })} />
                  <Field label="Issuer" value={crt.issuer ?? ""} onChange={(v) => s.updateCertification(crt.id, { issuer: v })} />
                  <Field label="Date" value={crt.date ?? ""} onChange={(v) => s.updateCertification(crt.id, { date: v })} />
                  <Field label="URL" value={crt.url ?? ""} onChange={(v) => s.updateCertification(crt.id, { url: v })} />
                </div>
              </SortableCard>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </section>
    </div>
  );
}
