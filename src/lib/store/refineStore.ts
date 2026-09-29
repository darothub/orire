"use client";

import { create } from "zustand";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCVStore } from "@/lib/store/cvStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import type { RefineResponse } from "@/lib/ai/types";
import { parseModelJSON, factGround, RefineParseError, type GroundingResult } from "@/lib/ai/guardrails";
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

  setStep: (s: RefineStep) => void;
  toggleRunProvider: (p: ProviderId) => void;
  setJd: (jd: string) => void;
  setJudgeProvider: (p: ProviderId) => void;

  runAll: () => void;
  runJudge: () => Promise<void>;
  runSimulate: () => Promise<void>;
  resetRun: () => void;
  reset: () => void;
}

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
const idleCols = (): Record<ProviderId, ColState> => ({
  openai: { phase: "idle" },
  anthropic: { phase: "idle" },
});

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

  setStep: (step) => set({ step }),
  toggleRunProvider: (p) =>
    set((s) => ({
      runProviders: s.runProviders.includes(p)
        ? s.runProviders.filter((x) => x !== p)
        : [...s.runProviders, p],
    })),
  setJd: (jd) => set({ jd }),
  setJudgeProvider: (judgeProvider) => set({ judgeProvider }),

  runAll: () => {
    const { jd, runProviders } = get();
    if (!jd.trim() || runProviders.length === 0) return;
    const { keys, models } = useSettingsStore.getState();
    const cv = useCVStore.getState().cv;

    set({
      started: true,
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

    for (const provider of runProviders) {
      if (!keys[provider]?.trim()) {
        set((s) => ({ cols: { ...s.cols, [provider]: { phase: "nokey" } } }));
        continue;
      }
      set((s) => ({ cols: { ...s.cols, [provider]: { phase: "running" } } }));
      void (async () => {
        try {
          const res = await fetch("/api/ai/refine", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ provider, apiKey: keys[provider], model: models[provider], jobDescription: jd, cv }),
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
          const grounded = factGround(cv, parseModelJSON(data.raw));
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
    if (!keys[judgeProvider]?.trim()) {
      set({ judgePhase: "error", judgeErr: { title: "No API key", body: `Add your ${PROVIDERS[judgeProvider].label} key first.` } });
      return;
    }
    set({ judgePhase: "running", judgeErr: null, verdict: null });
    const candidates = done.map((p) => ({ id: p, label: PROVIDERS[p].label, cv: cols[p].result!.cv }));
    try {
      const res = await fetch("/api/ai/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: judgeProvider, apiKey: keys[judgeProvider], model: models[judgeProvider], jobDescription: jd, candidates }),
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
      runProviders.find((p) => keys[p]?.trim()) ??
      (keys[judgeProvider]?.trim() ? judgeProvider : undefined);
    if (!provider) {
      set({ idealPhase: "error", idealErr: { title: "No API key", body: "Add an API key to simulate the ideal candidate." } });
      return;
    }
    set({ idealPhase: "running", idealErr: null, ideal: null });
    try {
      const res = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey: keys[provider], model: models[provider], jobDescription: jd }),
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
    set({ started: false, cols: idleCols(), baseMatch: null, baseCV: null, judgePhase: "idle", verdict: null, judgeErr: null, idealPhase: "idle", ideal: null, idealErr: null }),

  reset: () =>
    set({
      step: "connect",
      runProviders: [],
      jd: "",
      started: false,
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
