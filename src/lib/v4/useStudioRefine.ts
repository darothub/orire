"use client";

import { useState } from "react";
import { authorizeRefineRun } from "@/app/actions/refine";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { parseModelJSON, factGround } from "@/lib/ai/guardrails";
import { diffCv, applyReviewed, type CvChange } from "@/lib/ai/cvDiff";
import type { CVData } from "@/lib/cv/schema";
import { useCVStore } from "@/lib/store/cvStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useTargetStore } from "@/lib/store/targetStore";

interface Review {
  before: CVData;
  after: CVData;
  changes: CvChange[];
}

/**
 * Refine from the studio: a full-CV, job-tailored rewrite shown as changes the
 * user accepts or skips. Same metered flow as the Copilot: authorizeRefineRun
 * spends one refine and mints the run token /api/ai/refine requires, and the
 * result is fact-grounded and diffed against the CV as it was when Refine ran.
 */
export function useStudioRefine() {
  const jd = useTargetStore((s) => s.jd);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const [running, setRunning] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState("");

  const hasJob = jd.trim().length > 0;

  async function run() {
    const before = useCVStore.getState().cv;
    setRunning(true);
    setMessage("");
    setReview(null);
    setSkipped(new Set());
    try {
      const { provider, models } = useSettingsStore.getState();
      const model = models[provider] ?? "";
      const authz = await authorizeRefineRun([{ provider, model }]);
      if (!authz.ok || !authz.token) {
        setMessage(authz.block ? `${authz.block.title}: ${authz.block.body}` : "Refine isn’t available on your plan.");
        return;
      }
      const response = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, jobDescription: jd, cv: before, runToken: authz.token, facts: [] }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!data?.ok || !data.raw) {
        setMessage(typeof data?.error?.message === "string" ? data.error.message : "Couldn’t refine the CV. Try again in a moment.");
        return;
      }
      const after = factGround(before, applyRefinePatch(before, parseModelJSON(data.raw))).cv;
      const changes = diffCv(before, after);
      if (changes.length === 0) setMessage("Your CV already reads well for this role. Refine suggested no changes.");
      else setReview({ before, after, changes });
    } catch {
      setMessage("Couldn’t run Refine. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  }

  function toggle(id: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function apply() {
    if (!review) return;
    applyRefinedCV(applyReviewed(review.before, review.after, new Set(skipped)));
    setMessage(`Applied ${review.changes.length - skipped.size} of ${review.changes.length} changes.`);
    setReview(null);
  }

  function acceptAll() {
    setSkipped(new Set());
  }

  function dismiss() {
    setReview(null);
    setSkipped(new Set());
  }

  return { hasJob, running, review, skipped, message, run, toggle, acceptAll, apply, dismiss };
}
