import { test, expect, signIn, waitForShell } from "./fixtures";

test("UX151 capture actual authenticated Studio baselines on desktop and mobile", async ({ page }, testInfo) => {
  for (const viewport of [
    { width: 1440, height: 900, name: "desktop" },
    { width: 390, height: 844, name: "mobile" },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await signIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForShell(page);
    // Capture the real initial Studio only after its standard first-run tour
    // has been dismissed; no production identity or real CV is used.
    const tour = page.getByRole("dialog", { name: "Getting started tour" });
    if (await tour.isVisible().catch(() => false)) {
      await tour.getByRole("button", { name: "Skip" }).click();
    }
    await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
    await testInfo.attach("BEFORE-actual-Studio-" + viewport.name, {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  }
});
