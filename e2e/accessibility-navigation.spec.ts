import { test, expect } from "./fixtures";

/**
 * UX #92 first accessibility pass: keyboard navigation and text alternatives.
 * Captures genuine Chromium screenshots of focus-only skip link and CV dialog.
 * The skip control does not change Orire's normal pointer-first appearance.
 */
for (const viewport of [
  { width: 320, height: 720, id: "mobile-320" },
  { width: 390, height: 844, id: "mobile-390" },
  { width: 1440, height: 900, id: "desktop-1440" },
]) {
  test((viewport.width === 320 ? "" : "@smoke ") + "public landing keyboard skip and section landmarks " + viewport.id, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", {
      name: "Meet the ideal candidate. Then close the gap.",
    })).toBeVisible();

    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toHaveCount(1);
    await expect(skip).toHaveAttribute("href", "#main-content");
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    const focusStyle = await skip.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);

    await page.screenshot({
      path: "test-results/ux92-a11y/AFTER-skip-link-focused-" + viewport.id + ".png",
      animations: "disabled",
    });
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();

    const consent = page.getByRole("dialog", { name: "Cookie consent" });
    if (await consent.isVisible()) {
      await consent.getByRole("button", { name: "Decline" }).click();
    }

    // The three product moves are real landmarks the skip link and nav can reach.
    for (const [id, name] of [["simulate", "Simulate"], ["copilot", "Orire Career Copilot"], ["studio", "CV Studio"], ["pricing", "Plans"]] as const) {
      await expect(page.locator(`section#${id}`)).toHaveAttribute("aria-label", name);
    }
    await page.locator("#studio").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "Refine with AI — and see what changed." })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("authenticated CV workspace has keyboard skip-to-main link", async ({ appPage }) => {
  const skip = appPage.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toHaveCount(1);
  await expect(skip).toHaveAttribute("href", "#main-content");
  await expect(appPage.locator("main#main-content")).toHaveCount(1);
  await skip.focus();
  await expect(skip).toBeFocused();
  await appPage.keyboard.press("Enter");
  await expect(appPage.locator("main#main-content")).toBeFocused();
});

test("UX92 public support form labels and error announcement", async ({ page }) => {
  await page.goto("/support", { waitUntil: "domcontentloaded" });
  const email = page.getByRole("textbox", { name: "Your email" });
  const message = page.getByRole("textbox", { name: "How can we help?" });
  await email.focus();
  await expect(email).toBeFocused();
  await email.fill("candidate@example.test");
  await message.fill("Please help with a CV export problem.");
  await page.route("**/api/support", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: "Support temporarily unavailable" }),
  }));
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".support-error[role=\"alert\"]")).toContainText("Support temporarily unavailable");
  await expect(email).toHaveValue("candidate@example.test");
  await expect(message).toHaveValue("Please help with a CV export problem.");
});
