import { validateOccCoachingSnapshot, type OccCoachingSnapshot } from "./coachingSnapshot";

export const MAX_COACHING_SNAPSHOTS = 40;
export type OccSavedCoaching = { messageSequence: number; kind: "review" | "interview"; payload: OccCoachingSnapshot };
export type SaveOccCoachingHistory = { snapshots: OccSavedCoaching[]; consent: true };

/** Explicit, independent consent for structured coaching history.
 * Text transcript saving is NOT a substitute for this consent.
 */
export function validateOccCoachingHistory(input: unknown): SaveOccCoachingHistory | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).some(key => !["consent", "snapshots"].includes(key)) ||
      raw.consent !== true || !Array.isArray(raw.snapshots) ||
      raw.snapshots.length < 1 || raw.snapshots.length > MAX_COACHING_SNAPSHOTS) return null;
  const seen = new Set<number>();
  const snapshots: OccSavedCoaching[] = [];
  for (const item of raw.snapshots) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const obj = item as Record<string, unknown>;
    if (Object.keys(obj).some(key => !["messageSequence", "payload"].includes(key)) ||
        typeof obj.messageSequence !== "number" || !Number.isSafeInteger(obj.messageSequence) ||
        obj.messageSequence < 0 || obj.messageSequence >= 100 || seen.has(obj.messageSequence)) return null;
    const payload = validateOccCoachingSnapshot(obj.payload, true);
    if (!payload) return null;
    seen.add(obj.messageSequence);
    snapshots.push({ messageSequence: obj.messageSequence, kind: payload.kind, payload });
  }
  return { consent: true, snapshots };
}
