/**
 * orire — AI request input limits (durability / cost protection).
 *
 * The AI routes run on orire's managed provider keys, so an oversized request
 * body translates directly into token spend (and memory pressure). The rate
 * limiter caps request *frequency*; these bounds cap request *size*. Both guard
 * the same managed-key cost surface.
 *
 * Limits are generous for real CVs/JDs but reject pathological payloads. Each is
 * env-overridable so we can tune without a redeploy of logic.
 */

const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Character/size ceilings. Exposed as getters so tests can set env per-case. */
export const limits = {
  /** Raw request body bytes (checked via content-length before parsing). */
  bodyBytes: () => intFromEnv("AI_MAX_BODY_BYTES", 1_000_000),
  /** Job-description text. */
  jobDescriptionChars: () => intFromEnv("AI_MAX_JD_CHARS", 20_000),
  /** Raw uploaded-CV text handed to the structure route. */
  rawTextChars: () => intFromEnv("AI_MAX_TEXT_CHARS", 80_000),
  /** Serialized CV JSON (JSON.stringify length). */
  cvChars: () => intFromEnv("AI_MAX_CV_CHARS", 200_000),
  /** Number of candidates the judge will score. */
  candidates: () => intFromEnv("AI_MAX_CANDIDATES", 6),
};

export interface InputToValidate {
  jobDescription?: unknown;
  text?: unknown;
  cv?: unknown;
  candidates?: unknown;
}

/**
 * Reject a request whose declared body size exceeds the cap, before we parse it
 * into memory. Returns an error message (caller 413s/400s) or null when fine.
 * A missing/invalid header is allowed through — the field validators still bound
 * the parsed content.
 */
export function bodyTooLarge(req: { headers: { get(name: string): string | null } }): string | null {
  const header = req.headers.get("content-length");
  if (!header) return null;
  const len = Number.parseInt(header, 10);
  if (!Number.isFinite(len)) return null;
  const max = limits.bodyBytes();
  if (len > max) {
    return `Request too large (${len} bytes; limit ${max}).`;
  }
  return null;
}

/** Serialized size of a CV-ish payload; 0 when absent, Infinity when uncircular-serializable. */
function jsonLen(value: unknown): number {
  if (value === undefined || value === null) return 0;
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Validate the size of the AI-relevant fields on a parsed body. Returns the
 * first violation message, or null when every present field is within bounds.
 * Presence/shape checks stay in the routes; this is purely about magnitude.
 */
export function validateInputSize(input: InputToValidate): string | null {
  if (typeof input.jobDescription === "string") {
    const max = limits.jobDescriptionChars();
    if (input.jobDescription.length > max) {
      return `Job description too long (${input.jobDescription.length} chars; limit ${max}).`;
    }
  }

  if (typeof input.text === "string") {
    const max = limits.rawTextChars();
    if (input.text.length > max) {
      return `Uploaded CV text too long (${input.text.length} chars; limit ${max}).`;
    }
  }

  if (input.cv !== undefined && input.cv !== null) {
    const max = limits.cvChars();
    const len = jsonLen(input.cv);
    if (len > max) {
      return `CV payload too large (${len} chars; limit ${max}).`;
    }
  }

  if (input.candidates !== undefined) {
    if (!Array.isArray(input.candidates)) return null; // route does its own shape check
    const maxCount = limits.candidates();
    if (input.candidates.length > maxCount) {
      return `Too many candidates (${input.candidates.length}; limit ${maxCount}).`;
    }
    const maxCv = limits.cvChars();
    for (const cand of input.candidates) {
      const cv = (cand as { cv?: unknown })?.cv;
      const len = jsonLen(cv);
      if (len > maxCv) {
        return `A candidate CV is too large (${len} chars; limit ${maxCv}).`;
      }
    }
  }

  return null;
}
