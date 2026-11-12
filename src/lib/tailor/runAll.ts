/**
 * orire — Tailor "Run all" (ADR 0002, phase 4).
 *
 * A guided pass over the three tools: diagnose, coach, refine, then re-score.
 * It only sequences the tools; each one still runs, meters and asks for
 * approval on its own. A skipped step costs nothing, and a capped step stops
 * the run while keeping everything already accepted.
 */
import type { Metric, PlanId } from "@/lib/plan/plan";

export type RunStep = "simulate" | "coach" | "refine";
export type StepStatus = "pending" | "done" | "skipped" | "capped";

export const RUN_STEPS: { step: RunStep; label: string; metric: Metric; view: "target" | "coach" | "refine" }[] = [
  { step: "simulate", label: "Diagnose", metric: "simulate", view: "target" },
  { step: "coach", label: "Coach", metric: "coach", view: "coach" },
  { step: "refine", label: "Rewrite", metric: "refine", view: "refine" },
];

export interface RunAllState {
  statuses: Record<RunStep, StepStatus>;
  /** Keyword score when the run started; compared with the score at the end. */
  before: number;
  after: number | null;
}

export const allowRunAll = (plan: PlanId) => plan !== "free";

export function startRun(before: number): RunAllState {
  return { statuses: { simulate: "pending", coach: "pending", refine: "pending" }, before, after: null };
}

export function currentStep(s: RunAllState): RunStep | null {
  return RUN_STEPS.find((x) => s.statuses[x.step] === "pending")?.step ?? null;
}

export const isFinished = (s: RunAllState) => currentStep(s) === null;

export function markStep(s: RunAllState, step: RunStep, status: Exclude<StepStatus, "pending">): RunAllState {
  return { ...s, statuses: { ...s.statuses, [step]: status } };
}

/** A capped step stops the run: every later pending step is skipped, nothing is undone. */
export function stopAtCap(s: RunAllState, step: RunStep): RunAllState {
  const statuses = { ...s.statuses, [step]: "capped" as const };
  for (const x of RUN_STEPS) if (statuses[x.step] === "pending") statuses[x.step] = "skipped";
  return { ...s, statuses };
}

export function finishRun(s: RunAllState, after: number): RunAllState {
  return { ...s, after };
}
