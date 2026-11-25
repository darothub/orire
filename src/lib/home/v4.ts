import type { ApplicationStatus } from "@/lib/occ/applicationSave";

export type HomeAction = "context" | "match" | "refine" | "applications" | "export";

export interface HomeNext {
  title: string;
  body: string;
  cta: string;
  action: HomeAction;
}

/** Below this match, Refine is the next best step. */
export const REFINE_BELOW = 80;

/**
 * The single best next step, from signals the app really has: whether a CV is
 * started, whether a target role is locked and how well the CV matches it, and
 * how many applications are tracked. One recommendation, not a grid, so Home
 * always leads with one clear action.
 */
export function homeNext(s: {
  hasCv: boolean;
  hasJd: boolean;
  match: number | null;
  applications: number;
}): HomeNext {
  if (!s.hasCv || !s.hasJd) {
    const what = !s.hasCv && !s.hasJd ? "your CV and a job description" : !s.hasCv ? "your CV" : "a job description";
    return {
      title: "Start with the role you want",
      body: `Add ${what}. Everything else on Orire works from those two things.`,
      cta: "Get started",
      action: "context",
    };
  }
  if (s.match === null) {
    return {
      title: "See how well you match the role",
      body: "Simulate the ideal candidate for the job and see exactly where your CV falls short.",
      cta: "Simulate a role",
      action: "match",
    };
  }
  if (s.match < REFINE_BELOW) {
    return {
      title: "Close the gaps",
      body: `Your CV matches ${s.match}% of this role. Refine rewrites it in the role's voice, and you accept or reject every change.`,
      cta: "Refine for the role",
      action: "refine",
    };
  }
  if (s.applications === 0) {
    return {
      title: "Track your first application",
      body: "Your CV matches the role well. Save where you're applying so you can see your pipeline at a glance.",
      cta: "Open Applications",
      action: "applications",
    };
  }
  return {
    title: "Send it",
    body: "Your CV matches this role well. Export it as PDF or Word and apply.",
    cta: "Export your CV",
    action: "export",
  };
}

export interface HomeApp {
  status: ApplicationStatus;
  updatedAt: string;
}

export interface PipelineCounts {
  active: number;
  interview: number;
  offer: number;
}

/** Active = anything still in play (Saved, Applied, Interview). */
export function pipelineCounts(apps: readonly HomeApp[]): PipelineCounts {
  return {
    active: apps.filter((a) => a.status !== "offer").length,
    interview: apps.filter((a) => a.status === "interview").length,
    offer: apps.filter((a) => a.status === "offer").length,
  };
}

const WEEK = 7 * 24 * 3600 * 1000;

/** Applications touched per week for the last `weeks` weeks, oldest first. */
export function weeklyActivity(updated: readonly string[], now: number, weeks = 6): number[] {
  const out = Array<number>(weeks).fill(0);
  for (const iso of updated) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t) || t > now) continue;
    const ago = Math.floor((now - t) / WEEK);
    if (ago < weeks) out[weeks - 1 - ago] += 1;
  }
  return out;
}
