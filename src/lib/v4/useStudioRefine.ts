"use client";

import { useState } from "react";
import { applyReviewed, type CvChange } from "@/lib/ai/cvDiff";
import type { CVData } from "@/lib/cv/schema";
import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { runRefine } from "./refineRun";

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
    const outcome = await runRefine(before, jd);
    if (outcome.kind === "changes") setReview(outcome);
    else setMessage(outcome.message);
    setRunning(false);
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
