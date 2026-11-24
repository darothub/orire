import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.5.1 contextual next actions", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC access required");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const advice = { summary: "Review your existing experience.", recommendations: [], nextSteps: [], disclaimer: "Verify all suggestions." };

  test("Review continues to Coach and Coach continues to Interview inside conversation", async ({ page, db, e2eUser }, testInfo) => {
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
    await page.route("**/api/occ/coach", async route => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ advice }) });
    });
    await page.getByRole("button", { name: "General review" }).click();
    const review = page.getByRole("region", { name: "General CV review" });
    await expect(review.getByRole("button", { name: "Continue with Coach" })).toBeVisible();
    await testInfo.attach("occ3-review-next-action-desktop", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-review-next-action-mobile", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });

    await review.getByRole("button", { name: "Continue with Coach" }).click();
    await expect(page.getByRole("button", { name: "Career direction" })).toBeVisible();
    await expect(review.getByRole("button", { name: "Continue with Coach" })).toHaveCount(0);
    await page.getByRole("button", { name: "Career direction" }).click();
    const coaching = page.getByRole("region", { name: "Career coaching guidance" });
    await expect(coaching.getByRole("button", { name: "Practise with Interview" })).toBeVisible();
    await coaching.getByRole("button", { name: "Practise with Interview" }).click();
    await expect(page.getByText("Interview selected. Paste or attach the target job description to begin.")).toBeVisible();
    await expect(coaching.getByRole("button", { name: "Practise with Interview" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Select agent" })).toContainText("Interview");
  });
});
