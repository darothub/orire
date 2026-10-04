import type { ProviderId } from "@/lib/ai/types";
import type { CVData } from "@/lib/cv/schema";

/** Small, fast string hash (djb2) used to fold large inputs (JD text, CV JSON)
 *  into a compact token for the run fingerprint. Not cryptographic. */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Stable, order-insensitive fingerprint of everything a comparison depends on:
 *  the chosen assistants, the job description, and the working CV. When any of
 *  these change after a run, the on-screen results are stale and the user is
 *  made to compare again (so results always reflect the current inputs). */
export function refineRunSignature(providers: ProviderId[], jd: string, cv: CVData): string {
  const p = [...providers].sort().join(",");
  return `${p}|${djb2(jd.trim())}|${djb2(JSON.stringify(cv))}`;
}
