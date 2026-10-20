"use client";

import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useState } from "react";
import { AutoTextarea } from "./AutoTextarea";
import { EvidenceHelper } from "./EvidenceHelper";
import { hasMeasurable } from "@/lib/ai/evidence";
import { analyzeBullet } from "@/lib/cv/coach";
import { usePlanStore } from "@/lib/store/planStore";
import { useViewStore } from "@/lib/store/viewStore";
import { allowContextualBulletReview } from "@/lib/plan/plan";
import type { BulletReview } from "@/lib/ai/bulletReview";
import { moveById, moveAt } from "@/lib/cv/reorder";

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
 *
 * Drag has no keyboard equivalent, so every card also gets explicit
 * move-earlier/move-later buttons next to the grip — the only way a
 * keyboard-only or switch-access user can reorder experience, education,
 * skills, projects or certifications at all.
 */
function SortableCard<T>({
  value,
  index,
  total,
  itemLabel,
  onMove,
  onRemove,
  children,
}: {
  value: T;
  index: number;
  total: number;
  /** Singular noun for ARIA labels, e.g. "experience entry". */
  itemLabel: string;
  onMove: (dir: -1 | 1) => void;
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
      role="listitem"
      aria-roledescription="reorderable card"
    >
      <div className="ed-card-tools">
        <div className="ed-card-tools-left">
          <button
            className="ed-grip"
            onPointerDown={(e) => controls.start(e)}
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >
            ⋮⋮
          </button>
          <div className="ed-move">
            <button
              type="button"
              className="ed-move-btn"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              aria-label={`Move this ${itemLabel} earlier`}
              title="Move earlier"
            >
              ▲
            </button>
            <button
              type="button"
              className="ed-move-btn"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              aria-label={`Move this ${itemLabel} later`}
              title="Move later"
            >
              ▼
            </button>
          </div>
        </div>
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
  total,
  value,
  placeholder,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const controls = useDragControls();
  const flags = analyzeBullet(value);
  const plan = usePlanStore((s) => s.plan);
  const setView = useViewStore((s) => s.setView);
  const canAiReview = allowContextualBulletReview(plan);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<BulletReview | null>(null);
  const [err, setErr] = useState("");

  async function improve() {
    if (!canAiReview) {
      setErr("AI bullet review (spelling, grammar, impact in context) is on Pro and Career.");
      setView("plans");
      return;
    }
    setBusy(true);
    setErr("");
    setReview(null);
    try {
      const res = await fetch("/api/ai/bullet-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const data = (await res.json()) as { ok: boolean; review?: BulletReview; error?: string };
      if (data.ok && data.review) setReview(data.review);
      else setErr(data.error || "Couldn’t review this bullet.");
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const canReview = value.trim().length > 0;

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
      role="listitem"
      aria-roledescription="reorderable highlight"
    >
      <div className="ed-bullet-row">
        <button
          className="ed-grip ed-grip-sm"
          onPointerDown={(e) => controls.start(e)}
          aria-label="Drag highlight"
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
        <div className="ed-move ed-bullet-move">
          <button
            type="button"
            className="ed-move-btn"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move this highlight earlier"
            title="Move earlier"
          >
            ▲
          </button>
          <button
            type="button"
            className="ed-move-btn"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move this highlight later"
            title="Move later"
          >
            ▼
          </button>
        </div>
        <AutoTextarea
          className="ed-input ed-area"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="ed-bullet-btns">
          <button
            className="ed-improve"
            onClick={() => void improve()}
            disabled={busy || !canReview}
            title={
              canAiReview
                ? "AI review: spelling, grammar, and impact in full-sentence context (Pro/Career)"
                : "AI contextual review is a Pro/Career feature — opens plans"
            }
          >
            {busy ? "…" : canAiReview ? "✨ Improve" : "✨ Improve · Pro"}
          </button>
          <button className="ed-mini" onClick={onRemove} aria-label="Remove highlight">
            ✕
          </button>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="ed-coach" role="note">
          {flags.map((f) => (
            <span key={f.id} className={`ed-coach-flag ${f.severity}`} title={f.hint}>
              <span className="ed-coach-label">{f.label}</span>
              <span className="ed-coach-hint">{f.hint}</span>
            </span>
          ))}
        </div>
      )}

      {err && <div className="ed-coach"><span className="ed-coach-flag warn"><span className="ed-coach-hint">{err}</span></span></div>}

      {review && (
        <div className={`ed-review ${review.verdict}`} role="note">
          <div className="ed-review-head">
            <span className={`ed-review-verdict ${review.verdict}`}>
              {review.verdict === "strong" ? "Strong bullet" : review.verdict === "ok" ? "Could be stronger" : "Needs work"}
            </span>
            <button className="ed-review-x" onClick={() => setReview(null)} aria-label="Dismiss">✕</button>
          </div>
          {review.issues.length > 0 && (
            <ul className="ed-review-issues">
              {review.issues.map((i, k) => <li key={k}>{i.message}</li>)}
            </ul>
          )}
          {review.suggestion && (
            <div className="ed-review-suggestion">
              <span className="ed-review-sug-label">Suggested</span>
              <p>{review.suggestion}</p>
              <button
                className="ed-review-use"
                onClick={() => { onChange(review.suggestion); setReview(null); }}
              >
                Use this
              </button>
            </div>
          )}
          {review.issues.length === 0 && !review.suggestion && (
            <p className="ed-review-clean">Nothing to change — this reads well.</p>
          )}
        </div>
      )}
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
  announce,
}: {
  items: string[];
  placeholder?: string;
  onReorder: (next: string[]) => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  announce: (msg: string) => void;
}) {
  const indices = items.map((_, i) => i);
  return (
    <div className="ed-bullets">
      <span className="ed-label">Highlights — drag ⋮⋮ to reorder, or use ▲▼</span>
      <Reorder.Group
        axis="y"
        values={indices}
        onReorder={(order) => onReorder((order as number[]).map((i) => items[i]))}
        className="ed-bullet-list"
        role="list"
      >
        <AnimatePresence initial={false}>
          {items.map((h, i) => (
            <HighlightItem
              key={i}
              index={i}
              total={items.length}
              value={h}
              placeholder={placeholder}
              onChange={(v) => onChange(i, v)}
              onRemove={() => onRemove(i)}
              onMove={(dir) => {
                const next = moveAt(items, i, dir);
                if (next !== items) {
                  onReorder(next);
                  announce(`Highlight moved to position ${i + 1 + dir} of ${items.length}.`);
                }
              }}
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

  // Shared screen-reader announcement for every keyboard reorder in this
  // panel (cards and highlights alike) — one live region is enough since
  // only one move can happen at a time.
  const [announcement, setAnnouncement] = useState("");
  const announce = setAnnouncement;

  return (
    <div className="ed-root">
      <div className="sr-only" aria-live="polite">{announcement}</div>
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
        <Reorder.Group axis="y" values={cv.experience} onReorder={s.setExperience} className="ed-list" role="list">
          <AnimatePresence initial={false}>
            {cv.experience.map((exp, idx) => (
              <SortableCard
                key={exp.id}
                value={exp}
                index={idx}
                total={cv.experience.length}
                itemLabel="experience entry"
                onRemove={() => s.removeExperience(exp.id)}
                onMove={(dir) => {
                  const next = moveById(cv.experience, exp.id, dir);
                  if (next !== cv.experience) {
                    s.setExperience(next);
                    announce(`Experience entry moved to position ${idx + 1 + dir} of ${cv.experience.length}.`);
                  }
                }}
              >
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
                  announce={announce}
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
        <Reorder.Group axis="y" values={cv.education} onReorder={s.setEducation} className="ed-list" role="list">
          <AnimatePresence initial={false}>
            {cv.education.map((ed, i) => (
              <SortableCard
                key={ed.id}
                value={ed}
                index={i}
                total={cv.education.length}
                itemLabel="education entry"
                onRemove={() => s.removeEducation(ed.id)}
                onMove={(dir) => {
                  const next = moveById(cv.education, ed.id, dir);
                  if (next !== cv.education) {
                    s.setEducation(next);
                    announce(`Education entry moved to position ${i + 1 + dir} of ${cv.education.length}.`);
                  }
                }}
              >
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
        <Reorder.Group axis="y" values={cv.skills} onReorder={s.setSkills} className="ed-list" role="list">
          <AnimatePresence initial={false}>
            {cv.skills.map((g, i) => (
              <SortableCard
                key={g.id}
                value={g}
                index={i}
                total={cv.skills.length}
                itemLabel="skill group"
                onRemove={() => s.removeSkillGroup(g.id)}
                onMove={(dir) => {
                  const next = moveById(cv.skills, g.id, dir);
                  if (next !== cv.skills) {
                    s.setSkills(next);
                    announce(`Skill group moved to position ${i + 1 + dir} of ${cv.skills.length}.`);
                  }
                }}
              >
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
        <Reorder.Group axis="y" values={cv.projects} onReorder={s.setProjects} className="ed-list" role="list">
          <AnimatePresence initial={false}>
            {cv.projects.map((prj, idx) => (
              <SortableCard
                key={prj.id}
                value={prj}
                index={idx}
                total={cv.projects.length}
                itemLabel="project"
                onRemove={() => s.removeProject(prj.id)}
                onMove={(dir) => {
                  const next = moveById(cv.projects, prj.id, dir);
                  if (next !== cv.projects) {
                    s.setProjects(next);
                    announce(`Project moved to position ${idx + 1 + dir} of ${cv.projects.length}.`);
                  }
                }}
              >
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
                  announce={announce}
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
        <Reorder.Group axis="y" values={cv.certifications} onReorder={s.setCertifications} className="ed-list" role="list">
          <AnimatePresence initial={false}>
            {cv.certifications.map((crt, idx) => (
              <SortableCard
                key={crt.id}
                value={crt}
                index={idx}
                total={cv.certifications.length}
                itemLabel="certification"
                onRemove={() => s.removeCertification(crt.id)}
                onMove={(dir) => {
                  const next = moveById(cv.certifications, crt.id, dir);
                  if (next !== cv.certifications) {
                    s.setCertifications(next);
                    announce(`Certification moved to position ${idx + 1 + dir} of ${cv.certifications.length}.`);
                  }
                }}
              >
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
