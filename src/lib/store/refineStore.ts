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
import { coerceSimulatedCV, targetMatch } from "@/lib/ai/simulate";
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
}

type JudgePhase = "idle" | "running" | "error" | "done";
type IdealPhase = "idle" | "running" | "error" | "done";

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

  judgeProvider: ProviderId;
  judgePhase: JudgePhase;
  verdict: JudgeVerdict | null;
  judgeErr: ColError | null;
  /** True when the current verdict was served from the determinism cache. */
  judgeFromCache: boolean;

  /** Simulated "ideal candidate" generation status (req 20), surfaced inside Refine.
   *  The generated ideal is stored in the shared targetStore, not here. */
  idealPhase: IdealPhase;
  idealErr: ColError | null;

  /** Plan-level block (cap reached / compare not allowed) shown as a banner. */
  planBlock: ColError | null;

  /** "N free refines left" note shown after a run is authorized (point 9);
   *  null for unlimited plans or anonymous/unmetered runs. */
  usageNote: string | null;

  /** Which provider's result was last applied to the CV, for an "Applied" confirmation. */
  appliedProvider: ProviderId | null;

  setStep: (s: RefineStep) => void;
  toggleRunProvider: (p: ProviderId) => void;
  setJudgeProvider: (p: ProviderId) => void;

  runAll: () => Promise<void>;
  runJudge: (force?: boolean) => Promise<void>;
  runSimulate: () => Promise<void>;
  /** Record that a provider's refined CV was applied to the editor. */
  markApplied: (p: ProviderId) => void;
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

  judgeProvider: "openai",
  judgePhase: "idle",
  verdict: null,
  judgeErr: null,
  judgeFromCache: false,

  idealPhase: "idle",
  idealErr: null,

  planBlock: null,
  usageNote: null,

  appliedProvider: null,

  // Leaving the Compare step after a run started marks the session "revisited",
  // which is the only condition under which we later offer to re-run.
  setStep: (step) => set((s) => ({ step, revisited: s.revisited || (s.started && step !== "run") })),
  toggleRunProvider: (p) =>
    set((s) => ({
      runProviders: s.runProviders.includes(p)
        ? s.runProviders.filter((x) => x !== p)
        : [...s.runProviders, p],
    })),
  setJudgeProvider: (judgeProvider) => set({ judgeProvider }),

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
        idealPhase: "idle",
        idealErr: null,
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
      usePlanStore.getState().syncFromServer({ plan: authz.plan, usedThisMonth: authz.usedThisMonth });
      // Only on an allowed run — a blocked run shows planBlock instead.
      if (authz.ok) set({ usageNote: remainingNote("refine", authz.cap, authz.usedThisMonth) || null });
      // Keep the ambient usage mirror (feature grey-out) current.
      void useUsageStore.getState().refresh();
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

    for (const provider of runProviders) {
      set((s) => ({ cols: { ...s.cols, [provider]: { phase: "running" } } }));
      void (async () => {
        try {
          const res = await fetch("/api/ai/refine", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ provider, model: models[provider], jobDescription: jd, cv, runToken }),
          });
          const data = (await res.json()) as RefineResponse;
          if (!data.ok || !data.raw) {
            set((s) => ({
              cols: {
                ...s.cols,
                [provider]: {
                  phase: "error",
                  error: {
                    title: `${PROVIDERS[provider].label} error`,
                    body: data.error?.message ?? "Unknown error.",
                    status: data.error?.status,
                  },
                },
              },
            }));
            return;
          }
          const grounded = factGround(cv, applyRefinePatch(cv, parseModelJSON(data.raw)));
          const match = jdMatch(grounded.cv, jd);
          set((s) => ({ cols: { ...s.cols, [provider]: { phase: "done", result: grounded, match } } }));
        } catch (e) {
          const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
          set((s) => ({
            cols: { ...s.cols, [provider]: { phase: "error", error: { title: "Could not process the response", body: msg } } },
          }));
        }
      })();
    }
  },

  runJudge: async (force = false) => {
    const { cols, judgeProvider } = get();
    const jd = useTargetStore.getState().jd;
    const done = PROVIDER_IDS.filter((p) => cols[p].phase === "done" && cols[p].result);
    if (done.length < 2) return;
    const { models } = useSettingsStore.getState();
    const candidates = done.map((p) => ({ id: p, label: PROVIDERS[p].label, cv: cols[p].result!.cv }));
    const cacheKey = judgeCacheKey(judgeProvider, models[judgeProvider] ?? "", jd, candidates);

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
    analytics.judgeRun(judgeProvider);
    try {
      const data = await sharedRun<RefineResponse>("judge", "Refine", () =>
        fetch("/api/ai/judge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider: judgeProvider, model: models[judgeProvider], jobDescription: jd, candidates }),
        }).then((r) => r.json() as Promise<RefineResponse>),
      );
      if (!data.ok || !data.raw) {
        set({
          judgePhase: "error",
          judgeErr: { title: `${PROVIDERS[judgeProvider].label} error`, body: data.error?.message ?? "Unknown error.", status: data.error?.status },
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

  runSimulate: async () => {
    const { runProviders, judgeProvider } = get();
    const jd = useTargetStore.getState().jd;
    if (!jd.trim()) return;
    const { models } = useSettingsStore.getState();
    // Prefer a provider already used in the run; fall back to the judge provider.
    const provider = runProviders[0] ?? judgeProvider;
    set({ idealPhase: "running", idealErr: null });
    analytics.simulateRun(provider);
    try {
      const data = await sharedRun<RefineResponse>("simulate", "Refine", () =>
        fetch("/api/ai/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider, model: models[provider], jobDescription: jd }),
        }).then((r) => r.json() as Promise<RefineResponse>),
      );
      if (!data.ok || !data.raw) {
        set({
          idealPhase: "error",
          idealErr: { title: `${PROVIDERS[provider].label} error`, body: data.error?.message ?? "Unknown error.", status: data.error?.status },
        });
        return;
      }
      const ideal = coerceSimulatedCV(data.raw);
      const userCV = useCVStore.getState().cv;
      useTargetStore.getState().setTarget(ideal, jd, targetMatch(userCV, ideal, jd).score);
      set({ idealPhase: "done" });
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      set({ idealPhase: "error", idealErr: { title: "Could not build the simulation", body: msg } });
    }
  },

  markApplied: (p) => set({ appliedProvider: p }),

  keepResults: () => set({ revisited: false }),

  resetRun: () =>
    set({ started: false, runSig: null, revisited: false, planBlock: null, usageNote: null, cols: idleCols(), baseMatch: null, baseCV: null, judgePhase: "idle", verdict: null, judgeErr: null, judgeFromCache: false, idealPhase: "idle", idealErr: null, appliedProvider: null }),

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
      idealPhase: "idle",
      idealErr: null,
      appliedProvider: null,
    }),
}));
