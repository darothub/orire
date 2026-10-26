import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { addSessionCookie, type E2EUser } from "./session";
import { PrismaClient } from "@prisma/client";
import { e2eDatabaseUrl } from "./database";

/**
 * Shared E2E fixtures for orire.
 *
 * `appPage` opens the app already signed in: a valid Auth.js session cookie is
 * added to the browser context (see e2e/session.ts) so the server authenticates
 * on first paint and the mandatory auth overlay never appears. The suite stays
 * isolated: each test gets a fresh synthetic database user and browser context.
 * JWT authentication needs no email or OAuth provider. Cloud persistence uses
 * only an explicitly configured disposable local PostgreSQL database.
 */

/** Seed localStorage before any app script runs: mark onboarding as seen so the
 *  guided tour doesn't auto-open and intercept clicks in the core-flow tests
 *  (the tour has its own dedicated spec). */
async function seedOnboarded(context: BrowserContext) {
  await context.addInitScript(() => {
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
const contextUsers = new WeakMap<BrowserContext, E2EUser>();

export async function signIn(page: Page) {
  const user = contextUsers.get(page.context());
  if (!user) throw new Error("Import test from ./fixtures to use an isolated E2E session.");
  await addSessionCookie(page.context(), user);
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

export const test = base.extend<{
  appPage: Page;
  db: PrismaClient;
  e2eUser: E2EUser;
  _onboardingSetup: void;
  showOnboardingTour: boolean;
}>({
  showOnboardingTour: [false, { option: true, scope: "test" }],
  _onboardingSetup: [async ({ context, showOnboardingTour }, use) => {
    if (!showOnboardingTour) await seedOnboarded(context);
    await use();
  }, { auto: true }],
  db: async ({}, use) => {
    const db = new PrismaClient({ datasourceUrl: e2eDatabaseUrl() });
    try {
      await use(db);
    } finally {
      await db.$disconnect();
    }
  },
  e2eUser: [async ({ db, context }, use) => {
    const id = `e2e-user-${randomUUID()}`;
    const user = { id, name: "E2E Tester", email: `${id}@orire.test` };
    await db.user.create({ data: user });
    contextUsers.set(context, user);
    try {
      await use(user);
    } finally {
      // Stop browser requests before cascading only this test's rows.
      await context.close();
      contextUsers.delete(context);
      await db.user.delete({ where: { id } });
    }
  }, { auto: true }],

  appPage: async ({ page }, use) => {
    await signIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // The workspace rail is the shell anchor; wait for it before handing off.
    await waitForShell(page);
    await use(page);
  },
});

export { expect };
