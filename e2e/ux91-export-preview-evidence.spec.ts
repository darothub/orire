import { expect, test } from "@playwright/test";

/**
 * UX91 public preview/export-confidence baseline, isolated from real accounts.
 * This is not a claim that downloadable sample assets already exist.
 */
for (const viewport of [
  { width: 1440, height: 900, name: "desktop" },
  { width: 390, height: 844, name: "mobile" },
]) {
  test("anonymous visitor can inspect an actual fictional CV preview " + viewport.name, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    const response = await page.goto("/templates", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "CV templates", exact: true })).toBeVisible();
    await testInfo.attach("BEFORE-actual-templates-" + viewport.name, {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await page.getByRole("link", { name: /Aurora/i }).first().click();
    await expect(page).toHaveURL(/\/templates\/aurora$/);
    await expect(page.getByRole("heading", { name: "Aurora CV template" })).toBeVisible();
    await expect(page.locator(".tpl-detail-preview-paper")).toBeVisible();
    await testInfo.attach("BEFORE-actual-aurora-" + viewport.name, {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  });
}
