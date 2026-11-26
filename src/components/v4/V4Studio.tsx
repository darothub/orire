"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useCVStore } from "@/lib/store/cvStore";
import { useUIStore } from "@/lib/store/uiStore";
import { TEMPLATES } from "@/components/templates/registry";
import { analyzeBullet } from "@/lib/cv/coach";
import { moveAt } from "@/lib/cv/reorder";
import { blockRows, flaggedBullets, nextBlock, roleOptions, type RoleOption } from "@/lib/v4/studio";
import { useBulletReview } from "@/lib/ai/useBulletReview";
import { useStudioRefine } from "@/lib/v4/useStudioRefine";
import { useHydrated } from "@/lib/v4/useHydrated";
import { Toggle } from "@/components/ui/Toggle";
import { AutoTextarea } from "@/components/editor/AutoTextarea";
import { V4Shell } from "./V4Shell";
import { V4Paper } from "./V4Paper";

type MobileTab = "preview" | "blocks" | "coach";
type PanelTab = "details" | "coach";
const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "blocks", label: "Blocks" },
  { id: "coach", label: "Coach" },
];
const FEATURED_TEMPLATES = 6;

/** CV Studio: template, blocks, live editing on the paper, coach and Refine. */
export function V4Studio() {
  const hydrated = useHydrated();
  const cv = useCVStore((s) => s.cv);
  const started = useCVStore((s) => s.started);
  const templateId = useCVStore((s) => s.activeTemplate);
  const setTemplate = useCVStore((s) => s.setTemplate);
  const previewEdit = useUIStore((s) => s.previewEdit);
  const setPreviewEdit = useUIStore((s) => s.setPreviewEdit);
  const refine = useStudioRefine();
  const [mobileTab, setMobileTab] = useState<MobileTab>("preview");
  const [panelTab, setPanelTab] = useState<PanelTab>("details");
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDialogElement>(null);

  const featured = useMemo(() => {
    const top = TEMPLATES.slice(0, FEATURED_TEMPLATES);
    return top.some((t) => t.id === templateId) ? top : [...top.slice(0, FEATURED_TEMPLATES - 1), TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]];
  }, [templateId]);

  function openMore() {
    setMore(true);
    moreRef.current?.showModal();
  }
  function closeMore() {
    setMore(false);
    moreRef.current?.close();
  }

  if (hydrated && !started) {
    return (
      <V4Shell active="studio" label="CV Studio">
        <div className="v4-scroll">
          <div className="v4-empty-state">
            <b>No CV yet</b>
            <p>Import your CV or start from a blank one in the Copilot, then come back to polish it here.</p>
            <Link href="/occ/v4" className="v4-link">Open Copilot</Link>
          </div>
        </div>
      </V4Shell>
    );
  }

  return (
    <V4Shell active="studio" label="CV Studio">
      <div className={`v4-studio tab-${mobileTab}`}>
        <div className="v4-studio-bar">
          <div className="v4-chips" role="group" aria-label="Template">
            {featured.map((t) => (
              <button key={t.id} type="button" className={`v4-chip${t.id === templateId ? " on" : ""}`} aria-pressed={t.id === templateId} onClick={() => setTemplate(t.id)}>
                {t.name}
              </button>
            ))}
            <button type="button" className="v4-chip" onClick={openMore}>More templates</button>
          </div>
          <Toggle checked={previewEdit} onChange={setPreviewEdit} label="Live edit" tone="match" />
        </div>

        <div className="v4-mtabs" role="tablist" aria-label="Studio view">
          {MOBILE_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={mobileTab === t.id} className={mobileTab === t.id ? "on" : ""} onClick={() => setMobileTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="v4-studio-grid">
          <BlocksRail />
          <section className="v4-studio-paper" aria-label="CV preview">
            <V4Paper cv={cv} templateId={templateId} styled editing={previewEdit} />
            <div className="v4-mobile-edit"><DetailsPanel /></div>
          </section>
          <aside className="v4-studio-side">
            <div className="v4-seg" role="tablist" aria-label="Side panel">
              {(["details", "coach"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={panelTab === t} className={panelTab === t ? "on" : ""} onClick={() => setPanelTab(t)}>
                  {t === "details" ? "Details" : "Coach"}
                </button>
              ))}
            </div>
            {panelTab === "details" ? <DetailsPanel /> : <CoachPanel />}
            <RefineCard refine={refine} />
          </aside>
        </div>
        <div className="v4-mobile-coach"><CoachPanel /><RefineCard refine={refine} /></div>

        <dialog ref={moreRef} className="v4-dialog" aria-label="All templates" onClose={() => setMore(false)}>
          {more && (
            <>
              <div className="v4-dialog-head">
                <b>All templates</b>
                <button type="button" className="or-btn" onClick={closeMore}>Close</button>
              </div>
              <ul className="v4-tpl-list">
                {TEMPLATES.map((t) => (
                  <li key={t.id}>
                    <button type="button" className={`v4-tpl${t.id === templateId ? " on" : ""}`} onClick={() => { setTemplate(t.id); closeMore(); }}>
                      <span className="v4-tpl-sw" style={{ background: t.swatch }} aria-hidden />
                      <span className="v4-tpl-name">{t.name}</span>
                      <span className="v4-tpl-blurb">{t.blurb}</span>
                      <span className={`v4-badge${t.ats ? " ats" : ""}`}>{t.ats ? "ATS" : "Design"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </dialog>
      </div>
    </V4Shell>
  );
}

function BlocksRail() {
  const cv = useCVStore((s) => s.cv);
  const setOrder = useCVStore((s) => s.setOrder);
  const toggleSection = useCVStore((s) => s.toggleSection);
  const rows = blockRows(cv);
  const next = nextBlock(cv);
  return (
    <nav className="v4-blocks" aria-label="Blocks">
      <h2>Blocks</h2>
      <ul>
        {rows.map((r) => (
          <li key={r.key} className={r.visible ? "" : "off"}>
            <label className="v4-block-name">
              <input type="checkbox" checked={r.visible} onChange={() => toggleSection(r.key)} />
              <span>{r.label}</span>
              {r.key === next && <em className="v4-block-next">Next</em>}
            </label>
            {r.visible && (
              <span className="v4-block-move">
                <button type="button" aria-label={`Move ${r.label} up`} disabled={r.index === 0} onClick={() => setOrder(moveAt(cv.order, r.index, -1))}>▲</button>
                <button type="button" aria-label={`Move ${r.label} down`} disabled={r.index === cv.order.length - 1} onClick={() => setOrder(moveAt(cv.order, r.index, 1))}>▼</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DetailsPanel() {
  const cv = useCVStore((s) => s.cv);
  const roles = useMemo(() => roleOptions(cv), [cv]);
  const [pick, setPick] = useState<string>("");
  const current = roles.find((r) => r.id === pick) ?? roles[0];
  if (!current) return <p className="v4-muted">Add a role or project to edit its bullets here.</p>;
  return (
    <div className="v4-details">
      <div className="v4-chips" role="group" aria-label="Role">
        {roles.map((r) => (
          <button key={r.id} type="button" className={`v4-chip${r.id === current.id ? " on" : ""}`} aria-pressed={r.id === current.id} onClick={() => setPick(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
      <RoleEditor key={current.id} role={current} />
    </div>
  );
}

function RoleEditor({ role }: { role: RoleOption }) {
  const exp = useCVStore((s) => s.cv.experience.find((e) => e.id === role.id));
  const prj = useCVStore((s) => s.cv.projects.find((p) => p.id === role.id));
  const updateExperience = useCVStore((s) => s.updateExperience);
  const updateProject = useCVStore((s) => s.updateProject);
  const setHighlight = useCVStore((s) => s.setHighlight);
  const setProjectHighlight = useCVStore((s) => s.setProjectHighlight);
  const addHighlight = useCVStore((s) => s.addHighlight);
  const addProjectHighlight = useCVStore((s) => s.addProjectHighlight);
  const removeHighlight = useCVStore((s) => s.removeHighlight);
  const removeProjectHighlight = useCVStore((s) => s.removeProjectHighlight);
  const setHighlights = useCVStore((s) => s.setHighlights);
  const setProjectHighlights = useCVStore((s) => s.setProjectHighlights);
  const isExp = role.kind === "experience";
  const bullets = (isExp ? exp?.highlights : prj?.highlights) ?? [];

  const set = (i: number, v: string) => (isExp ? setHighlight(role.id, i, v) : setProjectHighlight(role.id, i, v));
  const add = () => (isExp ? addHighlight(role.id) : addProjectHighlight(role.id));
  const remove = (i: number) => (isExp ? removeHighlight(role.id, i) : removeProjectHighlight(role.id, i));
  const move = (i: number, dir: -1 | 1) => (isExp ? setHighlights(role.id, moveAt(bullets, i, dir)) : setProjectHighlights(role.id, moveAt(bullets, i, dir)));

  return (
    <div>
      <div className="v4-role-fields">
        {isExp && exp ? (
          <>
            <label>Role<input value={exp.role} onChange={(e) => updateExperience(role.id, { role: e.target.value })} /></label>
            <label>Company<input value={exp.company} onChange={(e) => updateExperience(role.id, { company: e.target.value })} /></label>
            <label>Start<input value={exp.startDate ?? ""} onChange={(e) => updateExperience(role.id, { startDate: e.target.value })} /></label>
            <label>End<input value={exp.endDate ?? ""} disabled={exp.current} onChange={(e) => updateExperience(role.id, { endDate: e.target.value })} /></label>
          </>
        ) : prj ? (
          <>
            <label>Project<input value={prj.name} onChange={(e) => updateProject(role.id, { name: e.target.value })} /></label>
            <label>Your role<input value={prj.role ?? ""} onChange={(e) => updateProject(role.id, { role: e.target.value })} /></label>
          </>
        ) : null}
      </div>
      <ul className="v4-bullets">
        {bullets.map((b, i) => (
          <BulletRow key={`${role.id}-${i}`} value={b} onChange={(v) => set(i, v)} onRemove={() => remove(i)} onUp={i > 0 ? () => move(i, -1) : undefined} onDown={i < bullets.length - 1 ? () => move(i, 1) : undefined} />
        ))}
      </ul>
      <button type="button" className="or-btn" onClick={add}>+ Add bullet</button>
    </div>
  );
}

function BulletRow({ value, onChange, onRemove, onUp, onDown }: { value: string; onChange: (v: string) => void; onRemove: () => void; onUp?: () => void; onDown?: () => void }) {
  const flags = useMemo(() => analyzeBullet(value), [value]);
  const { busy, review, err, improve, clearReview } = useBulletReview({ value, flags, onUpgrade: () => undefined });
  return (
    <li className="v4-bullet">
      <AutoTextarea value={value} onChange={(e) => onChange(e.target.value)} aria-label="Bullet" className="v4-bullet-text" />
      {flags.length > 0 && (
        <div className="v4-flags">
          {flags.map((f) => <span key={f.id} className={`v4-flag ${f.severity}`} title={f.hint}>{f.label}</span>)}
        </div>
      )}
      <div className="v4-bullet-actions">
        <button type="button" className="or-btn" onClick={() => void improve()} disabled={busy || !value.trim()}>{busy ? "Reviewing…" : "Improve"}</button>
        <button type="button" aria-label="Move bullet up" disabled={!onUp} onClick={onUp}>▲</button>
        <button type="button" aria-label="Move bullet down" disabled={!onDown} onClick={onDown}>▼</button>
        <button type="button" aria-label="Remove bullet" onClick={onRemove}>Remove</button>
      </div>
      {err && (
        <p className="v4-muted" role="status">{err} <Link href="/pricing" className="v4-link">See plans</Link></p>
      )}
      {review && (
        <div className="v4-review" role="status">
          {review.issues.map((iss, i) => <p key={i}>{iss.message}</p>)}
          {review.suggestion && (
            <>
              <p className="v4-suggest">{review.suggestion}</p>
              <button type="button" className="or-btn gold" onClick={() => { onChange(review.suggestion); clearReview(); }}>Use this</button>
            </>
          )}
          <button type="button" className="or-btn" onClick={clearReview}>Dismiss</button>
        </div>
      )}
    </li>
  );
}

function CoachPanel() {
  const cv = useCVStore((s) => s.cv);
  const flagged = useMemo(() => flaggedBullets(cv), [cv]);
  if (flagged.length === 0) return <p className="v4-muted">No weak bullets found. Nice.</p>;
  return (
    <ul className="v4-coach">
      {flagged.map((f) => (
        <li key={`${f.id}-${f.index}`}>
          <b>{f.roleLabel}</b>
          <p>{f.text}</p>
          <div className="v4-flags">{f.flags.map((x) => <span key={x.id} className={`v4-flag ${x.severity}`} title={x.hint}>{x.label}</span>)}</div>
        </li>
      ))}
    </ul>
  );
}

function RefineCard({ refine }: { refine: ReturnType<typeof useStudioRefine> }) {
  const { hasJob, running, review, skipped, message } = refine;
  return (
    <section className="v4-refine" aria-label="Refine">
      <h3>Refine for a job</h3>
      <button type="button" className="or-btn gold" disabled={!hasJob || running} onClick={() => void refine.run()}>
        {running ? "Refining…" : "Refine"}
      </button>
      {!hasJob && (
        <p className="v4-muted">Add a job description to tailor your CV. <Link href="/occ/v4" className="v4-link">Add one in the Copilot</Link></p>
      )}
      {message && <p className="v4-muted" role="status">{message}</p>}
      {review && (
        <div className="v4-changes">
          {review.changes.map((c) => (
            <div key={c.id} className={`v4-change${skipped.has(c.id) ? " skipped" : ""}`}>
              <b>{c.label}</b>
              <p className="v4-was">{c.before.join("\n")}</p>
              <p className="v4-now">{c.after.join("\n")}</p>
              <button type="button" className="or-btn" onClick={() => refine.toggle(c.id)}>{skipped.has(c.id) ? "Accept" : "Skip"}</button>
            </div>
          ))}
          <button type="button" className="or-btn gold" onClick={refine.apply} disabled={skipped.size === review.changes.length}>
            Apply {review.changes.length - skipped.size} changes
          </button>
          <button type="button" className="or-btn" onClick={refine.dismiss}>Dismiss</button>
        </div>
      )}
    </section>
  );
}
