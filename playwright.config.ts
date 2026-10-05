import { defineConfig, devices } from "@playwright/test";

/**
 * orire — end-to-end test configuration.
 *
 * Tests run against a dedicated dev server on port 3100 (kept off the default
 * 3001 so a developer's running `npm run dev` is never disturbed). The suite is
 * hermetic: the auth overlay is pre-dismissed via localStorage and every
 * `/api/ai/*` call is stubbed per-test, so no database, SMTP or real provider
 * key is required. See e2e/fixtures.ts.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

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
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
