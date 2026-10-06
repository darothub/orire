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

/**
 * How long to wait for the app shell to appear after a navigation. The default
 * `expect` timeout (7s) is fine for in-app interactions but too tight for the
 * *first* paint in CI, where `next start` serves a cold route and the client
 * bundle must download and hydrate before the session-gated shell renders.
 * This was the historical flake: the "Workspaces" rail is the shell anchor, and
 * a cold first navigation occasionally crossed 7s. A generous, explicit budget
 * removes the race without masking a genuine failure (an unauthenticated app
 * renders the landing page and still fails, just later).
 */
export const SHELL_READY_TIMEOUT = 20_000;

/**
 * Wait for the authenticated app shell to be ready. Anchors on the workspace
 * rail — the one element that only exists once the session-gated app has
 * rendered. Use after any `goto("/")`/`reload()` that should land on the shell.
 */
export async function waitForShell(page: Page) {
  await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible({
    timeout: SHELL_READY_TIMEOUT,
  });
}

export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await seedOnboarded(page);
    await signIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // The workspace rail is the shell anchor; wait for it before handing off.
    await waitForShell(page);
    await use(page);
  },
});

export { expect };
