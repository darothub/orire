"use client";

import { useState } from "react";
import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { sharedRun, useIsRunning, useRunOrigin, useRunStore } from "@/lib/store/runStore";
import { remainingNote } from "@/lib/plan/plan";
import { coerceSimulatedCV, targetMatch } from "@/lib/ai/simulate";
import { RefineParseError } from "@/lib/ai/guardrails";
import { PROVIDERS, type RefineResponse } from "@/lib/ai/types";

export interface RunError {
  title: string;
  body: string;
  status?: number;
}

/**
 * Building the ideal candidate for the shared job description. One
 * implementation for every Simulate screen: the request is de-duplicated across
 * screens (`sharedRun`), the new target is locked against the live working CV,
 * and the usage mirror is refreshed so remaining simulations show up.
 */
export function useSimulateRun(origin: string) {
  const jd = useTargetStore((s) => s.jd);
  const setTarget = useTargetStore((s) => s.setTarget);
  const provider = useSettingsStore((s) => s.provider);
  const models = useSettingsStore((s) => s.models);
  const [phase, setPhase] = useState<"input" | "running" | "error">("input");
  const [err, setErr] = useState<RunError | null>(null);
  const [usageNote, setUsageNote] = useState<string | null>(null);
  const busy = useIsRunning("simulate");
  const startedBy = useRunOrigin("simulate");
  const startedAt = useRunStore((s) => s.active["simulate"]?.startedAt);

  const running = phase === "running" || busy;

  /** Resolves true when a new target was locked. `label` names it (else derived from the role). */
  async function generate(label?: string): Promise<boolean> {
    if (!jd.trim()) return false;
    setPhase("running");
    setErr(null);
    try {
      const data = await sharedRun<RefineResponse>("simulate", origin, () =>
        fetch("/api/ai/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider, model: models[provider], jobDescription: jd }),
        }).then((r) => r.json() as Promise<RefineResponse>),
      );
      if (!data.ok || !data.raw) {
        setErr({ title: `${PROVIDERS[provider].label} error`, body: data.error?.message ?? "Unknown error.", status: data.error?.status });
        setPhase("error");
        return false;
      }
      const built = coerceSimulatedCV(data.raw);
      // Baseline and chips use the CV as it is now (edits + applied refine),
      // not a snapshot from when the screen mounted.
      const working = useCVStore.getState().cv;
      const locked = targetMatch(working, built, jd);
      setTarget(built, jd, locked.score, label);
      useCVStore.getState().setSkillSuggestions(locked.gap.missingSkills, built.skills);
      setPhase("input");
      void useUsageStore.getState().refresh().then(() => {
        const u = useUsageStore.getState().summary;
        if (u) setUsageNote(remainingNote("simulate", u.metrics.simulate.cap, u.metrics.simulate.used) || null);
      });
      return true;
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      setErr({ title: "Could not build the simulation", body: msg });
      setPhase("error");
      return false;
    }
  }

  return {
    phase,
    err,
    usageNote,
    running,
    /** Another screen started the run we are waiting on. */
    busyElsewhere: busy && phase !== "running",
    startedBy,
    startedAt,
    generate,
    backToInput: () => setPhase("input"),
  };
}
