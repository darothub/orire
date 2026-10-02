/**
 * orire — seat-capacity status (pure).
 *
 * Turns a team's seat usage (members + live invites) into a capacity level and
 * a human message so the UI can warn owners/admins as they approach or hit the
 * seat limit. Pure + unit-tested; the live seat math lives in `team.ts`.
 */

export type SeatLevel = "ok" | "warn" | "full";

export interface SeatStatus {
  used: number;
  limit: number;
  left: number;
  /** Fraction of seats occupied, 0‥1 (0 when the limit is non-positive). */
  ratio: number;
  level: SeatLevel;
  /** Warning copy for warn/full; null when there's comfortable headroom. */
  message: string | null;
}

/** Seats left triggers a "warn" at or below this count (also see the ratio). */
const NEAR_SEATS_LEFT = 1;
/** …or when occupancy reaches this fraction of the limit. */
const NEAR_RATIO = 0.8;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Classify seat occupancy. `used` should include members + live invites. */
export function seatStatus(used: number, limit: number): SeatStatus {
  const safeUsed = Math.max(0, Math.floor(used));
  const safeLimit = Math.max(0, Math.floor(limit));
  const left = Math.max(0, safeLimit - safeUsed);
  const ratio = safeLimit > 0 ? Math.min(1, safeUsed / safeLimit) : 0;

  let level: SeatLevel = "ok";
  let message: string | null = null;

  if (left <= 0) {
    level = "full";
    message = `All ${plural(safeLimit, "seat")} are filled — remove a member or upgrade to invite more.`;
  } else if (left <= NEAR_SEATS_LEFT || ratio >= NEAR_RATIO) {
    level = "warn";
    message = `Only ${plural(left, "seat")} left of ${safeLimit}.`;
  }

  return { used: safeUsed, limit: safeLimit, left, ratio, level, message };
}
