/**
 * Hermetic E2E helpers. Enabled only when the Playwright webServer sets
 * ORIRE_E2E_BYPASS=1 (see playwright.config.ts). Production/Vercel must never
 * set this. Only minted UUID-scoped e2e session ids are treated as bypassed so a
 * mis-set env cannot open the gate for real accounts.
 */

/** UUID identities created by the shared Playwright fixture, one per test/retry. */
const E2E_USER_ID = /^e2e-user-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const E2E_USER_EMAIL = "e2e@orire.test";

export function e2eBypassEnabled(): boolean {
  return process.env.ORIRE_E2E_BYPASS === "1";
}

/** True only for the hermetic Playwright session user when bypass is on. */
export function isE2eBypassUser(userId: string | null | undefined): boolean {
  return e2eBypassEnabled() && typeof userId === "string" && E2E_USER_ID.test(userId);
}
