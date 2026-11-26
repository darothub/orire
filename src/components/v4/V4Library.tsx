"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCVStore } from "@/lib/store/cvStore";
import { groupByCompany, useLibraryStore, type CvVersion } from "@/lib/store/libraryStore";
import { getTemplateInfo } from "@/lib/templates/catalog";
import { timeAgo, tileInitial } from "@/lib/home/homeStats";
import { LIBRARY_FILTERS, filterCounts, filterVersions, versionTags, type LibraryFilter } from "@/lib/v4/library";
import { useHydrated } from "@/lib/v4/useHydrated";
import { Button } from "@/components/ui/Button";
import { V4Shell } from "./V4Shell";
import { V4Paper } from "./V4Paper";

const templateName = (id: string) => getTemplateInfo(id)?.name ?? id;
const shareUrl = (token: string) => `${window.location.origin}/cv/${token}`;

/** Version library: every saved CV as its own card, grouped by company on mobile. */
export function V4Library() {
  const hydrated = useHydrated();
  const versions = useLibraryStore((s) => s.versions);
  const activeId = useLibraryStore((s) => s.activeId);
  const cloud = useLibraryStore((s) => s.cloud);
  const loading = useLibraryStore((s) => s.loading);
  const lastCompany = useLibraryStore((s) => s.lastCompany);
  const saveVersion = useLibraryStore((s) => s.saveVersion);
  const refreshFromCloud = useLibraryStore((s) => s.refreshFromCloud);
  const migrationNote = useLibraryStore((s) => s.migrationNote);
  const dismissMigrationNote = useLibraryStore((s) => s.dismissMigrationNote);
  const cv = useCVStore((s) => s.cv);
  const baseline = useCVStore((s) => s.baseline);
  const started = useCVStore((s) => s.started);
  const activeTemplate = useCVStore((s) => s.activeTemplate);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftCompany, setDraftCompany] = useState("");

  useEffect(() => {
    if (cloud) void refreshFromCloud();
  }, [cloud, refreshFromCloud]);

  const shown = useMemo(
    () => filterVersions(versions, { filter, query, activeId, templateName }),
    [versions, filter, query, activeId],
  );
  const counts = useMemo(() => filterCounts(versions, activeId), [versions, activeId]);
  const groups = groupByCompany(shown);
  const companies = new Set(versions.map((v) => v.company.trim() || "Unfiled")).size;
  const person = cv.basics.fullName.trim();

  function openSave() {
    setDraftName(person ? `${person} · CV` : "Untitled version");
    setDraftCompany(lastCompany);
    setSaving(true);
  }
  async function confirmSave() {
    await saveVersion({ name: draftName, company: draftCompany, person, template: activeTemplate, cv, baseline });
    setSaving(false);
  }

  const saveButton = (
    <Button variant="gold" onClick={openSave} disabled={!started} title={started ? undefined : "Create your CV in the studio first"}>
      + Save current CV as a version
    </Button>
  );

  return (
    <V4Shell active="library" label="Version library">
      <div className="v4-scroll v4-lib">
        <header className="v4-head">
          <h1>Version library</h1>
          <p>
            {hydrated && versions.length > 0
              ? `${versions.length} ${versions.length === 1 ? "version" : "versions"} across ${companies} ${companies === 1 ? "company" : "companies"}. Open one in the studio to keep editing.`
              : "Every CV you save, grouped by company. Open one in the studio to keep editing."}
          </p>
        </header>

        {migrationNote && (
          <p className="v4-note" role="status">
            <span>{migrationNote}</span>
            <Button variant="ghost" size="sm" onClick={dismissMigrationNote}>Dismiss</Button>
          </p>
        )}

        <div className="v4-lib-tools">
          <label className="v4-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search versions or companies" aria-label="Search versions or companies" />
          </label>
          <div className="v4-chips" role="group" aria-label="Filter versions">
            {LIBRARY_FILTERS.map((f) => (
              <button key={f.id} type="button" className={`v4-chip${filter === f.id ? " on" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}{hydrated ? ` ${counts[f.id]}` : ""}
              </button>
            ))}
          </div>
          <div className="v4-lib-save-btn">{saveButton}</div>
        </div>

        {saving && (
          <form className="v4-save" onSubmit={(e) => { e.preventDefault(); void confirmSave(); }}>
            <label>
              <span>Version name</span>
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} autoFocus spellCheck={false} placeholder="e.g. Backend, Stripe" />
            </label>
            <label>
              <span>Company (for filing)</span>
              <input value={draftCompany} onChange={(e) => setDraftCompany(e.target.value)} spellCheck={false} placeholder="e.g. Acme Corp" />
            </label>
            <div className="v4-save-actions">
              <Button variant="ghost" onClick={() => setSaving(false)}>Cancel</Button>
              <Button type="submit">Save version</Button>
            </div>
          </form>
        )}

        {!hydrated ? null : versions.length === 0 ? (
          <div className="v4-empty-state">
            <b>{loading ? "Loading your versions…" : "No saved versions yet"}</b>
            {!loading && <p>Save the CV you are working on, or export one. Each version lands here, filed by company.</p>}
          </div>
        ) : shown.length === 0 ? (
          <div className="v4-empty-state">
            <b>No versions match</b>
            <p>Try a different search or filter.</p>
            <Button variant="ghost" onClick={() => { setQuery(""); setFilter("all"); }}>Clear search and filters</Button>
          </div>
        ) : (
          <div className="v4-lib-groups">
            {groups.map((g) => (
              <section key={g.company} className="v4-lib-group" aria-label={g.company}>
                <div className="v4-lib-grouphead">
                  <span className="v4-mono" aria-hidden>{tileInitial({ company: g.company, name: g.company })}</span>
                  <div><h2>{g.company}</h2><span>{g.items.length} {g.items.length === 1 ? "version" : "versions"}</span></div>
                </div>
                {g.items.map((v) => <VersionCard key={v.id} version={v} company={g.company} />)}
              </section>
            ))}
            <div className="v4-lib-addcard">{saveButton}</div>
          </div>
        )}
      </div>
    </V4Shell>
  );
}

function VersionCard({ version: v, company }: { version: CvVersion; company: string }) {
  const router = useRouter();
  const activeId = useLibraryStore((s) => s.activeId);
  const cloud = useLibraryStore((s) => s.cloud);
  const rename = useLibraryStore((s) => s.rename);
  const refile = useLibraryStore((s) => s.refile);
  const duplicate = useLibraryStore((s) => s.duplicate);
  const remove = useLibraryStore((s) => s.remove);
  const activate = useLibraryStore((s) => s.activate);
  const share = useLibraryStore((s) => s.share);
  const unshare = useLibraryStore((s) => s.unshare);

  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [name, setName] = useState(v.name);
  const [coName, setCoName] = useState(v.company);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const tags = versionTags(v, activeId);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
    } catch {
      setNote("Couldn't copy. Select the link in the menu instead.");
    }
  }
  async function onShare() {
    if (!cloud) return;
    if (v.shareToken) return copy(shareUrl(v.shareToken));
    setBusy(true);
    const token = await share(v.id);
    setBusy(false);
    if (token) await copy(shareUrl(token));
    else setNote("Couldn't create a link. Check you are signed in and try again.");
  }
  async function onOpen() {
    setBusy(true);
    await activate(v.id);
    router.push("/v4/studio");
  }
  async function saveEdit() {
    await rename(v.id, name);
    await refile(v.id, coName);
    setMode("view");
  }

  return (
    <article className={`v4-vc${v.id === activeId ? " active" : ""}`}>
      <div className="v4-vc-head">
        <span className="v4-mono" aria-hidden>{tileInitial({ company, name: v.name })}</span>
        <b>{company}</b>
        <div className="v4-menu" ref={menuRef}>
          <button type="button" className="v4-iconbtn" aria-label={`More actions for ${v.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((o) => !o)}>⋯</button>
          {menu && (
            <div className="v4-menu-list" role="menu">
              <button role="menuitem" type="button" onClick={() => { setMenu(false); setName(v.name); setCoName(v.company); setMode("edit"); }}>Rename or move</button>
              {cloud && v.shareToken && (
                <button role="menuitem" type="button" onClick={() => { setMenu(false); void unshare(v.id); setNote("Share link turned off"); }}>Turn off share link</button>
              )}
              <button role="menuitem" type="button" className="danger" onClick={() => { setMenu(false); setMode("delete"); }}>Delete</button>
            </div>
          )}
        </div>
      </div>

      <div className="v4-vc-preview" aria-hidden>
        <V4Paper cv={v.cv} templateId={v.template} maxHeight={200} inert />
      </div>

      {mode === "edit" ? (
        <form className="v4-vc-form" onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}>
          <label><span>Version name</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus spellCheck={false} /></label>
          <label><span>Company</span><input value={coName} onChange={(e) => setCoName(e.target.value)} spellCheck={false} /></label>
          <div className="v4-vc-actions two"><Button variant="ghost" onClick={() => setMode("view")}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      ) : mode === "delete" ? (
        <div className="v4-vc-form">
          <p>Delete &ldquo;{v.name}&rdquo;? This can&rsquo;t be undone.</p>
          <div className="v4-vc-actions two"><Button variant="ghost" onClick={() => setMode("view")}>Keep it</Button><Button className="danger" onClick={() => void remove(v.id)}>Delete</Button></div>
        </div>
      ) : (
        <>
          <div className="v4-vc-body">
            <b>{v.name}</b>
            <span>{templateName(v.template)} · edited {timeAgo(v.updatedAt)}</span>
            <ul className="v4-tags" aria-label="Status">
              {tags.map((t) => <li key={t.tone} className={`v4-tag ${t.tone}`}>{t.label}</li>)}
            </ul>
          </div>
          <div className="v4-vc-actions">
            <Button variant="ghost" onClick={() => void duplicate(v.id)}>Duplicate</Button>
            <Button variant="ghost" onClick={() => void onShare()} disabled={!cloud || busy} title={cloud ? undefined : "Sign in to share your CV as a link"}>
              {v.shareToken ? "Copy link" : "Share link"}
            </Button>
            <Button className="v4-vc-open" onClick={() => void onOpen()} disabled={busy}>Open in Studio</Button>
          </div>
          <p className="v4-vc-note" role="status">{note}</p>
        </>
      )}
    </article>
  );
}
