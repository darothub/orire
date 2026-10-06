import { test as base, expect, type Page } from "@playwright/test";
import { addSessionCookie } from "./session";

/**
 * Shared E2E fixtures for orire.
 *
 * `appPage` opens the app already signed in: a valid Auth.js session cookie is
 * added to the browser context (see e2e/session.ts) so the server authenticates
 * on first paint and the mandatory auth overlay never appears. The suite stays
 * hermetic — the JWT session strategy decodes the cookie statelessly, so no
 * database, email or OAuth provider is required. Core CV flows are entirely
 * client-side (zustand).
 */

/** Seed localStorage before any app script runs: mark onboarding as seen so the
 *  guided tour doesn't auto-open and intercept clicks in the core-flow tests
 *  (the tour has its own dedicated spec). */
async function seedOnboarded(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("orire-onboarded", "1");
    } catch {
      /* storage unavailable */
    }
  });
}

/**
 * Mark the app as authenticated for the current browser context by installing a
 * valid Auth.js session cookie. Call before navigating. Exported so specs that
 * build their own `page` (outside the `appPage` fixture) can opt in too.
 */
export async function signIn(page: Page) {
  await addSessionCookie(page.context());
}

/**
 * Stub every `/api/ai/*` endpoint with a deterministic OK response so tests
 * that touch an AI-driven path never reach a real provider. Call before
 * navigating. Individual tests can override a specific route afterwards.
 */
export async function stubAI(page: Page) {
  await page.route("**/api/ai/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/models")) {
      await route.fulfill({
        json: { ok: true, provider: "openai", models: ["gpt-4o-mini"] },
      });
      return;
    }
    await route.fulfill({
      json: { ok: true, provider: "openai", model: "gpt-4o-mini", parsed: null },
    });
  });
}

export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await seedOnboarded(page);
    await signIn(page);
    await page.goto("/");
    // The workspace rail is the shell anchor; wait for it before handing off.
    await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
    await use(page);
  },
});

export { expect };
