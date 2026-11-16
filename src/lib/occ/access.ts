import type { PlanId } from "@/lib/plan/plan";

/**
 * OCC is an experimental, Career-only capability. Never expose client-side
 * configuration as an authorization source.
 */
export function occFeatureEnabled(envValue: string | undefined = process.env.ORIRE_OCC_ENABLED): boolean {
  return envValue === "true";
}

export function canAccessOcc(
  plan: PlanId | null | undefined,
  enabled: boolean = occFeatureEnabled(),
): boolean {
  return enabled && plan === "career";
}

/**
 * Private beta allowlist. Fail closed when unset: enabling the global OCC flag
 * must never accidentally expose an unreviewed feature to all Career users.
 * Compare only the verified email supplied by the authenticated session.
 */
export function occBetaEmailAllowed(
  email: string | null | undefined,
  allowedEmails: string | undefined = process.env.ORIRE_OCC_BETA_EMAILS,
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !allowedEmails?.trim()) return false;
  const allowed = new Set(
    allowedEmails.split(",").map(value => value.trim().toLowerCase()).filter(Boolean),
  );
  return allowed.has(normalized);
}

/**
 * Only for hermetic Playwright fixtures backed by disposable LOOPBACK Postgres.
 * This is not a beta wildcard or production entitlement. A user on a remotely
 * hosted database cannot qualify, regardless of environment variables.
 */
export function occIsolatedE2eFixtureAllowed(
  userId: string | null | undefined,
  email: string | null | undefined,
  bypass: string | undefined = process.env.ORIRE_E2E_BYPASS,
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): boolean {
  if (bypass !== "1" || !userId || !email || !databaseUrl ||
      !/^e2e-user-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(userId) ||
      email !== `${userId}@orire.test`) return false;
  try {
    const url = new URL(databaseUrl);
    return ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      /^\/orire_e2e(?:_[a-z0-9_]+)?$/.test(url.pathname);
  } catch {
    return false;
  }
}
