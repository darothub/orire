"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { useLibraryStore, groupByCompany, type CvVersion } from "@/lib/store/libraryStore";
import { getTemplate } from "@/components/templates/registry";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function LibraryView() {
  const versions = useLibraryStore((s) => s.versions);
  const lastCompany = useLibraryStore((s) => s.lastCompany);
  const cloud = useLibraryStore((s) => s.cloud);
  const loading = useLibraryStore((s) => s.loading);
  const saveVersion = useLibraryStore((s) => s.saveVersion);
  const refreshFromCloud = useLibraryStore((s) => s.refreshFromCloud);
  const clear = useLibraryStore((s) => s.clear);

  const cv = useCVStore((s) => s.cv);
  const baseline = useCVStore((s) => s.baseline);
  const activeTemplate = useCVStore((s) => s.activeTemplate);

  const [saving, setSaving] = useState(false);
  const person = cv.basics.fullName.trim();
  const [draftName, setDraftName] = useState("");
  const [draftCompany, setDraftCompany] = useState("");

  // When signed in, pull the latest versions from the server on entry.
  useEffect(() => {
    if (cloud) void refreshFromCloud();
  }, [cloud, refreshFromCloud]);

  const groups = groupByCompany(versions);

  const openSave = () => {
    setDraftName(person ? `${person} — CV` : "Untitled version");
    setDraftCompany(lastCompany);
    setSaving(true);
  };

  const confirmSave = () => {
    void saveVersion({ name: draftName, company: draftCompany, person, template: activeTemplate, cv, baseline });
    setSaving(false);
  };

  return (
    <motion.div
      className="ws-view history-view library-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>{VIEW_META.history.label}</h2>
          <p>Save the CV you’re working on as a named version, then switch between tailored variants per company. Each export is filed here too.{cloud ? " Your versions are saved to your account." : ""}</p>
        </div>
        <div className="lib-head-actions">
          <button className="flow-btn primary" onClick={openSave}>＋ Save current CV</button>
          {!cloud && versions.length > 0 && <button className="flow-btn ghost" onClick={clear}>Clear all</button>}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {saving && (
          <motion.div
            className="lib-save"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lib-save-row">
              <label className="exp-field">
                <span className="exp-label">Version name</span>
                <input className="ed-input" value={draftName} autoFocus spellCheck={false} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Backend — Stripe" />
              </label>
              <label className="exp-field">
                <span className="exp-label">Company <span className="exp-opt">· for filing</span></span>
                <input className="ed-input" value={draftCompany} spellCheck={false} onChange={(e) => setDraftCompany(e.target.value)} placeholder="e.g. Acme Corp" onKeyDown={(e) => e.key === "Enter" && confirmSave()} />
              </label>
            </div>
            <div className="lib-save-actions">
              <button className="flow-btn ghost sm" onClick={() => setSaving(false)}>Cancel</button>
              <button className="flow-btn primary sm" onClick={confirmSave}>Save version</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {versions.length === 0 ? (
        <div className="hist-empty">
          <span className="hist-empty-ic" aria-hidden>🗂️</span>
          <p>{loading ? "Loading your versions…" : "No saved versions yet. Save the CV you’re working on, or export one — both land here, grouped by company."}</p>
        </div>
      ) : (
        <div className="hist-groups">
          {groups.map((g) => (
            <section key={g.company} className="hist-group">
              <div className="hist-company">
                <span className="hist-company-dot" aria-hidden />
                <h3>{g.company}</h3>
                <span className="hist-count">{g.items.length}</span>
              </div>
              <div className="hist-list">
                <AnimatePresence initial={false}>
                  {g.items.map((v) => (
                    <VersionCard key={v.id} version={v} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function VersionCard({ version: v }: { version: CvVersion }) {
  const activeId = useLibraryStore((s) => s.activeId);
  const rename = useLibraryStore((s) => s.rename);
  const refile = useLibraryStore((s) => s.refile);
  const duplicate = useLibraryStore((s) => s.duplicate);
  const remove = useLibraryStore((s) => s.remove);
  const activate = useLibraryStore((s) => s.activate);
  const cloud = useLibraryStore((s) => s.cloud);
  const share = useLibraryStore((s) => s.share);
  const unshare = useLibraryStore((s) => s.unshare);
  const setView = useViewStore((s) => s.setView);

  const active = activeId === v.id;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(v.name);
  const [company, setCompany] = useState(v.company);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareErr, setShareErr] = useState("");

  const shareLink = v.shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/cv/${v.shareToken}` : "";

  const copyShare = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the link is still shown for manual copy */
    }
  };

  const doShare = async () => {
    setShareBusy(true);
    setShareErr("");
    try {
      const token = await share(v.id);
      if (token) await copyShare(`${window.location.origin}/cv/${token}`);
      else setShareErr("Couldn’t create a share link. Make sure you’re signed in, then try again.");
    } finally {
      setShareBusy(false);
    }
  };

  const tpl = getTemplate(v.template);

  const makeActive = async () => {
    await activate(v.id);
    setView("edit");
  };

  const saveEdit = async () => {
    await rename(v.id, name);
    await refile(v.id, company);
    setEditing(false);
  };

  return (
    <motion.div
      className={`hist-card lib-card${active ? " active" : ""}`}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {editing ? (
        <div className="lib-card-edit">
          <input className="ed-input" value={name} autoFocus spellCheck={false} onChange={(e) => setName(e.target.value)} placeholder="Version name" />
          <input className="ed-input" value={company} spellCheck={false} onChange={(e) => setCompany(e.target.value)} placeholder="Company" onKeyDown={(e) => e.key === "Enter" && void saveEdit()} />
          <div className="lib-card-edit-actions">
            <button className="hist-btn" onClick={() => void saveEdit()}>Save</button>
            <button className="hist-btn" onClick={() => { setName(v.name); setCompany(v.company); setEditing(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="hist-card-main">
            <strong className="hist-name">
              {v.name}
              {active && <span className="lib-active-badge">Active</span>}
            </strong>
            <div className="hist-meta">
              <span className="hist-tag">{tpl.name}</span>
              {v.person && <span className="hist-person">{v.person}</span>}
              <span className="hist-time">updated {timeAgo(v.updatedAt)}</span>
              {v.lastExportedAt && <span className="hist-tag subtle">exported</span>}
            </div>
          </div>
          <div className="hist-card-actions">
            <button className="hist-btn" onClick={() => void makeActive()} title="Load this version into the editor" disabled={active}>
              {active ? "Editing" : "Make active"}
            </button>
            <button className="hist-btn" onClick={() => setEditing(true)} title="Rename / re-file">Edit</button>
            <button className="hist-btn" onClick={() => void duplicate(v.id)} title="Duplicate this version">Duplicate</button>
            {cloud ? (
              !v.shareToken && (
                <button className="hist-btn" onClick={() => void doShare()} disabled={shareBusy} title="Create a public link to this CV">
                  {shareBusy ? "…" : "Share"}
                </button>
              )
            ) : (
              <button className="hist-btn" disabled title="Sign in to share your CV as a public link">Share</button>
            )}
            <button className="hist-btn danger" onClick={() => void remove(v.id)} title="Delete this version" aria-label="Delete">✕</button>
          </div>
        </>
      )}

      {!editing && shareErr && (
        <div className="lib-share"><span className="lib-share-err">{shareErr}</span></div>
      )}

      {!editing && cloud && v.shareToken && (
        <div className="lib-share">
          <span className="lib-share-badge" title="Anyone with this link can view this CV">🔗 Public link</span>
          <input className="lib-share-url" value={shareLink} readOnly onFocus={(e) => e.currentTarget.select()} />
          <button className="hist-btn" onClick={() => void copyShare(shareLink)}>{copied ? "Copied!" : "Copy"}</button>
          <button className="hist-btn danger" onClick={() => void unshare(v.id)} title="Stop sharing — the link stops working">Unshare</button>
        </div>
      )}
    </motion.div>
  );
}
