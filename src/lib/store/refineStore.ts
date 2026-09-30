"use client";

import { create } from "zustand";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useCVStore } from "@/lib/store/cvStore";
import { PROVIDERS, needsKey, isCLI, type ProviderId } from "@/lib/ai/types";
import { authorizeRefineRun } from "@/app/actions/refine";
import type { RefineResponse } from "@/lib/ai/types";
import { parseModelJSON, factGround, RefineParseError, type GroundingResult } from "@/lib/ai/guardrails";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { jdMatch, type JDMatch } from "@/lib/ai/jdmatch";
import { coerceSimulatedCV } from "@/lib/ai/simulate";
import { parseVerdict, type JudgeVerdict } from "@/lib/ai/judge";
import type { CVData } from "@/lib/cv/schema";

/** The four steps of the Refine module, in order. */
export type RefineStep = "connect" | "sources" | "job" | "run";
export const REFINE_STEPS: { key: RefineStep; label: string }[] = [
  { key: "connect", label: "Connect" },
  { key: "sources", label: "Sources" },
  { key: "job", label: "Job" },
  { key: "run", label: "Compare" },
];

export type ColPhase = "idle" | "nokey" | "running" | "error" | "done";
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
  jd: string;
  started: boolean;
  cols: Record<ProviderId, ColState>;

  /** JD match of the ORIGINAL CV (before any refine), computed once per run. */
  baseMatch: JDMatch | null;
  /** Snapshot of the ORIGINAL CV at run time, for vs-ideal baseline gap. */
  baseCV: CVData | null;

  judgeProvider: ProviderId;
  judgePhase: JudgePhase;
  verdict: JudgeVerdict | null;
  judgeErr: ColError | null;

  /** Simulated "ideal candidate" gap analysis (req 20), surfaced inside Refine. */
  idealPhase: IdealPhase;
  ideal: CVData | null;
  idealErr: ColError | null;

  /** Plan-level block (cap reached / compare not allowed) shown as a banner. */
  planBlock: ColError | null;

  setStep: (s: RefineStep) => void;
  toggleRunProvider: (p: ProviderId) => void;
  setJd: (jd: string) => void;
  setJudgeProvider: (p: ProviderId) => void;

  runAll: () => Promise<void>;
  runJudge: () => Promise<void>;
  runSimulate: () => Promise<void>;
  resetRun: () => void;
  /** Reset only the judge verdict so a different judge can be picked while the
   *  comparison results (cols) stay on screen. */
  resetJudge: () => void;
  reset: () => void;
}

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
/** A provider is runnable when it's a CLI (local login) or has a BYO key set. */
function providerReady(p: ProviderId, keys: Record<ProviderId, string>): boolean {
  return needsKey(p) ? Boolean(keys[p]?.trim()) : true;
}
const idleCols = (): Record<ProviderId, ColState> =>
  Object.fromEntries(PROVIDER_IDS.map((p) => [p, { phase: "idle" as ColPhase }])) as Record<ProviderId, ColState>;

