/**
 * Campaign attribution. Ad clicks land with UTM params (and Meta's `fbclid`);
 * we persist them for 30 days so a sign-up or purchase days later can still be
 * credited to the campaign. A visit with fresh campaign params replaces the
 * stored set (last-touch); a plain visit leaves it alone.
 */

const KEY = "orire-attribution";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

export type AttributionParam = (typeof PARAMS)[number];
export type Attribution = Partial<Record<AttributionParam, string>>;

interface Stored {
  at: number;
  data: Attribution;
}

/** Pull campaign params out of a query string; values are trimmed and capped. */
export function parseAttribution(search: string): Attribution {
  const sp = new URLSearchParams(search);
  const out: Attribution = {};
  for (const k of PARAMS) {
    const v = sp.get(k)?.trim();
    if (v) out[k] = v.slice(0, 200);
  }
  return out;
}

export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const found = parseAttribution(window.location.search);
    if (Object.keys(found).length === 0) return;
    const stored: Stored = { at: Date.now(), data: found };
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage can be blocked (private mode); attribution is best-effort.
  }
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const s = JSON.parse(raw) as Stored;
    if (!s?.data || Date.now() - s.at > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return {};
    }
    return s.data;
  } catch {
    return {};
  }
}
