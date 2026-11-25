"use client";

import { useEffect, useState } from "react";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { useViewStore } from "@/lib/store/viewStore";
import { getTemplateInfo } from "@/lib/templates/catalog";
import { homeStats, recentVersions, tileInitial, timeAgo, recentScores } from "@/lib/home/homeStats";


/** Home dashboard: stats, recent versions and match progress. Real data only. */
export function HomeDashboard() {
  const setView = useViewStore((s) => s.setView);
  const versions = useLibraryStore((s) => s.versions);
  const activeId = useLibraryStore((s) => s.activeId);
  const activate = useLibraryStore((s) => s.activate);
  const history = useTargetStore((s) => s.history);
  const targets = useTargetStore((s) => s.saved.length + (s.ideal ? 1 : 0));

  // Relative times depend on the clock, so render them after mount to keep SSR
  // and the first client render identical.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock, not derived data
    setNow(Date.now());
  }, []);

  const stats = homeStats(versions);
  const recent = recentVersions(versions);
  const scores = recentScores(history);

  return (
    <section className="hd" aria-label="Your progress">
      <dl className="hd-stats">
        <div><dt>CV versions</dt><dd>{stats.versions}</dd></div>
        <div><dt>Tailored for a company</dt><dd>{stats.tailored}</dd></div>
        <div><dt>Target roles</dt><dd>{targets}</dd></div>
        <div><dt>Exported</dt><dd>{stats.exported}</dd></div>
      </dl>

      <div className="hd-cols">
        <div className="hd-card">
          <div className="hd-card-head">
            <h3>Recent versions</h3>
            <button type="button" className="hd-link" onClick={() => setView("history")}>Open library</button>
          </div>
          {recent.length === 0 ? (
            <p className="hd-empty">Versions you save appear here, so you can pick up any of them in one click.</p>
          ) : (
            <ul>
              {recent.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="hd-row"
                    onClick={async () => {
                      await activate(v.id);
                      setView("edit");
                    }}
                    aria-label={`Edit ${v.name}${v.company ? `, ${v.company}` : ""}`}
                  >
                    <span className="hd-tile" aria-hidden>{tileInitial(v)}</span>
                    <span className="hd-row-main">
                      <b>{v.name}</b>
                      <span>
                        {v.company || "Unfiled"} · {getTemplateInfo(v.template)?.name ?? v.template}
                        {now !== null && ` · ${timeAgo(v.updatedAt, now)}`}
                      </span>
                    </span>
                    {v.id === activeId ? (
                      <span className="hd-pill is-active">Open now</span>
                    ) : v.lastExportedAt ? (
                      <span className="hd-pill is-gold">Exported</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hd-card">
          <h3>Match progress</h3>
          <p className="hd-sub">Your match score as you edit</p>
          {scores.length < 2 ? (
            <p className="hd-empty">Simulate a role, then edit your CV. Each change adds a point here.</p>
          ) : (
            <div className="hd-bars" role="img" aria-label={`Match scores, oldest to newest: ${scores.join("%, ")}%`}>
              {scores.map((n, i) => (
                <span key={i} className={i === scores.length - 1 ? "is-now" : ""} style={{ height: `${Math.max(8, n)}%` }}>
                  <i>{n}%</i>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
