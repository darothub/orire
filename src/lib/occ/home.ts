import type { ApplicationStatus } from "@/lib/occ/applicationSave";

export type HomeAction = "context" | "match" | "refine" | "applications" | "export";

export interface HomeNext {
  title: string;
  body: string;
  cta: string;
  action: HomeAction;
}

/** Below this keyword coverage, Refine is the next best step. */
export const REFINE_BELOW = 80;

/**
 * The single best next step, from signals occ4 really has: whether a CV and a
 * job description are loaded, the keyword coverage (a deterministic check, not
 * a hiring score) and how many applications are tracked. One recommendation,
 * not a grid, so Home always leads with one clear action.
 */
export function homeNext(s: {
  hasCv: boolean;
  hasJd: boolean;
  coverage: number | null;
  applications: number;
}): HomeNext {
  if (!s.hasCv || !s.hasJd) {
    const what = !s.hasCv && !s.hasJd ? "your CV and a job description" : !s.hasCv ? "your CV" : "a job description";
    return {
      title: "Start with the role you want",
      body: `Add ${what}. Everything else on Orire works from those two things.`,
      cta: "Add CV & JD",
      action: "context",
    };
  }
  if (s.coverage === null) {
    return {
      title: "See how your CV covers the role",
      body: "A quick keyword check shows which terms from the job description your CV already uses, and which are missing.",
      cta: "Check keyword coverage",
      action: "match",
    };
  }
  if (s.coverage < REFINE_BELOW) {
    return {
      title: "Close the keyword gaps",
      body: `Your CV covers ${s.coverage}% of the role's keywords. Refine rewrites it in the role's voice, and you accept or reject every change.`,
      cta: "Refine for the JD",
      action: "refine",
    };
  }
  if (s.applications === 0) {
    return {
      title: "Track your first application",
      body: "Your CV covers the role well. Save where you're applying so you can see your pipeline at a glance.",
      cta: "Open Applications",
      action: "applications",
    };
  }
  return {
    title: "Send it",
    body: "Your CV covers this role well. Export it as PDF or Word and apply.",
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
