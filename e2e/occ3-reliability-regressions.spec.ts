import { test, expect, signIn } from "./fixtures";

/**
 * OCC 3.3.4 cross-flow regression: deliberately delayed responses must never
 * enter the wrong conversation or overwrite a newer, successful retry.
 */
test.describe("OCC 3.3.4 reliability regression suite", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");

  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const jd = "We are hiring a secondary teacher. Responsibilities include curriculum development, lesson planning, and helping students with mathematics.";
  const answer = "I explain new topics using examples to help students understand and practise in class.";
  const advice = (summary: string) => ({ summary, recommendations: [], nextSteps: [], disclaimer: "Verify all claims." });

  async function setup(page: import("@playwright/test").Page, agent: "review" | "interview") {
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    if (agent === "interview") {
      await page.getByRole("button", { name: "Select agent" }).click();
      await page.getByRole("option", { name: "Interview" }).click();
    }
    await page.locator('input[type="file"]').setInputFiles({
      name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv),
    });
    await page.getByRole("button", { name: "Send message" }).click();
  }

  test("stop an in-flight review, retry exactly once and ignore its delayed stale response", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await setup(page, "review");
    let calls = 0;
    let releaseOld = () => {};
    let startedOld = () => {};
    const oldGate = new Promise<void>(resolve => { releaseOld = resolve; });
    const oldStarted = new Promise<void>(resolve => { startedOld = resolve; });
    const payloads: unknown[] = [];
    await page.route("**/api/occ/general-review", async route => {
      calls++;
      const call = calls;
      payloads.push(route.request().postDataJSON());
      if (call === 1) {
        startedOld();
        await oldGate;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ advice: advice("STALE RESPONSE — must never appear") }) }).catch(() => {});
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ advice: advice("Fresh, recovered review.") }) });
      }
    });
    await page.getByRole("button", { name: "General review" }).click();
    await oldStarted;
    await page.getByRole("button", { name: "Stop response" }).click();
    const retry = page.getByRole("button", { name: "Retry review request" });
    await expect(page.getByRole("alert")).toContainText("Response stopped.");
    await expect(retry).toBeVisible();
    await testInfo.attach("occ3-stopped-review-desktop", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-stopped-review-mobile", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await retry.click();
    await expect(page.getByRole("region", { name: "General CV review" })).toContainText("Fresh, recovered review.");
    releaseOld();
    await expect(page.getByText("STALE RESPONSE — must never appear")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "General CV review" })).toHaveCount(1);
    await expect(page.locator(".occ3-you .occ3-message-content").getByText("General review", { exact: true })).toHaveCount(1);
    expect(calls).toBe(2);
    expect(payloads[0]).toEqual(payloads[1]);
  });

  test("late interview feedback after New chat cannot contaminate the new conversation", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await setup(page, "interview");
    let releaseFeedback = () => {};
    let feedbackStarted = () => {};
    const gate = new Promise<void>(resolve => { releaseFeedback = resolve; });
    const started = new Promise<void>(resolve => { feedbackStarted = resolve; });
    await page.route("**/api/occ/interview", async route => {
      const request = route.request().postDataJSON();
      if (request.mode === "question") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          question: { question: "How do you explain difficult maths topics?", focus: "Teaching approach", answerStarters: [] },
        }) });
      } else {
        feedbackStarted();
        await gate;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          feedback: { strength: "LATE FEEDBACK — must be discarded", improvement: "Review examples.", followUp: "What worked?" },
        }) }).catch(() => {});
      }
    });
    const composer = page.getByRole("form", { name: "OCC 3.0 composer" });
    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Interview question 1" })).toBeVisible();
    await input.fill(answer);
    await composer.getByRole("button", { name: "Send message" }).click();
    await started;
    await page.getByRole("button", { name: /New chat/ }).click();
    releaseFeedback();
    await expect(page.getByText("Start by attaching your CV using the paperclip below.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Interview feedback 1" })).toHaveCount(0);
    await expect(page.getByText("LATE FEEDBACK — must be discarded")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry feedback for this answer" })).toHaveCount(0);
    await expect(page.getByTestId("occ3-processing")).toHaveCount(0);
  });
});
