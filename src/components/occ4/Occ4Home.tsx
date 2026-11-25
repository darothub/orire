"use client";

import { useEffect, useState } from "react";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/occ/applicationSave";
import { homeNext, pipelineCounts, weeklyActivity, type HomeAction } from "@/lib/occ/home";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MatchRing } from "@/components/ui/MatchRing";
import { Pill } from "@/components/ui/Pill";

type App = { id: string; company: string; role: string; status: ApplicationStatus; updatedAt: string };

interface Props {
  hasCv: boolean;
  hasJd: boolean;
  /** Keyword coverage of the working draft against the JD, or null if not checked yet. */
  coverage: number | null;
  /** Working draft summary, or null when no CV is loaded. */
  draft: { name: string; template: string } | null;
  onAction: (action: HomeAction) => void;
  onEdit: () => void;
  onTemplates: () => void;
  /** Opens the navigation drawer on narrow screens. */
  onOpenNav: () => void;
}

const PILL_TONE: Record<ApplicationStatus, "saved" | "applied" | "interview" | "offer"> = {
  saved: "saved", applied: "applied", interview: "interview", offer: "offer",
};

function greeting(now: number | null): string {
  if (now === null) return "Welcome back";
  const h = new Date(now).getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * occ4 Home — one recommended next step, where the working CV stands, and the
 * application pipeline. Applications and versions come from the same account
 * routes the Copilot uses; nothing here is stored separately.
 */
export function Occ4Home({ hasCv, hasJd, coverage, draft, onAction, onEdit, onTemplates, onOpenNav }: Props) {
  const [apps, setApps] = useState<App[] | null>(null);
  const [versions, setVersions] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  // Clock-dependent text renders after mount so SSR and first paint match.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock, not derived data
    setNow(Date.now());
    void (async () => {
      try {
        const [a, v] = await Promise.all([
          fetch("/api/occ/applications", { cache: "no-store" }),
          fetch("/api/occ/versions", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (a.ok) {
          const d = await a.json();
          setApps(Array.isArray(d.applications) ? d.applications : []);
        } else setFailed(true);
        if (v.ok) {
          const d = await v.json();
          setVersions(Array.isArray(d.documents) ? d.documents.length : 0);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const list = apps ?? [];
  const counts = pipelineCounts(list);
  const next = homeNext({ hasCv, hasJd, coverage, applications: list.length });
  const pipeline = list.filter((a) => a.status !== "offer").slice(0, 5);
  const activity = now === null ? [] : weeklyActivity(list.map((a) => a.updatedAt), now);
  const peak = Math.max(1, ...activity);
  const stat = (n: number | null) => (n === null ? "–" : n);

  return (
    <main className="occ4-main occ4-home" aria-label="Home">
      <div className="occ4-home-scroll">
        <header className="occ4-home-head">
          <button type="button" className="occ4-navtoggle" aria-label="Menu" onClick={onOpenNav}>☰</button>
          <h1>{greeting(now)}.</h1>
          <p>Here is where your job search stands, and the best next step.</p>
        </header>

        <div className="occ4-home-hero">
          <section className="occ4-home-next" aria-label="Recommended next">
            <span className="occ4-home-eyebrow">Recommended next</span>
            <h2>{next.title}</h2>
            <p>{next.body}</p>
            <div>
              <Button variant="gold" onClick={() => onAction(next.action)}>{next.cta}</Button>
            </div>
          </section>
          <Card className="occ4-home-ring" pad>
            {coverage === null ? (
              <p className="occ4-home-ring-empty">No keyword check yet. Add a CV and a job description, then check coverage.</p>
            ) : (
              <>
                <MatchRing value={coverage} tone="gold" size={132} label="coverage" />
                <div>
                  <b>Keyword coverage</b>
                  <span>How much of the role&rsquo;s wording your CV uses. A check, not a hiring score.</span>
                </div>
              </>
            )}
          </Card>
        </div>

        <Card className="occ4-home-cv" pad aria-label="Your CV">
          {draft ? (
            <>
              <div className="occ4-home-cv-meta">
                <small>Working CV</small>
                <b>{draft.name || "Untitled CV"}</b>
                <span>Template: {draft.template}</span>
              </div>
              <div className="occ4-home-cv-actions">
                <Button variant="primary" size="sm" onClick={onEdit}>Edit CV</Button>
                <Button variant="ghost" size="sm" onClick={onTemplates}>Change template</Button>
                <Button variant="ghost" size="sm" onClick={() => onAction("export")}>Export</Button>
              </div>
            </>
          ) : (
            <>
              <div className="occ4-home-cv-meta">
                <small>Working CV</small>
                <b>No CV loaded yet</b>
                <span>Add yours to review, refine, restyle and export it here.</span>
              </div>
              <div className="occ4-home-cv-actions">
                <Button variant="primary" size="sm" onClick={() => onAction("context")}>Add CV &amp; JD</Button>
              </div>
            </>
          )}
        </Card>

        <dl className="occ4-home-stats">
          <div><dt>Active applications</dt><dd>{stat(apps === null ? null : counts.active)}</dd></div>
          <div><dt>Interviews</dt><dd>{stat(apps === null ? null : counts.interview)}</dd></div>
          <div><dt>Offers</dt><dd>{stat(apps === null ? null : counts.offer)}</dd></div>
          <div><dt>Saved CV versions</dt><dd>{stat(versions)}</dd></div>
        </dl>

        {failed && <p className="occ4-home-err" role="status">Couldn&rsquo;t load some of your account data. Reload to try again.</p>}

        <div className="occ4-home-cols">
          <Card pad className="occ4-home-pipeline">
            <div className="occ4-home-cardhead">
              <h2>Active pipeline</h2>
              <button type="button" className="occ4-home-link" onClick={() => onAction("applications")}>Open Applications</button>
            </div>
            {apps === null ? (
              <p className="occ4-home-empty">Loading your applications…</p>
            ) : pipeline.length === 0 ? (
              <p className="occ4-home-empty">Nothing in play yet. Add the roles you&rsquo;re applying for and they show up here.</p>
            ) : (
              <ul>
                {pipeline.map((a) => (
                  <li key={a.id}>
                    <span className="occ4-home-tile" aria-hidden>{(a.company[0] ?? "?").toUpperCase()}</span>
                    <span className="occ4-home-row-main">
                      <b>{a.company}</b>
                      <span>{a.role || "Role not set"}</span>
                    </span>
                    <Pill tone={PILL_TONE[a.status]}>{APPLICATION_STATUS_LABELS[a.status]}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card pad className="occ4-home-momentum">
            <h2>Momentum</h2>
            <p className="occ4-home-sub">Applications added or moved, last 6 weeks</p>
            {apps === null || list.length === 0 ? (
              <p className="occ4-home-empty">Your weekly activity appears here once you track an application.</p>
            ) : (
              <>
                <div className="occ4-home-bars" role="img" aria-label={`Activity per week, oldest to newest: ${activity.join(", ")}`}>
                  {activity.map((n, i) => (
                    <span key={i} className={i === activity.length - 1 ? "is-now" : ""} style={{ height: `${Math.max(6, (n / peak) * 100)}%` }} />
                  ))}
                </div>
                <div className="occ4-home-weeks" aria-hidden>
                  {activity.map((_, i) => <span key={i}>{i === activity.length - 1 ? "Now" : `W${i + 1}`}</span>)}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
