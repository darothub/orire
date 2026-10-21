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

    // Decline optional tracking in the test browser, removing the fixed
    // cookie banner without loading analytics or changing production state.
    const consent = page.getByRole("dialog", { name: "Cookie consent" });
    await expect(consent).toBeVisible({ timeout: 10_000 });
    await consent.getByRole("button", { name: "Decline" }).click();
    await expect(consent).toBeHidden();

    // Framer Motion mounts some content only after it enters the viewport.
    // Walk the complete page, rather than jumping to just three anchors, so
    // full-page captures show the real visible end state (not blank sections).
    await page.evaluate(async () => {
      await document.fonts.ready;
      const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const step = Math.max(250, Math.round(window.innerHeight * 0.65));
      const last = document.documentElement.scrollHeight;
      for (let y = 0; y < last; y += step) {
        window.scrollTo(0, y);
        await pause(75);
      }
      window.scrollTo(0, 0);
      await pause(450);
    });

    const dir = "test-results/visual-baseline";
    await page.screenshot({
      path: `${dir}/orire-homepage-${viewport.name}-full.png`,
      fullPage: true,
      animations: "disabled",
    });

    const sections = [
      ["hero", ".landing-hero"],
      ["how", "#how"],
      ["templates", "#templates"],
      ["before-after", ".landing-ba"],
      ["features", ".landing-features"],
      ["demo", "#demo"],
      ["pricing", "#pricing"],
    ] as const;
    for (const [name, selector] of sections) {
      await page.locator(selector).screenshot({
        path: `${dir}/orire-${name}-${viewport.name}.png`,
        animations: "disabled",
      });
    }
    const previewMetrics = await page.locator("#demo").evaluate((root) => {
      const frame = root.querySelector(".landing-demo-frame")?.getBoundingClientRect();
      const page = root.querySelector(".landing-demo-paper")?.getBoundingClientRect();
      return frame && page
        ? {
            frameWidth: frame.width,
            paperWidth: page.width,
            paperRight: page.right,
            frameRight: frame.right,
            horizontallyClipped: page.right > frame.right + 1 || page.left < frame.left - 1,
          }
        : null;
    });
    console.log(`ORIRE_DEMO_BASELINE ${viewport.name}: ${JSON.stringify(previewMetrics)}`);

    // Record a measurable baseline, rather than trusting an illustration.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1
    );
    console.log(`ORIRE_BASELINE ${viewport.name} horizontalOverflow=${overflow}`);
  });
}
