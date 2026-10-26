import { test, expect, signIn, waitForShell } from "./fixtures";

/**
 * UX #87 — hermetic first-CV journey: a REAL browser renders the anonymous
 * landing/auth dialog, then a stateless synthetic E2E session stands in for
 * successful credential/OAuth authentication. No user account, real provider,
 * Stripe checkout, email or production data is touched.
 *
 * This is an integration test of the ONBOARDING/EDITOR experience, not a test
 * claiming that the external signup/verification provider works end to end.
 */
// This spec deliberately verifies the first-run onboarding experience.
test.use({ showOnboardingTour: true });

for (const viewport of [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
]) {
  test("@smoke UX87 anonymous visitor to first edited CV " + viewport.name, async ({ page, db, e2eUser }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const consent = page.getByRole("dialog", { name: "Cookie consent" });
    await consent.waitFor({ state: "visible", timeout: 3_000 }).catch(() => {});
    if (await consent.isVisible().catch(() => false)) {
      await consent.getByRole("button", { name: "Decline" }).click();
    }

    // Begin from the actual public hero CTA.
    const primary = page.getByRole("button", { name: "Create your CV" }).first();
    await expect(primary).toBeVisible({ timeout: 20_000 });
    await primary.click();
    const signup = page.getByRole("dialog", { name: "Create your account" });
    await expect(signup).toBeVisible();

    // A safe validation failure must be understandable without API calls.
    await signup.locator('input[type="email"]').fill("first-journey@orire.test");
    const password = signup.locator('input[type="password"]');
    await password.fill("short");
    await signup.getByRole("button", { name: "Create account", exact: true }).click();
    expect(await password.evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true);
    await password.fill("ExamplePass1234");

    await page.screenshot({
      path: "test-results/ux87-journey/ACTUAL-signup-dialog-" + viewport.name + ".png",
      animations: "disabled",
    });

    // No real signup. Dismiss and install the same isolated stateless session
    // used throughout CI; this explicitly models completion of authentication.
    await signup.getByRole("button", { name: "Close and return to the landing page" }).click();
    await expect(signup).toBeHidden();
    await signIn(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForShell(page);
    // Authenticated account-scoped storage can re-show cookie consent. Clear it
    // before evidence captures; the test remains opt-out of optional tracking.
    await consent.waitFor({ state: "visible", timeout: 3_000 }).catch(() => {});
    if (await consent.isVisible().catch(() => false)) {
      await consent.getByRole("button", { name: "Decline" }).click();
    }

    // Brand new user: onboarding should open before the editor.
    const tour = page.getByRole("dialog", { name: "Getting started tour" });
    await expect(tour).toBeVisible({ timeout: 20_000 });
    await expect(tour.getByRole("heading", { name: "Welcome to orire" })).toBeVisible();
    await tour.getByRole("button", { name: "Skip" }).click();
    await expect(tour).toBeHidden();

    const rail = page.getByRole("navigation", { name: "Workspaces" });
    await rail.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit", exact: true })).toBeVisible();

    const name = page.getByText("Full name").locator("..").locator("input");
    await name.fill("First Journey Candidate");
    await expect(name).toHaveValue("First Journey Candidate");

    const pane = page.getByRole("tablist", { name: "Switch pane" });
    if (viewport.width < 800 && (await pane.count())) {
      await pane.getByRole("tab", { name: "Preview" }).click();
    }
    // The journey includes choosing a real template, not only editing a name.
    const templates = page.locator(".picker .pick-card");
    await expect(templates.first()).toBeVisible();
    const selected = templates.nth(1);
    await selected.click();
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    // Template transitions temporarily render both outgoing and incoming CVs.
    // Wait for AnimatePresence to complete before asserting on the unique live preview.
    const paper = page.locator(".pane-preview #cv-paper");
    await expect(paper).toHaveCount(1);
    await expect(paper).toBeVisible();
    await expect(paper).toContainText("First Journey Candidate");

    await page.screenshot({
      path: "test-results/ux87-journey/ACTUAL-first-CV-preview-" + viewport.name + ".png",
      animations: "disabled",
    });

    // Wait for debounced cloud persistence before reloading; otherwise a
    // concurrent browser can still read the previous server snapshot.
    // Await the actual persisted CV rather than a layout-dependent sync label.
    await expect.poll(async () => {
      const doc = await db.document.findFirst({
        where: { userId: e2eUser.id }, orderBy: { updatedAt: "desc" },
      });
      return (doc?.data as { basics?: { fullName?: string } } | undefined)?.basics?.fullName;
    }, { timeout: 20_000 }).toBe("First Journey Candidate");

    // The edited CV should persist across a reload in the same test account.
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForShell(page);
    await rail.getByRole("button", { name: "Edit", exact: true }).click();
    if (viewport.width < 800 && (await pane.count())) {
      await pane.getByRole("tab", { name: "Edit" }).click();
    }
    await expect(page.getByText("Full name").locator("..").locator("input"))
      .toHaveValue("First Journey Candidate");

    await rail.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Export", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download Word (.docx)" })).toBeVisible();
    if (viewport.width >= 800) {
      const download = page.waitForEvent("download", { timeout: 25_000 });
      await page.getByRole("button", { name: "Download .txt" }).click();
      expect((await download).suggestedFilename()).toMatch(/\.txt$/i);
    }
    expect(errors).toEqual([]);
  });
}

for (const planName of ["Pro", "Career"]) {
  test(`UX87 ${planName} plan intent opens signup without checkout`, async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#pricing").scrollIntoViewIfNeeded();
  const plan = page.locator(".landing-price-card").filter({ has: page.getByRole("heading", { name: planName, exact: true }) });
  await expect(plan).toBeVisible();
  const action = plan.getByRole("button");
  await action.click();
  const dialog = page.getByRole("dialog", { name: "Create your account" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL("/");
  await dialog.getByRole("tab", { name: "Sign in" }).click();
  await expect(page.getByRole("dialog", { name: "Welcome back" })).toBeVisible();
  // Clicking pricing must never initiate Stripe while unauthenticated.
  expect(page.url()).not.toMatch(/checkout|stripe/i);
  });
}
