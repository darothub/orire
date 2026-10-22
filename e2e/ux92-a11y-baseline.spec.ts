import { test, expect } from "@playwright/test";

/**
 * UX92 audit baseline, not a visual redesign.
 * Capture actual Orire viewport and a keyboard-focused state; use an
 * unauthenticated public route only and never create production accounts.
 * Passing checks are not a full WCAG or screen-reader audit.
 */
for (const viewport of [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 720 },
]) {
  test("UX92 actual landing accessibility baseline " + viewport.name, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const main = page.locator("main#main-content");
    await expect(main).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);

    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.screenshot({
      path: "test-results/ux92-baseline/BEFORE-ACTUAL-Orire-" + viewport.name + "-keyboard-focus.png",
      animations: "disabled",
      fullPage: false,
    });

    await page.keyboard.press("Enter");
    await expect(main).toBeFocused();
    const consent = page.getByRole("dialog", { name: "Cookie consent" });
    if (await consent.isVisible()) {
      await consent.getByRole("button", { name: "Decline" }).click();
    }
    await page.screenshot({
      path: "test-results/ux92-baseline/BEFORE-ACTUAL-Orire-" + viewport.name + "-landing.png",
      animations: "disabled",
      fullPage: false,
    });
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      docWidth: document.documentElement.scrollWidth,
      h1: document.querySelectorAll("h1").length,
      unlabeledButtons: Array.from(document.querySelectorAll("button"))
        .filter((el) => !(el.textContent?.trim() || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")))
        .length,
    }));
    test.info().annotations.push({
      type: "ux92-observation-not-full-wcag-signoff",
      description: JSON.stringify(metrics),
    });
    expect(metrics.docWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(errors).toEqual([]);
  });
}
