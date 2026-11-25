import { test, expect } from "./fixtures";

/**
 * Issue #86 implementation validation against the built, running Orire app.
 * Evidence screenshots are real Playwright browser renders, not mockups.
 */
const viewports = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`approved mobile UX works at ${viewport.name}`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Meet the ideal candidate. Then close the gap." }),
    ).toBeVisible({ timeout: 20_000 });

    const consent = page.getByRole("dialog", { name: "Cookie consent" });
    await expect(consent).toBeVisible();
    await consent.getByRole("button", { name: "Decline" }).click();
    await expect(consent).toBeHidden();

    const dir = "test-results/ux86-implementation";
    const isMobileMenu = viewport.width <= 860;
    const menu = page.getByRole("button", { name: "Open section menu" });
    if (isMobileMenu) {
      await expect(menu).toBeVisible();
      await expect(page.locator(".lp-header-cta")).toBeVisible();
      const sizes = await page.locator(".lp-menu-toggle, .lp-actions > .lp-header-cta")
        .evaluateAll((nodes) => nodes.map((el) => {
          const box = el.getBoundingClientRect();
          return { width: box.width, height: box.height };
        }));
      expect(sizes).toHaveLength(2);
      for (const size of sizes) {
        expect(size.width).toBeGreaterThanOrEqual(44);
        expect(size.height).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator("#landing-mobile-section-links")).toHaveCount(1);
      await menu.click();
      const mobileNav = page.getByRole("navigation", { name: "Mobile page sections" });
      await expect(mobileNav).toBeVisible();
      await expect(page.getByRole("button", { name: "Close section menu" })).toHaveAttribute("aria-expanded", "true");
      await expect(mobileNav.getByRole("link")).toHaveCount(4);
      await page.screenshot({
        path: `${dir}/AFTER-menu-open-${viewport.name}.png`,
        animations: "disabled",
      });

      await page.keyboard.press("Escape");
      await expect(mobileNav).toBeHidden();
      await expect(page.getByRole("button", { name: "Open section menu" })).toBeFocused();

      await menu.click();
      // Use an empty viewport edge: the expanded menu intentionally overlays the hero.
      await page.mouse.click(5, viewport.height - 14);
      await expect(mobileNav).toBeHidden();

      await menu.click();
      await mobileNav.getByRole("link", { name: "Studio" }).click();
      await expect(mobileNav).toBeHidden();
      await expect(page).toHaveURL(/#studio$/);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${dir}/AFTER-menu-closed-${viewport.name}.png`,
        animations: "disabled",
      });
    } else {
      await expect(menu).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
    }

    // The hero match card and the three feature visuals stay inside the viewport.
    const card = page.locator(".lp-mcard").first();
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    for (const id of ["simulate", "copilot", "studio", "pricing"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await page.screenshot({ path: `${dir}/AFTER-studio-${viewport.name}.png`, animations: "disabled" });

    // No overall document overflow, even when the full-size preview is scrollable.
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(horizontalOverflow).toBe(false);
    expect(pageErrors).toEqual([]);
  });
}

test("animations respect the browser's reduced-motion preference", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open section menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile page sections" })).toBeVisible();
  const duration = await page.locator(".lp-menu-icon span").first().evaluate(
    el => getComputedStyle(el).transitionDuration,
  );
  expect(duration.split(",").every(part => parseFloat(part) === 0)).toBe(true);
});
