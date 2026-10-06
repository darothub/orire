import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET } from "./e2e/session";

/**
 * orire — end-to-end test configuration.
 *
 * Tests run against a dedicated dev server on port 3100 (kept off the default
 * 3001 so a developer's running `npm run dev` is never disturbed). The suite is
 * hermetic: tests are signed in with a minted Auth.js session cookie (see
 * e2e/session.ts) and every `/api/ai/*` call is stubbed per-test, so no
 * database, SMTP or real provider key is required. See e2e/fixtures.ts.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Env for the e2e web server. A dummy datasource is enough for `prisma
 * generate` and `next build` (no connection is opened at build time, and the
 * JWT session strategy decodes the auth cookie without touching the DB). The
 * fixed AUTH_SECRET must match the one used to mint the session cookie.
 */
const serverEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  AUTH_SECRET: E2E_AUTH_SECRET,
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgresql://ci:ci@localhost:5432/ci?schema=public",
  DIRECT_URL:
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL ??
    "postgresql://ci:ci@localhost:5432/ci?schema=public",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Run against a production build: no dev-overlay portal intercepting
    // clicks, and closer to what ships. Reuses an already-running server
    // locally so repeat runs are fast.
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: serverEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
