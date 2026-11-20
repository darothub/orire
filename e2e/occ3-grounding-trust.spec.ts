import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.1.4 grounded response trust cues", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";

  test("Review distinguishes verified CV quotes from unsupported suggestions inside conversation", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();

    const composer = page.getByRole("form", { name: "OCC 3.0 composer" });
    await page.locator('input[type="file"]').setInputFiles({ name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv) });
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("button", { name: "General review" })).toBeVisible();

    await page.route("**/api/occ/general-review", async route => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice: { summary: "Review your evidence carefully.", recommendations: [
          { requirement: "Teaching experience", cvEvidence: "Teaching mathematics to secondary school students", assessment: "supported",
            suggestion: "Consider clarifying your teaching duties.", sampleWording: null, question: null },
          { requirement: "Measured outcomes", cvEvidence: null, assessment: "needs-clarification",
            suggestion: "Only add a metric if you can verify it.", sampleWording: null, question: "What results did you observe?" },
        ], nextSteps: [], disclaimer: "Verify everything." },
      }) });
    });

    await page.getByRole("button", { name: "General review" }).click();
    const result = page.getByRole("region", { name: "General CV review" });
    await expect(result).toContainText("Reviewed against your CV, without a job description.");
    const supported = result.getByText("Teaching experience").locator("..");
    await expect(supported).toContainText("From your CV");
    const missing = result.getByText("Measured outcomes").locator("..");
    await expect(missing).toContainText("Needs clarification");
    await supported.click();
    await missing.click();
    await expect(result.getByText("Teaching mathematics to secondary school students", { exact: false })).toBeVisible();
    await expect(result.getByText("No supporting CV quote was verified", { exact: false })).toBeVisible();
    await expect(result.getByText("Suggestion:", { exact: false })).toHaveCount(2);
    await testInfo.attach("occ3-grounding-review-desktop-1440", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-grounding-review-mobile-390", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
  });
});
