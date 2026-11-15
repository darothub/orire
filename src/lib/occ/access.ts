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
