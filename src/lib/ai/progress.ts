/**
 * Estimated progress for a single, non-streaming provider request.
 *
 * There is no real percentage to read, so we show an honest estimate: stages
 * advance with elapsed time on an easing curve that approaches, but never
 * reaches, 100%. The caller reaches 100% only when the response has arrived.
 */

export interface ProgressStage {
  /** The stage ends once the percentage reaches this value. */
  upTo: number;
  label: string;
}

export interface ProgressProfile {
  stages: readonly ProgressStage[];
  /** The estimate never goes past this. */
  cap: number;
  /** Larger is slower to fill. Roughly a third of the typical wait. */
  timeConstantMs: number;
  /** Past this, the UI says the request is taking longer than usual. */
  slowAfterMs: number;
}

export interface Progress {
  percent: number;
  label: string;
  slow: boolean;
}

export function progressAt(profile: ProgressProfile, elapsedMs: number): Progress {
  const t = Math.max(0, elapsedMs);
  const percent = Math.min(profile.cap, Math.round(profile.cap * (1 - Math.exp(-t / profile.timeConstantMs))));
  const stage = profile.stages.find((s) => percent < s.upTo) ?? profile.stages[profile.stages.length - 1];
  return { percent, label: stage.label, slow: t >= profile.slowAfterMs };
}
