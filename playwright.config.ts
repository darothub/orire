import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET } from "./e2e/session";
import { e2eDatabaseUrl } from "./e2e/database";

/**
 * orire — end-to-end test configuration.
 *
 * Tests run against a dedicated dev server on port 3100 (kept off the default
 * 3001 so a developer's running `npm run dev` is never disturbed). The suite is
 * isolated: each minted Auth.js session owns a fresh database user. A migrated
 * disposable local PostgreSQL database is required. AI calls are intercepted
 * by the relevant tests; no SMTP or real provider key is needed.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const databaseUrl = e2eDatabaseUrl();

/**
 * Env for the E2E server. Explicitly validate the disposable database before
 * fixtures or server actions can write. The fixed AUTH_SECRET must match
 * the one used to mint each test session.
 */
const serverEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  AUTH_SECRET: E2E_AUTH_SECRET,
  // `next start` runs in production mode, where Auth.js rejects the request
  // host as untrusted (returning a null session) unless it is told to trust it.
  // Prod (Vercel) trusts its own host automatically; the e2e server must be
  // told explicitly so this does not depend on a developer's shell/.env.
  AUTH_TRUST_HOST: "true",
  // Unlock hermetic signup→export for minted UUID-scoped test users only (src/lib/e2e/bypass.ts).
  // Never set ORIRE_E2E_BYPASS in production.
  ORIRE_E2E_BYPASS: "1",
  // Email/password form is gated by NEXT_PUBLIC_PASSWORD_AUTH (AuthOverlay).
  // CI has no .env — force it on so guest signup E2E can exercise the form.
  NEXT_PUBLIC_PASSWORD_AUTH: "true",
  // Keep signup UI path free of Turnstile in hermetic CI.
  TURNSTILE_SECRET_KEY: "",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Each test/retry owns its database rows; exercise parallel isolation locally too.
  workers: 2,
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
    // Phone viewport only for signup→export QA. Smoke assumes a desktop
    // split preview (#cv-paper visible beside Edit) and would false-fail here.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /signup-export\.spec\.ts/,
    },
  ],
  webServer: {
    // Run against a production build: no dev-overlay portal intercepting
    // clicks, and closer to what ships. Always launch our own isolated server.
    // In GitHub Actions the E2E job builds once before launching Playwright.
    // For local runs retain the build-and-start convenience.
    command: process.env.E2E_PREBUILT === "1"
      ? `npx next start -p ${PORT}`
      : `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: serverEnv,
    // A pre-existing server may point at a different database or auth secret.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
