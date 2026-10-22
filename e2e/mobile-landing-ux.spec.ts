import { test, expect } from "@playwright/test";

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
      page.getByRole("heading", { name: "Build a CV that makes your experience stand out." }),
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
      await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
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
      await page.locator(".landing-hero h1").click();
      await expect(mobileNav).toBeHidden();

      await menu.click();
      await mobileNav.getByRole("link", { name: "Live demo" }).click();
      await expect(mobileNav).toBeHidden();
      await expect(page).toHaveURL(/#demo$/);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${dir}/AFTER-menu-closed-${viewport.name}.png`,
        animations: "disabled",
      });
    } else {
      await expect(menu).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
    }

    const frame = page.locator("#demo .landing-demo-frame");
    await frame.scrollIntoViewIfNeeded();
    await expect(frame).toBeVisible();
    const fit = await page.locator("#demo").evaluate((root) => {
      const windowFrame = root.querySelector(".landing-demo-frame")!.getBoundingClientRect();
      const paper = root.querySelector(".landing-demo-paper")!.getBoundingClientRect();
      return {
        frameWidth: windowFrame.width,
        paperWidth: paper.width,
        marginLeft: paper.left - windowFrame.left,
        marginRight: windowFrame.right - paper.right,
        fits: paper.left >= windowFrame.left - 1 && paper.right <= windowFrame.right + 1,
      };
    });
    console.log(`UX86_IMPLEMENTED ${viewport.name}: ${JSON.stringify(fit)}`);
    expect(fit.fits).toBe(true);
    expect(Math.abs(fit.marginLeft - fit.marginRight)).toBeLessThan(2);

    await page.locator("#demo").screenshot({
      path: `${dir}/AFTER-demo-${viewport.name}.png`,
      animations: "disabled",
    });

    // The expandable view is an actual modal, and Escape returns to the page.
    const enlarge = page.getByRole("button", { name: /Enlarge .* CV preview/ });
    await enlarge.click();
    const dialog = page.getByRole("dialog", { name: /full-size CV preview/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".landing-demo-full-paper")).toBeVisible();
    await expect(dialog.getByRole("region", { name: /Full-size .* fictional CV/ })).toBeVisible();
    await page.screenshot({
      path: `${dir}/AFTER-enlarged-${viewport.name}.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.locator(".landing-demo-rail").getByRole("button", { name: /Noir/ }).click();
    await expect(page.locator(".landing-demo-rail").getByRole("button", { name: /Noir/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".landing-demo-foot")).toContainText("Noir");

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
  const duration = await page.locator(".landing-mobile-menu-icon span").first().evaluate(
    el => getComputedStyle(el).transitionDuration,
  );
  expect(duration.split(",").every(part => parseFloat(part) === 0)).toBe(true);
});
