"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/occ/applicationSave";
import { homeNext, pipelineCounts, weeklyActivity, type HomeAction } from "@/lib/home/v4";
import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { persistView, type WorkspaceView } from "@/lib/store/viewStore";
import { useTargetMatch } from "@/components/home/MatchRing";
import { getTemplateInfo } from "@/lib/templates/catalog";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MatchRing } from "@/components/ui/MatchRing";
import { Pill } from "@/components/ui/Pill";
import "./v4.css";

type App = { id: string; company: string; role: string; status: ApplicationStatus; updatedAt: string };

/** Where each recommended action lives: the Copilot (v4) or the CV studio. */
const ACTION_TARGET: Record<HomeAction, { href: "/occ/v4" | "/"; view?: WorkspaceView }> = {
  context: { href: "/", view: "create" },
  match: { href: "/occ/v4" },
  refine: { href: "/occ/v4" },
  applications: { href: "/occ/v4" },
  export: { href: "/", view: "export" },
};

function greeting(now: number | null): string {
  if (now === null) return "Welcome back";
  const h = new Date(now).getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * Orire v4 Home — a standalone page (separate from the /occ/v4 conversation).
 * One recommended next step, where your CV and target role stand, and the
 * application pipeline. Account data comes from the routes the Copilot uses;
 * CV and target come from the same stores the studio uses.
 */
export function V4Home() {
  const router = useRouter();
  const started = useCVStore((s) => s.started);
  const fullName = useCVStore((s) => s.cv.basics.fullName);
  const templateId = useCVStore((s) => s.activeTemplate);
  const hasTarget = useTargetStore((s) => !!s.ideal);
  const { score, label } = useTargetMatch();

  const [apps, setApps] = useState<App[] | null>(null);
  const [versions, setVersions] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  // Stores hydrate from localStorage and the clock is client-only, so anything
  // derived from them renders after mount to keep SSR and first paint identical.
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

  const ready = now !== null;
  const list = apps ?? [];
  const counts = pipelineCounts(list);
  const next = homeNext({ hasCv: ready && started, hasJd: ready && hasTarget, match: ready ? score : null, applications: list.length });
  const pipeline = list.filter((a) => a.status !== "offer").slice(0, 5);
  const activity = ready ? weeklyActivity(list.map((a) => a.updatedAt), now) : [];
  const peak = Math.max(1, ...activity);
  const stat = (n: number | null) => (n === null ? "–" : n);

  function open(view: WorkspaceView) {
    persistView(view);
    router.push("/");
  }
  function runNext() {
    const t = ACTION_TARGET[next.action];
    if (t.view) persistView(t.view);
    router.push(t.href);
  }

  return (
    <div className="v4">
      <aside className="v4-side">
        <Link href="/v4" className="v4-brand" aria-label="Orire home">
          <BrandMark size={28} />
          <span><b>Orire</b><small>v4</small></span>
        </Link>
        <nav className="v4-nav" aria-label="Orire">
          <Link href="/v4" className="v4-navitem on" aria-current="page">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" /></svg>
            Home
          </Link>
          <Link href="/occ/v4" className="v4-navitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            Copilot
          </Link>
          <Link href="/" className="v4-navitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
            CV Studio
          </Link>
        </nav>
      </aside>

      <main className="v4-main" aria-label="Home">
        <div className="v4-scroll">
          <header className="v4-head">
            <h1>{greeting(now)}.</h1>
            <p>Here is where your job search stands, and the best next step.</p>
          </header>

          <div className="v4-hero">
            <section className="v4-next" aria-label="Recommended next">
              <span className="v4-eyebrow">Recommended next</span>
              <h2>{next.title}</h2>
              <p>{next.body}</p>
              <div><Button variant="gold" onClick={runNext}>{next.cta}</Button></div>
            </section>
            <Card className="v4-ring" pad>
              {ready && score !== null ? (
                <>
                  <MatchRing value={score} tone="gold" size={132} />
                  <div>
                    <b>Best current match</b>
                    <span>{label}</span>
                  </div>
                </>
              ) : (
                <p className="v4-ring-empty">No target role yet. Simulate one to see your match here.</p>
              )}
            </Card>
          </div>

          <Card className="v4-cv" pad aria-label="Your CV">
            {ready && started ? (
              <>
                <div className="v4-cv-meta">
                  <small>Your CV</small>
                  <b>{fullName.trim() || "Untitled CV"}</b>
                  <span>Template: {getTemplateInfo(templateId)?.name ?? templateId}</span>
                </div>
                <div className="v4-cv-actions">
                  <Button variant="primary" size="sm" onClick={() => open("edit")}>Edit CV</Button>
                  <Button variant="ghost" size="sm" onClick={() => open("rebrand")}>Change template</Button>
                  <Button variant="ghost" size="sm" onClick={() => open("export")}>Export</Button>
                </div>
              </>
            ) : (
              <>
                <div className="v4-cv-meta">
                  <small>Your CV</small>
                  <b>No CV yet</b>
                  <span>Create or import one to review, refine, restyle and export it.</span>
                </div>
                <div className="v4-cv-actions">
                  <Button variant="primary" size="sm" onClick={() => open("create")}>Create your CV</Button>
                </div>
              </>
            )}
          </Card>

          <dl className="v4-stats">
            <div><dt>Active applications</dt><dd>{stat(apps === null ? null : counts.active)}</dd></div>
            <div><dt>Interviews</dt><dd>{stat(apps === null ? null : counts.interview)}</dd></div>
            <div><dt>Offers</dt><dd>{stat(apps === null ? null : counts.offer)}</dd></div>
            <div><dt>Saved CV versions</dt><dd>{stat(versions)}</dd></div>
          </dl>

          {failed && <p className="v4-err" role="status">Couldn&rsquo;t load some of your account data. Reload to try again.</p>}

          <div className="v4-cols">
            <Card pad className="v4-pipeline">
              <div className="v4-cardhead">
                <h2>Active pipeline</h2>
                <Link href="/occ/v4" className="v4-link">Open Applications</Link>
              </div>
              {apps === null ? (
                <p className="v4-empty">Loading your applications…</p>
              ) : pipeline.length === 0 ? (
                <p className="v4-empty">Nothing in play yet. Add the roles you&rsquo;re applying for in the Copilot and they show up here.</p>
              ) : (
                <ul>
                  {pipeline.map((a) => (
                    <li key={a.id}>
                      <span className="v4-tile" aria-hidden>{(a.company[0] ?? "?").toUpperCase()}</span>
                      <span className="v4-row-main">
                        <b>{a.company}</b>
                        <span>{a.role || "Role not set"}</span>
                      </span>
                      <Pill tone={a.status}>{APPLICATION_STATUS_LABELS[a.status]}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card pad className="v4-momentum">
              <h2>Momentum</h2>
              <p className="v4-sub">Applications added or moved, last 6 weeks</p>
              {apps === null || list.length === 0 ? (
                <p className="v4-empty">Your weekly activity appears here once you track an application.</p>
              ) : (
                <>
                  <div className="v4-bars" role="img" aria-label={`Activity per week, oldest to newest: ${activity.join(", ")}`}>
                    {activity.map((n, i) => (
                      <span key={i} className={i === activity.length - 1 ? "is-now" : ""} style={{ height: `${Math.max(6, (n / peak) * 100)}%` }} />
                    ))}
                  </div>
                  <div className="v4-weeks" aria-hidden>
                    {activity.map((_, i) => <span key={i}>{i === activity.length - 1 ? "Now" : `W${i + 1}`}</span>)}
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
