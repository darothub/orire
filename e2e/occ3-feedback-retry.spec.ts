import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.3 interview feedback recovery", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const jd = "We are hiring a secondary teacher. Responsibilities include curriculum development, lesson planning, and helping students with mathematics.";
  const answer = "I explain new topics using examples to help students understand and practise in class.";

  test("failed feedback can retry the same answer once without duplicate bubbles", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();

    const composer = page.getByRole("form", { name: "OCC 3.0 composer" });
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Interview" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv),
    });
    await composer.getByRole("button", { name: "Send message" }).click();

    let feedbackCalls = 0;
    const receivedAnswers: string[] = [];
    await page.route("**/api/occ/interview", async route => {
      const request = route.request().postDataJSON();
      if (request.mode === "question") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          question: { question: "How do you explain difficult maths topics?", focus: "Teaching approach", answerStarters: [] },
        }) });
        return;
      }
      feedbackCalls++;
      receivedAnswers.push(request.answer);
      if (feedbackCalls === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Feedback temporarily unavailable." }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          feedback: { strength: "Clear classroom example.", improvement: "Give more detail.", followUp: "How did you check understanding?", betterWording: answer, whyBetter: "Clearer wording.", wordingStatus: "grounded" },
        }) });
      }
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Interview question 1" })).toBeVisible();
    await input.fill(answer);
    await composer.getByRole("button", { name: "Send message" }).click();

    const retry = page.getByRole("button", { name: "Retry feedback for this answer" });
    await expect(page.getByRole("alert")).toContainText("Feedback temporarily unavailable.");
    await expect(retry).toBeVisible();
    await expect(page.locator(".occ3-you .occ3-message-content").getByText(answer, { exact: true })).toHaveCount(1);
    await testInfo.attach("occ3-feedback-retry-desktop-1440", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-feedback-retry-mobile-390", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await retry.click();
    await expect(page.getByRole("region", { name: "Interview feedback 1" })).toContainText("Clear classroom example.");
    await expect(retry).toHaveCount(0);
    expect(feedbackCalls).toBe(2);
    expect(receivedAnswers).toEqual([answer, answer]);
    await expect(page.locator(".occ3-you .occ3-message-content").getByText(answer, { exact: true })).toHaveCount(1);
  });
});
