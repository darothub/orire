"use client";

import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { targetMatch } from "@/lib/ai/simulate";

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/** Live match against the locked target role; null score when none is set. */
export function useTargetMatch(): { score: number | null; label: string; missing: string[] } {
  const cv = useCVStore((s) => s.cv);
  const ideal = useTargetStore((s) => s.ideal);
  const jd = useTargetStore((s) => s.jd);
  const label = useTargetStore((s) => s.label);
  if (!ideal) return { score: null, label: "", missing: [] };
  const m = targetMatch(cv, ideal, jd);
  return { score: m.score, label: label || "your target role", missing: m.gap.missingSkills };
}

export function MatchRing({ score }: { score: number | null }) {
  const pct = score ?? 0;
  return (
    <div className="hd-ring" role="img" aria-label={score === null ? "No match yet" : `${score}% match`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={RING_R} className="hd-ring-track" />
        <circle
          cx="60"
          cy="60"
          r={RING_R}
          className="hd-ring-fill"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - pct / 100)}
        />
      </svg>
      <div className="hd-ring-text">
        <b>{score === null ? "–" : `${score}%`}</b>
        <span>match</span>
      </div>
    </div>
  );
}
