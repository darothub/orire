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
