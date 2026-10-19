"use client";

import { create } from "zustand";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { sharedRun } from "@/lib/store/runStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { authorizeRefineRun } from "@/app/actions/refine";
import { remainingNote } from "@/lib/plan/plan";
import type { RefineResponse } from "@/lib/ai/types";
import { parseModelJSON, factGround, RefineParseError, type GroundingResult } from "@/lib/ai/guardrails";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { jdMatch, type JDMatch } from "@/lib/ai/jdmatch";
import { parseVerdict, judgeCacheKey, type JudgeVerdict } from "@/lib/ai/judge";
import { refineRunSignature } from "@/lib/ai/refineSignature";
import { analytics } from "@/lib/analytics/events";
import type { CVData } from "@/lib/cv/schema";

export { refineRunSignature };

/** The four steps of the Refine module, in order. */
export type RefineStep = "connect" | "sources" | "job" | "run";
export const REFINE_STEPS: { key: RefineStep; label: string }[] = [
  { key: "connect", label: "Connect" },
  { key: "sources", label: "Sources" },
  { key: "job", label: "Job" },
  { key: "run", label: "Compare" },
];

export type ColPhase = "idle" | "running" | "error" | "done";
export interface ColError {
  title: string;
  body: string;
  status?: number;
}
export interface ColState {
  phase: ColPhase;
  result?: GroundingResult;
  match?: JDMatch;
  error?: ColError;
  /** Set when the chosen assistant was down and a managed backup served this. */
  servedBy?: ProviderId;
  retrying?: boolean;
  retryAttempt?: number;
  retryAfterMs?: number;
}

type JudgePhase = "idle" | "running" | "error" | "done";

interface RefineState {
  step: RefineStep;
  /** Providers the user chose to run (1 = single, 2 = parallel compare). */
  runProviders: ProviderId[];
  started: boolean;
  /** Input fingerprint captured when the last comparison started. If the live
   *  inputs no longer match this, the shown results are stale (req: re-run). */
  runSig: string | null;
  /** True once the user navigated back to an earlier step after a comparison
   *  had started. Only then do we offer to re-run — a live edit on the compare
   *  screen itself never nags, and the user can always keep existing results. */
  revisited: boolean;
  cols: Record<ProviderId, ColState>;

  /** JD match of the ORIGINAL CV (before any refine), computed once per run. */
  baseMatch: JDMatch | null;
  /** Snapshot of the ORIGINAL CV at run time, for vs-ideal baseline gap. */
  baseCV: CVData | null;

  judgePhase: JudgePhase;
  verdict: JudgeVerdict | null;
  judgeErr: ColError | null;
  /** True when the current verdict was served from the determinism cache. */
  judgeFromCache: boolean;

  /** Plan-level block (cap reached / compare not allowed) shown as a banner. */
  planBlock: ColError | null;

  /** "N free refines left" note shown after a run is authorized (point 9);
   *  null for unlimited plans or anonymous/unmetered runs. */
  usageNote: string | null;

  /** Which provider's result was last applied to the CV, for an "Applied" confirmation. */
  appliedProvider: ProviderId | null;

  /** Provider whose changes are open in the review-before-apply panel (Story 2:
   *  AI-edit transparency). null = no review open; the comparison grid shows. */
  reviewProvider: ProviderId | null;

  setStep: (s: RefineStep) => void;
  toggleRunProvider: (p: ProviderId) => void;

  runAll: () => Promise<void>;
  runJudge: (force?: boolean) => Promise<void>;
  /** Record that a provider's refined CV was applied to the editor. */
  markApplied: (p: ProviderId) => void;
  /** Open / close the per-change review panel for a provider's refined CV. */
  openReview: (p: ProviderId) => void;
  closeReview: () => void;
  resetRun: () => void;
  /** Dismiss the stale-inputs prompt and keep the existing comparison as-is. */
  keepResults: () => void;
  /** Reset only the judge verdict so a different judge can be picked while the
   *  comparison results (cols) stay on screen. */
  resetJudge: () => void;
  reset: () => void;
}

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
/** Determinism cache for judge verdicts (finding #4). Keyed by a stable
 *  fingerprint of (judge provider, model, JD, canonical candidate content) so
 *  re-judging the same inputs returns the same verdict instead of re-sampling. */
const judgeCache = new Map<string, JudgeVerdict>();
const idleCols = (): Record<ProviderId, ColState> =>
  Object.fromEntries(PROVIDER_IDS.map((p) => [p, { phase: "idle" as ColPhase }])) as Record<ProviderId, ColState>;

