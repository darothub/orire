import { test, expect, signIn } from "./fixtures";

/**
 * #92: onboarding's accessible modal behavior in the REAL signed-in Orire app.
 * The test uses a fake E2E Auth.js session and fictional sample CV, never live
 * authentication or user content.
 */
test.describe("first-run tour", () => {
  test.use({ showOnboardingTour: true });
for (const viewport of [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
]) {
  test("first-run tour traps focus and respects buttons " + viewport.name, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const tour = page.getByRole("dialog", { name: "Getting started tour" });
    await expect(tour).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".app.has-rail")).toHaveAttribute("inert", "");
    const heading = tour.getByRole("heading", { name: "Welcome to orire" });
    await expect(heading).toBeFocused();
    await expect(tour).toHaveAttribute("aria-modal", "true");
    await expect(tour.locator(".tour-catch")).toHaveAttribute("tabindex", "-1");

    await page.screenshot({
      path: "test-results/ux92-tour/AFTER-tour-keyboard-" + viewport.name + ".png",
      animations: "disabled",
    });

    await page.keyboard.press("Tab");
    await expect(tour.getByRole("button", { name: "Skip" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(tour.getByRole("button", { name: "Next" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tour.getByRole("heading", { name: "Edit, live" })).toBeFocused();
    await expect(tour.locator(".tour-step")).toHaveText("Step 2 of 7");

    // Enter must invoke Back's actual button click rather than triggering an
    // unrelated global advance as happened before this accessibility change.
    await tour.getByRole("button", { name: "Back" }).focus();
    await page.keyboard.press("Enter");
    await expect(tour.getByRole("heading", { name: "Welcome to orire" })).toBeFocused();
    await expect(tour.locator(".tour-step")).toHaveText("Step 1 of 7");

    await page.keyboard.press("Escape");
    await expect(tour).toBeHidden();
    await expect(page.locator(".app.has-rail")).not.toHaveAttribute("inert", "");
    expect(await page.evaluate(() => localStorage.getItem("orire-onboarded"))).toBe("1");
    expect(errors).toEqual([]);
  });
}
});

test("replaying a tour restores keyboard focus after Skip", async ({ appPage }) => {
  await appPage.keyboard.press("Control+k");
  const palette = appPage.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  const search = palette.getByPlaceholder("Search workspaces, templates, actions…");
  await search.fill("Take the tour");
  await palette.getByRole("button", { name: /Take the tour/ }).click();

  const tour = appPage.getByRole("dialog", { name: "Getting started tour" });
  await expect(tour).toBeVisible();
  await expect(tour.getByRole("heading", { name: "Welcome to orire" })).toBeFocused();

  // Pressing Enter on Skip closes; it must not advance first.
  await tour.getByRole("button", { name: "Skip" }).focus();
  await appPage.keyboard.press("Enter");
  await expect(tour).toBeHidden();
  await expect(appPage.locator(".app.has-rail")).not.toHaveAttribute("inert", "");
  await expect(appPage.locator(".cmdk-hint-btn")).toBeFocused();
});
