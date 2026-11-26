"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCVStore } from "@/lib/store/cvStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { sharedRun } from "@/lib/store/runStore";
import { analyzeTone, type ToneLabel, type ToneProfile } from "@/lib/ai/retone";
import { targetMatch } from "@/lib/ai/simulate";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { factGround, parseModelJSON, scoreGrounding, RefineParseError } from "@/lib/ai/guardrails";
import { cvContentSig } from "@/lib/ai/judge";
import { PROVIDERS, type RefineResponse } from "@/lib/ai/types";
import type { CVData } from "@/lib/cv/schema";
import type { RunError } from "@/lib/ai/useSimulateRun";

export const TONE_OPTIONS: ToneLabel[] = ["Executive", "Technical", "Balanced"];

type Phase = "idle" | "running" | "error" | "preview";

/**
 * "Rewrite in the target's tone": a voice-only rewrite of the working CV, shown
 * as a preview the person applies or discards. Facts stay theirs (factGround),
 * and a preview built from an older CV is dropped when the CV changes.
 */
export function useRetone(ideal: CVData | null, jd: string, origin: string) {
  const cv = useCVStore((s) => s.cv);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const provider = useSettingsStore((s) => s.provider);
  const models = useSettingsStore((s) => s.models);
  const detected = useMemo<ToneProfile | null>(() => (ideal ? analyzeTone(ideal) : null), [ideal]);
  const [toneLabel, setToneLabel] = useState<ToneLabel | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<RunError | null>(null);
  const [preview, setPreview] = useState<{ cv: CVData; warnings: string[] } | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  /** Working-CV fingerprint the open preview was built from. */
  const baseSig = useRef<string | null>(null);
  const cvSig = useMemo(() => cvContentSig(cv), [cv]);
  const activeTone: ToneLabel = toneLabel ?? detected?.label ?? "Balanced";

  function discard() {
    baseSig.current = null;
    setPreview(null);
    setPhase("idle");
    setShowBefore(false);
    setErr(null);
  }

  // Drop a stale preview when the working CV changes (edit or applied refine).
  useEffect(() => {
    if (!preview || !baseSig.current || baseSig.current === cvSig) return;
    baseSig.current = null;
    setPreview(null);
    setPhase("idle");
    setShowBefore(false);
  }, [cvSig, preview]);

  async function run() {
    if (!detected) return;
    setPhase("running");
    setErr(null);
    setPreview(null);
    baseSig.current = null;
    setShowBefore(false);
    const tone: ToneProfile = { ...detected, label: activeTone };
    // The latest working CV at request time (post-refine/edit).
    const source = useCVStore.getState().cv;
    const sourceSig = cvContentSig(source);
    try {
      const data = await sharedRun<RefineResponse>("retone", origin, () =>
        fetch("/api/ai/retone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider, model: models[provider], cv: source, tone }),
        }).then((r) => r.json() as Promise<RefineResponse>),
      );
      if (!data.ok || !data.raw) {
        setErr({ title: `${PROVIDERS[provider].label} error`, body: data.error?.message ?? "Unknown error.", status: data.error?.status });
        setPhase("error");
        return;
      }
      // Never ground or apply against a CV that changed while this ran.
      if (cvContentSig(useCVStore.getState().cv) !== sourceSig) {
        setErr({ title: "CV changed during rewrite", body: "Your CV was updated (edit or applied refine) while the rewrite ran. Run rewrite again on the latest version." });
        setPhase("error");
        return;
      }
      // Voice only: drop any title/role the model emitted so headlines stay as written.
      const patch = parseModelJSON(data.raw) as Record<string, unknown>;
      delete patch.title;
      for (const key of ["experience", "projects"] as const) {
        const arr = patch[key];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item && typeof item === "object") delete (item as { role?: unknown }).role;
          }
        }
      }
      const grounded = factGround(source, applyRefinePatch(source, patch));
      baseSig.current = sourceSig;
      setPreview({ cv: grounded.cv, warnings: grounded.warnings });
      setPhase("preview");
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      setErr({ title: "Could not rewrite the CV", body: msg });
      setPhase("error");
    }
  }

  function apply() {
    if (!preview) return;
    applyRefinedCV(preview.cv);
    discard();
  }

  return {
    detected,
    activeTone,
    setToneLabel,
    phase,
    err,
    preview,
    showBefore,
    setShowBefore,
    run,
    apply,
    discard,
    previewMatch: preview && ideal ? targetMatch(preview.cv, ideal, jd) : null,
    fidelity: preview ? scoreGrounding({ cv: preview.cv, warnings: preview.warnings }) : null,
  };
}
