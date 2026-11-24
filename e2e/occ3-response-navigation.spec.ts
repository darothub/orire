import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.5.2 response navigation", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC access required");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const advice = {
    summary: "Three things to review in your experience.",
    recommendations: [
      { requirement: "Explain teaching impact", suggestion: "Describe how you checked learning.", assessment: "unclear", question: "What changed?" },
      { requirement: "Clarify planning process", suggestion: "Use actual lesson-plan examples.", assessment: "unclear", question: "What did you plan?" },
      { requirement: "Show collaboration", suggestion: "Mention real teamwork.", assessment: "unclear", question: "Who did you work with?" },
    ],
    nextSteps: ["Identify examples you can verify."],
    disclaimer: "Verify suggestions before applying.",
  };

  test("long Review response expands and collapses all sections without leaving chat", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv) });
    await page.getByRole("button", { name: "Send message" }).click();
    await page.route("**/api/occ/general-review", async route => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ advice }) });
    });
    await page.getByRole("button", { name: "General review" }).click();
    const review = page.getByRole("region", { name: "General CV review" });
    const sections = review.locator("details");
    await expect(sections).toHaveCount(4);
    const controls = review.getByRole("group", { name: "Navigate response sections" });
    await expect(controls).toContainText("3 recommendations + next steps");
    await expect(review.locator("details[open]")).toHaveCount(0);

    await controls.getByRole("button", { name: "Expand all" }).click();
    await expect(review.locator("details[open]")).toHaveCount(4);
    await testInfo.attach("occ3-review-expanded-desktop-1440", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-review-expanded-mobile-390", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await controls.getByRole("button", { name: "Collapse all" }).click();
    await expect(review.locator("details[open]")).toHaveCount(0);
    await expect(review.getByRole("button", { name: "Continue with Coach" })).toBeVisible();
  });
});