export const useRefineStore = create<RefineState>((set, get) => ({
  step: "connect",
  runProviders: [],
  started: false,
  runSig: null,
  revisited: false,
  cols: idleCols(),

  baseMatch: null,
  baseCV: null,

  judgePhase: "idle",
  verdict: null,
  judgeErr: null,
  judgeFromCache: false,

  planBlock: null,
  usageNote: null,

  appliedProvider: null,
  reviewProvider: null,

  // Leaving the Compare step after a run started marks the session "revisited",
  // which is the only condition under which we later offer to re-run.
  setStep: (step) => set((s) => ({ step, revisited: s.revisited || (s.started && step !== "run") })),
  toggleRunProvider: (p) =>
    set((s) => ({
      runProviders: s.runProviders.includes(p)
        ? s.runProviders.filter((x) => x !== p)
        : [...s.runProviders, p],
    })),

  runAll: async () => {
    const { runProviders } = get();
    const jd = useTargetStore.getState().jd;
    if (!jd.trim() || runProviders.length === 0) return;
    const { models } = useSettingsStore.getState();
    const cv = useCVStore.getState().cv;

    const resetStarted = () =>
      set({
        started: true,
        runSig: refineRunSignature(runProviders, jd, cv),
        revisited: false,
        planBlock: null,
        cols: idleCols(),
        baseMatch: jdMatch(cv, jd),
        baseCV: cv,
        judgePhase: "idle",
        verdict: null,
        judgeErr: null,
      });

    // ---- Server-enforced gate (Phase B1): the server checks plan + usage in
    // Postgres, consumes one refine, and returns a signed run token that
    // /api/ai/refine requires. This is the enforceable version of the gate —
    // the client can no longer unlock paid capability from devtools.
    const selections = runProviders.map((provider) => ({
      provider,
      model: models[provider] ?? "",
    }));
    let authz;
    try {
      authz = await authorizeRefineRun(selections);
    } catch (e) {
      set({ planBlock: { title: "Couldn’t start run", body: e instanceof Error ? e.message : String(e) } });
      return;
    }
    // Reconcile the client mirror with server truth (signed-in users only) and
    // surface how many refines remain (point 9).
    if (authz.signedIn) {
      // Reflect the current plan immediately; the usage count + remaining note
      // are refreshed from server truth once the run settles (the refine is
      // consumed server-side only on a successful provider call).
      usePlanStore.getState().syncFromServer({ plan: authz.plan, usedThisMonth: authz.usedThisMonth });
    }
    if (!authz.ok || !authz.token) {
      set({ planBlock: authz.block ?? { title: "Plan limit", body: "Not allowed on your plan." } });
      return;
    }
    const runToken = authz.token;

    resetStarted();
    analytics.refineRun(runProviders.length, runProviders.length === 1 ? "single" : "compare");
    // Local trial counter (anonymous only; no-op when server-authoritative).
    usePlanStore.getState().recordRefine();

    const runs = runProviders.map((provider) => {
      set((s) => ({
        cols: {
          ...s.cols,
          [provider]: { phase: "running", retrying: false, retryAttempt: 0, retryAfterMs: 0 },
        },
      }));
      return (async () => {
        try {
          let attemptNumber = 0;
          while (true) {
            attemptNumber += 1;
            set((s) => ({
              cols: {
                ...s.cols,
                [provider]: {
                  ...s.cols[provider],
                  phase: "running",
                  retrying: attemptNumber > 1,
                  retryAttempt: attemptNumber,
                  retryAfterMs: 0,
                },
              },
            }));

            const res = await fetch("/api/ai/refine", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ provider, model: models[provider], jobDescription: jd, cv, runToken }),
            });
            const data = (await res.json()) as RefineResponse;

            if (data.ok && data.raw) {
              const grounded = factGround(cv, applyRefinePatch(cv, parseModelJSON(data.raw)));
              const match = jdMatch(grounded.cv, jd);
              set((s) => ({
                cols: {
                  ...s.cols,
                  [provider]: {
                    phase: "done",
                    result: grounded,
                    match,
                    servedBy: data.servedBy,
                    retrying: false,
                    retryAttempt: 0,
                    retryAfterMs: 0,
                  },
                },
              }));
              return;
            }

            const message = data.error?.message ?? "Unknown error.";
            const status = data.error?.status;
            const isBusy = status === 503 || /busy|temporar|overloaded|rate limit|try again/i.test(message);

            if (!isBusy || attemptNumber >= 3) {
              set((s) => ({
                cols: {
                  ...s.cols,
                  [provider]: {
                    phase: "error",
                    error: {
                      title: `${PROVIDERS[provider].label} error`,
                      body: message,
                      status,
                    },
                  },
                },
              }));
              return;
            }

            const delayMs = 1500 * attemptNumber;
            set((s) => ({
              cols: {
                ...s.cols,
                [provider]: {
                  ...s.cols[provider],
                  phase: "running",
                  retrying: true,
                  retryAttempt: attemptNumber,
                  retryAfterMs: delayMs,
                },
              },
            }));
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } catch (e) {
          const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
          set((s) => ({
            cols: { ...s.cols, [provider]: { phase: "error", error: { title: "Could not process the response", body: msg } } },
          }));
        }
      })();
    });

    // Once every column settles, reconcile usage from server truth: the refine
    // was consumed only if a provider actually succeeded, so this is where the
    // real "N refines left" note + feature grey-out get their numbers.
    void Promise.allSettled(runs).then(async () => {
      if (!authz.signedIn) return;
      await useUsageStore.getState().refresh();
      const u = useUsageStore.getState().summary;
      if (u) {
        usePlanStore.getState().syncFromServer({ plan: u.plan, usedThisMonth: u.metrics.refine.used });
        set({ usageNote: remainingNote("refine", u.metrics.refine.cap, u.metrics.refine.used) || null });
      }
    });
  },

  runJudge: async (force = false) => {
    const { cols } = get();
    const jd = useTargetStore.getState().jd;
    const done = PROVIDER_IDS.filter((p) => cols[p].phase === "done" && cols[p].result);
    if (done.length < 2) return;
    const candidates = done.map((p) => ({ id: p, label: PROVIDERS[p].label, cv: cols[p].result!.cv }));
    // The judge runs server-side on a fixed managed assistant (ChatGPT); its
    // identity is hidden in the UI, so the determinism cache key uses a stable
    // constant rather than a user-selected provider.
    const cacheKey = judgeCacheKey("pick-best", "", jd, candidates);

    // Deterministic re-judge: identical inputs reuse the cached verdict instead
    // of re-sampling the model (unless the caller explicitly forces a fresh run).
    if (!force) {
      const cached = judgeCache.get(cacheKey);
      if (cached) {
        set({ verdict: cached, judgePhase: "done", judgeErr: null, judgeFromCache: true });
        return;
      }
    }

    set({ judgePhase: "running", judgeErr: null, verdict: null, judgeFromCache: false });
    analytics.judgeRun("openai");
    try {
      const data = await sharedRun<RefineResponse>("judge", "Refine", () =>
        fetch("/api/ai/judge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // Provider/model are chosen server-side (hidden); sending them is
          // unnecessary, but the route ignores them regardless.
          body: JSON.stringify({ jobDescription: jd, candidates }),
        }).then((r) => r.json() as Promise<RefineResponse>),
      );
      if (!data.ok || !data.raw) {
        set({
          judgePhase: "error",
          judgeErr: { title: "Couldn’t pick the best version", body: data.error?.message ?? "Unknown error.", status: data.error?.status },
        });
        return;
      }
      const verdict = parseVerdict(data.raw, candidates.map((c) => c.id));
      judgeCache.set(cacheKey, verdict);
      set({ verdict, judgePhase: "done", judgeFromCache: false });
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      set({ judgePhase: "error", judgeErr: { title: "Could not process the verdict", body: msg } });
    }
  },

  markApplied: (p) => {
    set({ appliedProvider: p });
    useTargetStore.getState().requestResim();
  },

  openReview: (p) => set({ reviewProvider: p }),
  closeReview: () => set({ reviewProvider: null }),

  keepResults: () => set({ revisited: false }),

  resetRun: () =>
    set({ started: false, runSig: null, revisited: false, planBlock: null, usageNote: null, cols: idleCols(), baseMatch: null, baseCV: null, judgePhase: "idle", verdict: null, judgeErr: null, judgeFromCache: false, appliedProvider: null, reviewProvider: null }),

  resetJudge: () => set({ judgePhase: "idle", verdict: null, judgeErr: null, judgeFromCache: false }),

  reset: () =>
    set({
      step: "connect",
      runProviders: [],
      started: false,
      runSig: null,
      revisited: false,
      planBlock: null,
      usageNote: null,
      cols: idleCols(),
      baseMatch: null,
      baseCV: null,
      judgePhase: "idle",
      verdict: null,
      judgeErr: null,
      judgeFromCache: false,
      appliedProvider: null,
      reviewProvider: null,
    }),
}));
