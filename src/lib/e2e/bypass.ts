/**
 * Hermetic E2E helpers. Enabled only when the Playwright webServer sets
 * ORIRE_E2E_BYPASS=1 (see playwright.config.ts). Production/Vercel must never
 * set this. Only the minted e2e session user id is treated as bypassed so a
 * mis-set env cannot open the gate for real accounts.
 */

/** Fixed id minted in e2e/session.ts */
export const E2E_USER_ID = "e2e-user";
export const E2E_USER_EMAIL = "e2e@orire.test";

export function e2eBypassEnabled(): boolean {
  return process.env.ORIRE_E2E_BYPASS === "1";
}

/** True only for the hermetic Playwright session user when bypass is on. */
export function isE2eBypassUser(userId: string | null | undefined): boolean {
  return e2eBypassEnabled() && userId === E2E_USER_ID;
}
