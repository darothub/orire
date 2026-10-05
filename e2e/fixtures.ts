import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared E2E fixtures for orire.
 *
 * `appPage` opens the app with the auth overlay pre-dismissed (via the
 * `orire.auth.explored` localStorage flag the overlay itself sets once a user
 * explores), so tests land directly in the workspace with no database, email
 * or OAuth provider configured. Core CV flows are entirely client-side
 * (zustand), so this is enough for a hermetic smoke suite.
 */

/** Seed localStorage before any app script runs so the overlay never appears. */
async function seedExplored(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("orire.auth.explored", "1");
    } catch {
      /* storage unavailable — overlay can still be dismissed in-test */
    }
  });
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
    await seedExplored(page);
    await page.goto("/");
    // The workspace rail is the shell anchor; wait for it before handing off.
    await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
    await use(page);
  },
});

export { expect };
