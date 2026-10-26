import { test, expect, signIn, waitForShell } from "./fixtures";

test("UX151 capture implemented Studio after images on desktop and mobile", async ({ page }, testInfo) => {
  for (const viewport of [
    { width: 1440, height: 900, name: "desktop" },
    { width: 390, height: 844, name: "mobile" },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await signIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForShell(page);
    await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your CV studio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Start your first CV|Continue your CV/ })).toBeVisible();
    await testInfo.attach("AFTER-implemented-Studio-" + viewport.name, {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  }
});
