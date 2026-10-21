import { test, expect } from "@playwright/test";

/**
 * Genuine Orire visual baseline at the current main-branch UI.
 *
 * This intentionally makes NO visual or application changes. CI builds Orire,
 * serves it on localhost and saves Playwright browser screenshots as artifacts.
 * Screenshots are baseline evidence for UX issue #86, not proposed mockups.
 */
const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-320x720", width: 320, height: 720 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
] as const;

for (const viewport of viewports) {
  test(`capture actual Orire anonymous landing — ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: /Build a CV that makes your experience stand out/i }),
    ).toBeVisible({ timeout: 20_000 });

    // Ensure the below-fold React previews have mounted before taking captures.
    await page.locator("#templates").scrollIntoViewIfNeeded();
    await page.locator("#demo").scrollIntoViewIfNeeded();
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 0);
    });

    const dir = "test-results/visual-baseline";
    await page.screenshot({
      path: `${dir}/orire-homepage-${viewport.name}-full.png`,
      fullPage: true,
      animations: "disabled",
    });

    for (const id of ["templates", "demo", "pricing"]) {
      await page.locator(`#${id}`).screenshot({
        path: `${dir}/orire-${id}-${viewport.name}.png`,
        animations: "disabled",
      });
    }

    // Record a measurable baseline, rather than trusting an illustration.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1
    );
    console.log(`ORIRE_BASELINE ${viewport.name} horizontalOverflow=${overflow}`);
  });
}
