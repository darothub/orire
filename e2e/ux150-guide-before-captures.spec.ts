import { test, expect } from "@playwright/test";

const guides = [
  "tailor-cv-to-job-description",
  "quantify-achievements-on-your-cv",
  "beat-applicant-tracking-systems-ats",
] as const;

test("UX150 capture actual public guide baselines on desktop and mobile", async ({ page }, testInfo) => {
  for (const viewport of [
    { width: 1440, height: 900, name: "desktop" },
    { width: 390, height: 844, name: "mobile" },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    for (const slug of guides) {
      const response = await page.goto("/guides/" + slug, { waitUntil: "load" });
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.screenshot({
        path: "test-results/ux150-before/BEFORE-actual-" + slug + "-" + viewport.name + ".png",
        fullPage: true,
        animations: "disabled",
      });
      await testInfo.attach("BEFORE-actual-" + slug + "-" + viewport.name, {
        body: await page.screenshot({ fullPage: true, animations: "disabled" }),
        contentType: "image/png",
      });
    }
  }
});
