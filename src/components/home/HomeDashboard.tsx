"use client";

import { useEffect, useState } from "react";
import { useCVStore } from "@/lib/store/cvStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { useViewStore } from "@/lib/store/viewStore";
import { targetMatch } from "@/lib/ai/simulate";
import { getTemplateInfo } from "@/lib/templates/catalog";
import { homeStats, recentVersions, tileInitial, timeAgo } from "@/lib/home/homeStats";
import "./home.css";

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

function MatchRing({ score }: { score: number | null }) {
  const pct = score ?? 0;
  return (
    <div className="hd-ring" role="img" aria-label={score === null ? "No match yet" : `${score}% match`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={RING_R} className="hd-ring-track" />
        <circle
          cx="60"
          cy="60"
          r={RING_R}
          className="hd-ring-fill"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - pct / 100)}
        />
      </svg>
      <div className="hd-ring-text">
        <b>{score === null ? "–" : `${score}%`}</b>
        <span>match</span>
      </div>
    </div>
  );
}

/** Home dashboard: where you stand and what to open next. Real data only. */
export function HomeDashboard() {
  const setView = useViewStore((s) => s.setView);
  const versions = useLibraryStore((s) => s.versions);
  const activeId = useLibraryStore((s) => s.activeId);
  const activate = useLibraryStore((s) => s.activate);
  const cv = useCVStore((s) => s.cv);
  const ideal = useTargetStore((s) => s.ideal);
  const jd = useTargetStore((s) => s.jd);
  const label = useTargetStore((s) => s.label);

  // Relative times depend on the clock, so render them after mount to keep SSR
  // and the first client render identical.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock, not derived data
    setNow(Date.now());
  }, []);

  const stats = homeStats(versions);
  const recent = recentVersions(versions);
  const score = ideal ? targetMatch(cv, ideal, jd).score : null;

  return (
    <section className="hd" aria-label="Your progress">
      <div className="hd-top">
        <div className="hd-match">
          <MatchRing score={score} />
          <div>
            <h3>{score === null ? "No target role yet" : "Match with your target role"}</h3>
            <p>
              {score === null
                ? "Simulate the ideal candidate for a job and see exactly where your CV falls short."
                : label || "Target role"}
            </p>
            <button type="button" className="hd-btn" onClick={() => setView(score === null ? "tailor" : "target")}>
              {score === null ? "Simulate a role" : "Open target"}
            </button>
          </div>
        </div>
        <dl className="hd-stats">
          <div><dt>CV versions</dt><dd>{stats.versions}</dd></div>
          <div><dt>Tailored for a company</dt><dd>{stats.tailored}</dd></div>
          <div><dt>Exported</dt><dd>{stats.exported}</dd></div>
        </dl>
      </div>

      <div className="hd-recent">
        <div className="hd-recent-head">
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
    </section>
  );
}
