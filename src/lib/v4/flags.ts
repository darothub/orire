/**
 * v4 release switches, kept pure so the rules can be unit-tested. v4 is off
 * unless ORIRE_V4_ENABLED is exactly "true". When ORIRE_V4_BETA_EMAILS lists
 * addresses, only those accounts get in; unset or empty means every verified
 * account (the full rollout). The AI Copilot parts also need the OCC switch.
 */
export function v4Enabled(value: string | undefined = process.env.ORIRE_V4_ENABLED): boolean {
  return value === "true";
}

export function v4EmailAllowed(
  email: string | null | undefined,
  list: string | undefined = process.env.ORIRE_V4_BETA_EMAILS,
): boolean {
  const allowed = (list ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0) return true;
  const normalized = email?.trim().toLowerCase();
  return !!normalized && allowed.includes(normalized);
}
