"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { progressAt } from "@/lib/ai/progress";
import { PROGRESS, type ProgressKey } from "@/lib/v4/progressProfiles";

interface Props {
  /** Which action is running; sets the stages and the pace. */
  kind: ProgressKey;
  title: string;
  /** Lets a second view join a run that started elsewhere. */
  startedAt?: number;
  /** Only the bar and the current step, for a short wait inside a card. */
  compact?: boolean;
}

/** The "Running your simulation" loader, shared by every long-running v4 action. */
export function V4Progress({ kind, title, startedAt, compact = false }: Props) {
  const profile = PROGRESS[kind];
  const [t0] = useState(() => startedAt ?? Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(id);
  }, []);
  const { percent, label, slow } = progressAt(profile, now - t0);
  const body = (
    <>
      <h2 className="v4-h2">{title}</h2>
      <div className="v4-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={title}><span style={{ width: `${percent}%` }} /></div>
      <div className="v4-sim-pct" role="status" aria-live="polite"><span>{label}</span><span>About {percent}%</span></div>
      {!compact && (
        <ul className="v4-stages">
          {profile.stages.map((s, i) => {
            const done = percent >= s.upTo;
            return <li key={i} className={done ? "done" : ""}><i aria-hidden>{done ? "✓" : ""}</i>{s.label.replace(/…$/, "")}</li>;
          })}
        </ul>
      )}
      <p className="v4-hint">{slow ? "Still working. This is taking longer than usual." : "The percentage is an estimate. It reaches 100% when your result arrives."}</p>
    </>
  );
  return compact ? <div className="v4-progress-compact">{body}</div> : <Card pad>{body}</Card>;
}
