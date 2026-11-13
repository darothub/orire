"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { useUIStore } from "@/lib/store/uiStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { TEMPLATE_CATALOG } from "@/lib/templates/catalog";
import { pruneBlankEntries, uid } from "@/lib/cv/schema";
import { exportCVtoPDF } from "@/lib/export/pdf";
import { exportCVtoDocx } from "@/lib/export/docx";
import { AutoTextarea } from "@/components/editor/AutoTextarea";

const STEPS = [
  "About you",
  "Experience",
  "Education",
  "Skills",
  "Projects",
  "Certificates",
  "Summary",
  "Template",
  "Download",
] as const;
const LAST = STEPS.length - 1;
const TEMPLATE_STEP = 7;
const OPTIONAL = new Set([2, 4, 5]);

const SKILL_IDEAS = [
  "Communication",
  "Teamwork",
  "Leadership",
  "Problem solving",
  "Project management",
  "Excel",
  "Research",
  "Presentation",
  "Time management",
  "Customer service",
  "Data analysis",
  "Writing",
];

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="cr-f">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Bullets({
  items,
  onChange,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[];
  onChange: (i: number, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  placeholder: string;
}) {
  return (
    <div className="cr-bullets">
      <span className="cr-lbl">What you did and achieved</span>
      {items.map((h, i) => (
        <div className="cr-bullet" key={i}>
          <AutoTextarea
            value={h}
            placeholder={placeholder}
            aria-label={`Achievement ${i + 1}`}
            onChange={(e) => onChange(i, e.target.value)}
          />
          {items.length > 1 && (
            <button type="button" className="cr-x" aria-label={`Remove achievement ${i + 1}`} onClick={() => onRemove(i)}>
              ×
            </button>
          )}
        </div>
      ))}
      <button type="button" className="cr-link" onClick={onAdd}>+ Add another</button>
    </div>
  );
}

function StepHead({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <>
      <div className="cr-eyebrow">STEP {n + 1} OF {STEPS.length}{OPTIONAL.has(n) ? " · OPTIONAL" : ""}</div>
      <h2 className="cr-title">{title}</h2>
      <p className="cr-sub">{sub}</p>
    </>
  );
}

export function CreatorFlow({ mounted }: { mounted: boolean }) {
  const cv = useCVStore((s) => s.cv);
  const store = useCVStore;
  const started = useCVStore((s) => s.started);
  const activeTemplate = useCVStore((s) => s.activeTemplate);
  const setView = useViewStore((s) => s.setView);
  const openAuth = useUIStore((s) => s.openAuth);
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const reducedMotion = useReducedMotion();

  const [fresh] = useState(() => !useCVStore.getState().started);
  const [begun, setBegun] = useState(false);
  const [step, setStep] = useState(0);
  const [skillDraft, setSkillDraft] = useState("");
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fresh) store.getState().startBlank();
  }, [fresh, store]);

  const a = store.getState();
  const skillItems = cv.skills[0]?.items ?? [];
  const setSkills = (items: string[]) =>
    a.setSkills([{ id: cv.skills[0]?.id ?? uid("skl"), category: cv.skills[0]?.category || "Skills", items }]);
  const toggleSkill = (s: string) =>
    setSkills(skillItems.includes(s) ? skillItems.filter((x) => x !== s) : [...skillItems, s]);
  const addSkill = () => {
    const v = skillDraft.trim();
    if (v && !skillItems.some((x) => x.toLowerCase() === v.toLowerCase())) setSkills([...skillItems, v]);
    setSkillDraft("");
  };

  const go = (n: number) => {
    const next = Math.max(0, Math.min(LAST, n));
    if (next >= TEMPLATE_STEP) {
      const pruned = pruneBlankEntries(store.getState().cv);
      const st = store.getState();
      st.setExperience(pruned.experience);
      st.setEducation(pruned.education);
      st.setSkills(pruned.skills);
      st.setProjects(pruned.projects);
      st.setCertifications(pruned.certifications);
    }
    setStep(next);
    headRef.current?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
  };

  const person = cv.basics.fullName.trim();
  const defaultName = useMemo(() => (person ? `${person} · CV` : "My CV"), [person]);
  const [fileName, setFileName] = useState("");
  const saveAs = fileName.trim() || defaultName;

  const download = async (format: "pdf" | "docx") => {
    if (format === "pdf" && !document.getElementById("cv-paper")) {
      setMsg({ kind: "err", text: "Couldn’t find the live CV to export. Try again." });
      return;
    }
    setBusy(format);
    setMsg(null);
    try {
      const watermark = !signedIn;
      const ok =
        format === "pdf"
          ? await exportCVtoPDF("paged", saveAs, cv, { watermark })
          : await exportCVtoDocx(saveAs, cv, { watermark });
      if (!ok) {
        setMsg({ kind: "err", text: "Couldn’t build the file. Try again." });
        return;
      }
      if (signedIn) {
        void useLibraryStore.getState().recordExport({ name: saveAs, company: "", person, template: activeTemplate, cv, baseline: null });
      }
      setMsg({ kind: "ok", text: `Saved “${saveAs}.${format}”.` });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const shell = (body: React.ReactNode) => (
    <motion.div
      className="ws-view creator-view"
      initial={reducedMotion ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {body}
    </motion.div>
  );

  if (!mounted) return shell(<div className="pane-skeleton" />);

  if (!fresh && started && !begun) {
    return shell(
      <section className="cr-card cr-gate" aria-label="Start a new CV">
        <h2 className="cr-title">Start a new CV from scratch?</h2>
        <p className="cr-sub">
          You already have a CV in your workspace. Starting fresh replaces it with an empty one.
        </p>
        <div className="cr-nav">
          <button type="button" className="flow-btn" onClick={() => setView("edit")}>Keep editing my CV</button>
          <button
            type="button"
            className="flow-btn primary"
            onClick={() => {
              store.getState().startBlank();
              setBegun(true);
            }}
          >
            Start fresh
          </button>
        </div>
      </section>,
    );
  }

  const b = cv.basics;
  const link = b.links[0];

  return shell(
    <>
      <div ref={headRef} />
      <ol className="cr-steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? "is-done" : i === step ? "is-on" : ""}>
            <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined}>{s}</button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="cr-card" aria-label="About you">
          <StepHead n={0} title="Let’s start with you" sub="About five minutes. Everything saves on this device as you type." />
          <div className="cr-row">
            <Field label="Full name" value={b.fullName} onChange={(v) => a.setBasics({ fullName: v })} placeholder="Lola Lee" autoComplete="name" />
            <Field label="Job title you want" value={b.title} onChange={(v) => a.setBasics({ title: v })} placeholder="Product Designer" />
          </div>
          <div className="cr-row">
            <Field label="Email" type="email" value={b.email} onChange={(v) => a.setBasics({ email: v })} placeholder="lola@example.com" autoComplete="email" />
            <Field label="Phone" type="tel" value={b.phone} onChange={(v) => a.setBasics({ phone: v })} placeholder="+234 800 000 0000" autoComplete="tel" />
          </div>
          <div className="cr-row">
            <Field label="City, country" value={b.location} onChange={(v) => a.setBasics({ location: v })} placeholder="Lagos, Nigeria" />
            <Field
              label="LinkedIn or portfolio (optional)"
              value={link?.url ?? ""}
              onChange={(v) =>
                a.setBasics({ links: [{ id: link?.id ?? uid("lnk"), label: link?.label || "Portfolio", url: v }] })
              }
              placeholder="linkedin.com/in/lola"
            />
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="cr-card" aria-label="Experience">
          <StepHead n={1} title="Your work experience" sub="Start with your most recent role. Internships and volunteering count too." />
          {cv.experience.map((e, idx) => (
            <fieldset className="cr-item" key={e.id}>
              <legend>Role {idx + 1}</legend>
              <div className="cr-row">
                <Field label="Job title" value={e.role} onChange={(v) => a.updateExperience(e.id, { role: v })} placeholder="Senior Designer" />
                <Field label="Company" value={e.company} onChange={(v) => a.updateExperience(e.id, { company: v })} placeholder="Acme" />
              </div>
              <div className="cr-row">
                <Field label="Start" value={e.startDate ?? ""} onChange={(v) => a.updateExperience(e.id, { startDate: v })} placeholder="Jan 2022" />
                <Field label="End" value={e.current ? "Present" : (e.endDate ?? "")} onChange={(v) => a.updateExperience(e.id, { endDate: v, current: false })} placeholder="Dec 2024" />
              </div>
              <label className="cr-check">
                <input type="checkbox" checked={!!e.current} onChange={(ev) => a.updateExperience(e.id, { current: ev.target.checked, endDate: ev.target.checked ? "" : e.endDate })} />
                I currently work here
              </label>
              <Bullets
                items={e.highlights.length ? e.highlights : [""]}
                placeholder="Redesigned onboarding, lifting activation by 24%"
                onChange={(i, v) => a.setHighlight(e.id, i, v)}
                onAdd={() => a.addHighlight(e.id)}
                onRemove={(i) => a.removeHighlight(e.id, i)}
              />
              {cv.experience.length > 1 && (
                <button type="button" className="cr-link cr-danger" onClick={() => a.removeExperience(e.id)}>Remove this role</button>
              )}
            </fieldset>
          ))}
          <button type="button" className="flow-btn" onClick={a.addExperience}>+ Add another role</button>
          <p className="cr-tip">Start each point with a verb and add a number if you can: “Cut load time by 40%”.</p>
        </section>
      )}

      {step === 2 && (
        <section className="cr-card" aria-label="Education">
          <StepHead n={2} title="Education" sub="Degree, bootcamp or course. Skip it if it doesn’t apply." />
          {cv.education.map((e, idx) => (
            <fieldset className="cr-item" key={e.id}>
              <legend>Qualification {idx + 1}</legend>
              <div className="cr-row">
                <Field label="Qualification" value={e.degree} onChange={(v) => a.updateEducation(e.id, { degree: v })} placeholder="BSc Design" />
                <Field label="School" value={e.institution} onChange={(v) => a.updateEducation(e.id, { institution: v })} placeholder="University of Lagos" />
              </div>
              <div className="cr-row">
                <Field label="Start" value={e.startDate ?? ""} onChange={(v) => a.updateEducation(e.id, { startDate: v })} placeholder="2016" />
                <Field label="End" value={e.endDate ?? ""} onChange={(v) => a.updateEducation(e.id, { endDate: v })} placeholder="2020" />
              </div>
              {cv.education.length > 1 && (
                <button type="button" className="cr-link cr-danger" onClick={() => a.removeEducation(e.id)}>Remove</button>
              )}
            </fieldset>
          ))}
          <button type="button" className="flow-btn" onClick={a.addEducation}>+ Add another</button>
        </section>
      )}

      {step === 3 && (
        <section className="cr-card" aria-label="Skills">
          <StepHead n={3} title="Your skills" sub="Tap to add, or type your own. Six to ten works well." />
          <div className="cr-chips">
            {[...new Set([...skillItems, ...SKILL_IDEAS])].map((s) => (
              <button type="button" key={s} className={`cr-chip${skillItems.includes(s) ? " is-on" : ""}`} aria-pressed={skillItems.includes(s)} onClick={() => toggleSkill(s)}>
                {s}
              </button>
            ))}
          </div>
          <form
            className="cr-add"
            onSubmit={(e) => {
              e.preventDefault();
              addSkill();
            }}
          >
            <input value={skillDraft} onChange={(e) => setSkillDraft(e.target.value)} placeholder="Add your own, e.g. Figma" aria-label="Add a skill" />
            <button type="submit" className="flow-btn">Add</button>
          </form>
        </section>
      )}

      {step === 4 && (
        <section className="cr-card" aria-label="Projects">
          <StepHead n={4} title="Projects" sub="Side projects, portfolio pieces or anything you built. Skip if none." />
          {cv.projects.map((p, idx) => (
            <fieldset className="cr-item" key={p.id}>
              <legend>Project {idx + 1}</legend>
              <div className="cr-row">
                <Field label="Project name" value={p.name} onChange={(v) => a.updateProject(p.id, { name: v })} placeholder="Community food map" />
                <Field label="Your role" value={p.role ?? ""} onChange={(v) => a.updateProject(p.id, { role: v })} placeholder="Lead designer" />
              </div>
              <Field label="Link (optional)" value={p.url ?? ""} onChange={(v) => a.updateProject(p.id, { url: v })} placeholder="https://" />
              <Bullets
                items={p.highlights.length ? p.highlights : [""]}
                placeholder="What it does and the result"
                onChange={(i, v) => a.setProjectHighlight(p.id, i, v)}
                onAdd={() => a.addProjectHighlight(p.id)}
                onRemove={(i) => a.removeProjectHighlight(p.id, i)}
              />
              <button type="button" className="cr-link cr-danger" onClick={() => a.removeProject(p.id)}>Remove</button>
            </fieldset>
          ))}
          <button type="button" className="flow-btn" onClick={a.addProject}>+ Add a project</button>
        </section>
      )}

      {step === 5 && (
        <section className="cr-card" aria-label="Certificates">
          <StepHead n={5} title="Certificates" sub="Licences, courses and awards. Skip if none." />
          {cv.certifications.map((c, idx) => (
            <fieldset className="cr-item" key={c.id}>
              <legend>Certificate {idx + 1}</legend>
              <div className="cr-row">
                <Field label="Name" value={c.name} onChange={(v) => a.updateCertification(c.id, { name: v })} placeholder="Google UX Design Certificate" />
                <Field label="Issued by" value={c.issuer ?? ""} onChange={(v) => a.updateCertification(c.id, { issuer: v })} placeholder="Coursera" />
              </div>
              <div className="cr-row">
                <Field label="Date" value={c.date ?? ""} onChange={(v) => a.updateCertification(c.id, { date: v })} placeholder="2023" />
                <Field label="Link (optional)" value={c.url ?? ""} onChange={(v) => a.updateCertification(c.id, { url: v })} placeholder="https://" />
              </div>
              <button type="button" className="cr-link cr-danger" onClick={() => a.removeCertification(c.id)}>Remove</button>
            </fieldset>
          ))}
          <button type="button" className="flow-btn" onClick={a.addCertification}>+ Add a certificate</button>
        </section>
      )}

      {step === 6 && (
        <section className="cr-card" aria-label="Summary">
          <StepHead n={6} title="A short summary" sub="Two or three sentences on who you are and what you bring." />
          <label className="cr-f">
            <span>Summary</span>
            <AutoTextarea
              value={b.summary}
              placeholder="Product designer with six years of experience shipping onboarding and growth features…"
              onChange={(e) => a.setBasics({ summary: e.target.value })}
            />
          </label>
          <p className="cr-tip">
            Stuck?{" "}
            <button type="button" className="cr-link" onClick={() => openAuth("signup", null, "Sign up to write your summary with AI")}>
              Write it with AI
            </button>{" "}
            (free account needed). Totally optional.
          </p>
        </section>
      )}

      {step === 7 && (
        <section className="cr-card" aria-label="Template">
          <StepHead n={7} title="Pick a look" sub="The preview updates instantly. You can change it any time." />
          <div className="cr-tpls">
            {TEMPLATE_CATALOG.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`cr-tpl${activeTemplate === t.id ? " is-on" : ""}`}
                aria-pressed={activeTemplate === t.id}
                onClick={() => a.setTemplate(t.id)}
              >
                <span className="cr-tpl-sw" style={{ background: t.swatch }} aria-hidden />
                <strong>{t.name}</strong>
                <small>{t.blurb}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 8 && (
        <section className="cr-card cr-done" aria-label="Download">
          <div className="cr-eyebrow">DONE</div>
          <h2 className="cr-title">Your CV is ready{person ? `, ${person.split(/\s+/)[0]}` : ""}</h2>
          <p className="cr-sub">Free to download, no account needed, and it doesn’t use any of your plan’s downloads.</p>
          <label className="cr-f">
            <span>File name</span>
            <input value={fileName} placeholder={defaultName} onChange={(e) => setFileName(e.target.value)} />
          </label>
          <div className="cr-dl">
            <button type="button" className="flow-btn primary" disabled={busy !== null} onClick={() => void download("pdf")}>
              {busy === "pdf" ? "Building PDF…" : "Download PDF"}
            </button>
            <button type="button" className="flow-btn" disabled={busy !== null} onClick={() => void download("docx")}>
              {busy === "docx" ? "Building Word…" : "Download Word (.docx)"}
            </button>
          </div>
          {msg && <p className={`cr-msg ${msg.kind}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</p>}
          {!signedIn && (
            <div className="cr-up">
              <strong>Sign up free to remove the “Made with Orire” mark</strong>
              <span>Also: sync to the cloud, tailor your CV to a job and get graded with AI.</span>
              <button type="button" className="flow-btn sm" onClick={() => openAuth("signup", null, "Sign up free to remove the mark and unlock AI")}>
                Sign up free
              </button>
            </div>
          )}
          <div className="cr-nav">
            <button type="button" className="flow-btn ghost" onClick={() => setView("edit")}>Fine-tune in the editor</button>
          </div>
        </section>
      )}

      {step < LAST && (
        <div className="cr-nav">
          <button type="button" className="flow-btn ghost" onClick={() => go(step - 1)} style={{ visibility: step ? "visible" : "hidden" }}>
            Back
          </button>
          <span className="cr-nav-r">
            {OPTIONAL.has(step) && (
              <button type="button" className="flow-btn ghost" onClick={() => go(step + 1)}>Skip</button>
            )}
            <button type="button" className="flow-btn primary" onClick={() => go(step + 1)}>
              {step === TEMPLATE_STEP ? "Finish" : "Continue"} →
            </button>
          </span>
        </div>
      )}
      {step === LAST && (
        <div className="cr-nav">
          <button type="button" className="flow-btn ghost" onClick={() => go(step - 1)}>Back</button>
        </div>
      )}
    </>,
  );
}
