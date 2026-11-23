import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.4.2 conversation animations", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";

  async function setup(page: import("@playwright/test").Page) {
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv),
    });
    await page.getByRole("button", { name: "Send message" }).click();
  }

  test("assistant and review content animate in-place without hiding functional controls", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await page.setViewportSize({ width: 1440, height: 900 });
    await setup(page);
    await expect(page.getByRole("button", { name: "General review" })).toBeVisible();
    const initialMotion = await page.locator(".occ3-occ").last().evaluate(element => getComputedStyle(element).animationName);
    expect(initialMotion).toContain("occ3-assistant-arrive");
    await page.route("**/api/occ/general-review", async route => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice: { summary: "Evidence-based review of your teaching experience.", recommendations: [], nextSteps: [], disclaimer: "Verify recommendations." },
      }) });
    });
    await page.getByRole("button", { name: "General review" }).click();
    const review = page.getByRole("region", { name: "General CV review" });
    await expect(review).toContainText("Evidence-based review");
    expect(await review.evaluate(element => getComputedStyle(element).animationName)).toContain("occ3-card-reveal");
    await testInfo.attach("occ3-342-desktop-1440", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(review).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-342-mobile-390", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
  });

  test("prefers-reduced-motion removes assistant and card entrance animations", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setup(page);
    await expect(page.getByRole("button", { name: "General review" })).toBeVisible();
    expect(await page.locator(".occ3-occ").last().evaluate(element => getComputedStyle(element).animationName)).toBe("none");
    expect(await page.locator(".occ3-choices").last().evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  });
});
