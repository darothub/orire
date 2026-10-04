"use client";

import { create } from "zustand";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { usePooledStore } from "@/lib/store/pooledStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { sharedRun } from "@/lib/store/runStore";
import { PROVIDERS, needsKey, type ProviderId, type RefineResponse } from "@/lib/ai/types";
import { coerceCoverLetter, type CoverLetterTone } from "@/lib/ai/coverLetter";
import { RefineParseError } from "@/lib/ai/guardrails";
import type { CoverLetter } from "@/lib/cv/coverLetter";

function providerReady(p: ProviderId, keys: Record<ProviderId, string>): boolean {
  if (!needsKey(p)) return true;
  return Boolean(keys[p]?.trim()) || usePooledStore.getState().has(p);
}

export type CLPhase = "idle" | "running" | "error" | "done";
export interface CLError {
  title: string;
  body: string;
  status?: number;
}

interface CoverLetterState {
  phase: CLPhase;
  letter: CoverLetter | null;
  error: CLError | null;
  provider: ProviderId | null;
  tone: CoverLetterTone;
  setTone: (t: CoverLetterTone) => void;
  runCoverLetter: () => Promise<void>;
  reset: () => void;
}

export const useCoverLetterStore = create<CoverLetterState>((set) => ({
  phase: "idle",
  letter: null,
  error: null,
  provider: null,
  tone: "professional",

  setTone: (tone) => set({ tone }),

  runCoverLetter: async () => {
    const jd = useTargetStore.getState().jd;
    if (!jd.trim()) {
      set({ phase: "error", error: { title: "No job description", body: "Add a job description before generating a cover letter." } });
      return;
    }
    const { keys, models } = useSettingsStore.getState();
    const { runProviders, judgeProvider } = useRefineStore.getState();
    // Prefer a provider already used in the compare; fall back to the judge provider.
    const provider =
      runProviders.find((p) => providerReady(p, keys)) ??
      (providerReady(judgeProvider, keys) ? judgeProvider : undefined);
    if (!provider) {
      set({ phase: "error", error: { title: "Not connected", body: "Connect an assistant to generate a cover letter." } });
      return;
    }

    const cv = useCVStore.getState().cv;
    set({ phase: "running", error: null, provider });
    try {
      const data = await sharedRun<RefineResponse>("cover-letter", "Refine", () =>
        fetch("/api/ai/cover-letter", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider,
            apiKey: keys[provider] ?? "",
            model: models[provider],
            cv,
            jobDescription: jd,
            tone: useCoverLetterStore.getState().tone,
          }),
        }).then((r) => r.json() as Promise<RefineResponse>),
      );
      if (!data.ok || !data.raw) {
        set({
          phase: "error",
          error: { title: `${PROVIDERS[provider].label} error`, body: data.error?.message ?? "Unknown error.", status: data.error?.status },
        });
        return;
      }
      const letter = coerceCoverLetter(data.raw);
      set({ letter, phase: "done" });
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      set({ phase: "error", error: { title: "Could not build the cover letter", body: msg } });
    }
  },

  reset: () => set({ phase: "idle", letter: null, error: null, provider: null }),
}));
