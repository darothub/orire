import { test, expect } from "@playwright/test";

/** UX97 reduced-motion and interactive-state regression at real viewports. */
for (const viewport of [
  { width: 1440, height: 900, name: "desktop" },
  { width: 390, height: 844, name: "mobile" },
]) {
  test("hero and demo remain functional with reduced motion " + viewport.name, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toBeVisible();
    await expect(page.getByRole("button", { name: /Create your CV/ }).first()).toBeVisible();
    await page.locator("#demo").scrollIntoViewIfNeeded();
    const options = page.getByRole("group", { name: "Demo templates" });
    const buttons = options.getByRole("button");
    await expect(buttons.first()).toBeVisible();
    const second = buttons.nth(1);
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await testInfo.attach("REAL-reduced-motion-demo-" + viewport.name, {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(active).toBeTruthy();
  });
}
