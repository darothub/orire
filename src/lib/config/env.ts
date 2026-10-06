/**
 * orire — fail-fast environment validation.
 *
 * A production deploy that is missing a hard-required secret used to fail
 * *late* and cryptically: e.g. a missing `AUTH_SECRET` only surfaces when a
 * user hits the paid refine path (run-token signing throws), and a missing
 * `DATABASE_URL` only surfaces on the first query. This module turns those
 * into a single, legible boot-time check.
 *
 * Two classes of problem are reported:
 *   - `missing`  — a hard-required variable is absent. In production this is
 *                  fatal (see `instrumentation.ts`); the app cannot work.
 *   - `warnings` — a feature group is *partially* configured (some keys set,
 *                  others not), which almost always means a misconfiguration.
 *
 * The checker is pure (`env` is injectable) so it is fully unit-testable and
 * never reads `process.env` implicitly.
 */

export type EnvRecord = Record<string, string | undefined>;

export interface EnvCheckResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

/** Variables the app genuinely cannot run without in production. */
export const HARD_REQUIRED = ["AUTH_SECRET", "DATABASE_URL"] as const;

/**
 * Feature groups that are all-or-nothing: if some keys are present but not
 * all, the feature is half-wired and will misbehave. We warn rather than fail
 * because the feature is optional — but a partial config is never intentional.
 */
export const FEATURE_GROUPS: ReadonlyArray<{ name: string; keys: readonly string[] }> = [
  { name: "Google OAuth", keys: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] },
  { name: "GitHub OAuth", keys: ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"] },
  {
    name: "Stripe billing",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
  },
  { name: "Turnstile", keys: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] },
  { name: "SMTP mail", keys: ["MAIL_SMTP_HOST", "MAIL_SMTP_PORT", "MAIL_SMTP_USER", "MAIL_SMTP_PASS"] },
];

function has(env: EnvRecord, key: string): boolean {
  const v = env[key];
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validate an environment record. Pure: pass the env you want checked.
 * `missing` lists absent hard-required vars; `warnings` lists partially
 * configured feature groups. `ok` is true only when nothing is missing.
 */
export function checkEnv(env: EnvRecord = process.env): EnvCheckResult {
  const missing = HARD_REQUIRED.filter((key) => !has(env, key));

  const warnings: string[] = [];
  for (const group of FEATURE_GROUPS) {
    const present = group.keys.filter((k) => has(env, k));
    if (present.length > 0 && present.length < group.keys.length) {
      const absent = group.keys.filter((k) => !has(env, k));
      warnings.push(`${group.name} is partially configured; missing: ${absent.join(", ")}`);
    }
  }

  return { ok: missing.length === 0, missing: [...missing], warnings };
}

/** Human-readable summary of a failed check, for logs and thrown errors. */
export function formatEnvError(result: EnvCheckResult): string {
  const parts: string[] = [];
  if (result.missing.length > 0) {
    parts.push(`Missing required environment variables: ${result.missing.join(", ")}`);
  }
  if (result.warnings.length > 0) {
    parts.push(...result.warnings.map((w) => `Warning: ${w}`));
  }
  return parts.join("\n");
}