export const useRefineStore = create<RefineState>((set, get) => ({
  step: "connect",
  runProviders: [],
  jd: "",
  started: false,
  cols: idleCols(),

  baseMatch: null,
  baseCV: null,

  judgeProvider: "openai",
  judgePhase: "idle",
  verdict: null,
  judgeErr: null,

  idealPhase: "idle",
  ideal: null,
  idealErr: null,

  planBlock: null,

  setStep: (step) => set({ step }),
  toggleRunProvider: (p) =>
    set((s) => ({
      runProviders: s.runProviders.includes(p)
        ? s.runProviders.filter((x) => x !== p)
        : [...s.runProviders, p],
    })),
  setJd: (jd) => set({ jd }),
  setJudgeProvider: (judgeProvider) => set({ judgeProvider }),

  runAll: async () => {
    const { jd, runProviders } = get();
    if (!jd.trim() || runProviders.length === 0) return;
    const { keys, models } = useSettingsStore.getState();
    const cv = useCVStore.getState().cv;

    const resetStarted = () =>
      set({
        started: true,
        planBlock: null,
        cols: idleCols(),
        baseMatch: jdMatch(cv, jd),
        baseCV: cv,
        judgePhase: "idle",
        verdict: null,
        judgeErr: null,
        idealPhase: "idle",
        ideal: null,
        idealErr: null,
      });

    // Don't spend a refine on a run where no selected assistant is usable.
    const anyReady = runProviders.some((p) => providerReady(p, keys));
    if (!anyReady) {
      resetStarted();
      for (const provider of runProviders) {
        set((s) => ({ cols: { ...s.cols, [provider]: { phase: "nokey" } } }));
      }
      return;
    }

    // ---- Server-enforced gate (Phase B1): the server checks plan + usage in
    // Postgres, consumes one refine, and returns a signed run token that
    // /api/ai/refine requires. This is the enforceable version of the gate —
    // the client can no longer unlock paid capability from devtools.
    const selections = runProviders.map((provider) => ({
      provider,
      model: models[provider] ?? "",
      hasOwnKey: isCLI(provider) ? true : Boolean(keys[provider]?.trim()),
    }));
    let authz;
    try {
      authz = await authorizeRefineRun(selections);
    } catch (e) {
      set({ planBlock: { title: "Couldn’t start run", body: e instanceof Error ? e.message : String(e) } });
      return;
    }
    // Reconcile the client mirror with server truth (signed-in users only).
    if (authz.signedIn) {
      usePlanStore.getState().syncFromServer({ plan: authz.plan, usedThisMonth: authz.usedThisMonth });
    }
    if (!authz.ok || !authz.token) {
      set({ planBlock: authz.block ?? { title: "Plan limit", body: "Not allowed on your plan." } });
      return;
    }
    const runToken = authz.token;

    resetStarted();
    // Local trial counter (anonymous only; no-op when server-authoritative).
    usePlanStore.getState().recordRefine();

    for (const provider of runProviders) {
      if (!providerReady(provider, keys)) {
        set((s) => ({ cols: { ...s.cols, [provider]: { phase: "nokey" } } }));
        continue;
      }
      set((s) => ({ cols: { ...s.cols, [provider]: { phase: "running" } } }));
      void (async () => {
        try {
          const res = await fetch("/api/ai/refine", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ provider, apiKey: keys[provider] ?? "", model: models[provider], jobDescription: jd, cv, runToken }),
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

  runJudge: async () => {
    const { cols, jd, judgeProvider } = get();
    const done = PROVIDER_IDS.filter((p) => cols[p].phase === "done" && cols[p].result);
    if (done.length < 2) return;
    const { keys, models } = useSettingsStore.getState();
    if (!providerReady(judgeProvider, keys)) {
      set({ judgePhase: "error", judgeErr: { title: "Not connected", body: `Connect ${PROVIDERS[judgeProvider].label} first.` } });
      return;
    }
    set({ judgePhase: "running", judgeErr: null, verdict: null });
    const candidates = done.map((p) => ({ id: p, label: PROVIDERS[p].label, cv: cols[p].result!.cv }));
    try {
      const res = await fetch("/api/ai/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: judgeProvider, apiKey: keys[judgeProvider] ?? "", model: models[judgeProvider], jobDescription: jd, candidates }),
      });
      const data = (await res.json()) as RefineResponse;
      if (!data.ok || !data.raw) {
        set({
          judgePhase: "error",
          judgeErr: { title: `${PROVIDERS[judgeProvider].label} error`, body: data.error?.message ?? "Unknown error.", status: data.error?.status },
        });
        return;
      }
      set({ verdict: parseVerdict(data.raw, candidates.map((c) => c.id)), judgePhase: "done" });
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      set({ judgePhase: "error", judgeErr: { title: "Could not process the verdict", body: msg } });
    }
  },

  runSimulate: async () => {
    const { jd, runProviders, judgeProvider } = get();
    if (!jd.trim()) return;
    const { keys, models } = useSettingsStore.getState();
    // Prefer a provider already used in the run; fall back to the judge provider.
    const provider =
      runProviders.find((p) => providerReady(p, keys)) ??
      (providerReady(judgeProvider, keys) ? judgeProvider : undefined);
    if (!provider) {
      set({ idealPhase: "error", idealErr: { title: "Not connected", body: "Connect an assistant to simulate the ideal candidate." } });
      return;
    }
    set({ idealPhase: "running", idealErr: null, ideal: null });
    try {
      const res = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey: keys[provider] ?? "", model: models[provider], jobDescription: jd }),
      });
      const data = (await res.json()) as RefineResponse;
      if (!data.ok || !data.raw) {
        set({
          idealPhase: "error",
          idealErr: { title: `${PROVIDERS[provider].label} error`, body: data.error?.message ?? "Unknown error.", status: data.error?.status },
        });
        return;
      }
      set({ ideal: coerceSimulatedCV(data.raw), idealPhase: "done" });
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      set({ idealPhase: "error", idealErr: { title: "Could not build the simulation", body: msg } });
    }
  },

  resetRun: () =>
    set({ started: false, planBlock: null, cols: idleCols(), baseMatch: null, baseCV: null, judgePhase: "idle", verdict: null, judgeErr: null, idealPhase: "idle", ideal: null, idealErr: null }),

  resetJudge: () => set({ judgePhase: "idle", verdict: null, judgeErr: null }),

  reset: () =>
    set({
      step: "connect",
      runProviders: [],
      jd: "",
      started: false,
      planBlock: null,
      cols: idleCols(),
      baseMatch: null,
      baseCV: null,
      judgePhase: "idle",
      verdict: null,
      judgeErr: null,
      idealPhase: "idle",
      ideal: null,
      idealErr: null,
    }),
}));
