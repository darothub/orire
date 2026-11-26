"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import type { CoachFlag } from "@/lib/cv/coach";
import type { BulletReview } from "@/lib/ai/bulletReview";
import { allowContextualBulletReview } from "@/lib/plan/plan";
import { usePlanStore } from "@/lib/store/planStore";
import { useUIStore } from "@/lib/store/uiStore";

/**
 * The "Improve" action on a bullet: asks the server for a contextual AI review
 * (spelling, grammar, impact in a full sentence). Signed-out users are sent to
 * sign up, and plans without contextual review get `onUpgrade` called (each
 * screen decides where "see plans" goes).
 */
export function useBulletReview({ value, flags, onUpgrade }: { value: string; flags: CoachFlag[]; onUpgrade: () => void }) {
  const plan = usePlanStore((s) => s.plan);
  const { status } = useSession();
  const openAuth = useUIStore((s) => s.openAuth);
  const canAiReview = allowContextualBulletReview(plan);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<BulletReview | null>(null);
  const [err, setErr] = useState("");

  async function improve() {
    if (status === "unauthenticated") {
      openAuth("signup", null, "Sign up to review bullets with AI");
      return;
    }
    if (!canAiReview) {
      setErr("AI bullet review (spelling, grammar, impact in context) is on Pro and Career.");
      onUpgrade();
      return;
    }
    setBusy(true);
    setErr("");
    setReview(null);
    try {
      const res = await fetch("/api/ai/bullet-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value, advice: flags.map((f) => ({ label: f.label, hint: f.hint })) }),
      });
      const data = (await res.json()) as { ok: boolean; review?: BulletReview; error?: string };
      if (data.ok && data.review) setReview(data.review);
      else setErr(data.error || "Couldn’t review this bullet.");
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return { busy, review, err, canAiReview, improve, clearReview: () => setReview(null) };
}
