import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3 Coach conversation", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");
  const cv = "Professional Summary: Experienced nurse supporting patient care. Work experience: Providing ward handovers, documenting care plans and collaborating with clinical teams. Education: Nursing diploma. Skills: Patient communication and clinical teamwork.";
  const jd = "We are looking for a community nurse. Responsibilities include supporting patients at home, documenting care plans and working with multidisciplinary healthcare teams.";
  async function prepare(page: import("@playwright/test").Page) {
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    const composer = page.getByRole("form", { name: "OCC 3.0 composer" });
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Coach" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "nurse-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv) });
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("What career goal would you like help with?", { exact: false })).toBeVisible();
    return composer;
  }
  test("Coach suggests goals, starts CV-grounded coaching without a JD, and displays next steps inline", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await page.setViewportSize({ width: 1440, height: 900 });
    const composer = await prepare(page);
    const goals = page.getByLabel("Coaching goals");
    await expect(goals.getByRole("button", { name: "Career direction" })).toBeVisible();
    await testInfo.attach("occ3-coach-goal-options-1440", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    let calls = 0;
    await page.route("**/api/occ/coach", async route => {
      calls++;
      const payload = route.request().postDataJSON();
      expect(payload.cv).toContain("nurse");
      expect(payload.goal).toContain("next career step");
      expect(payload.description).toBeUndefined();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice: { summary: "Consider your preferred next care setting.", recommendations: [
          { requirement: "Explore settings", cvEvidence: "documenting care plans", assessment: "supported",
            suggestion: "Compare two community care roles and note the responsibilities that appeal to you.", sampleWording: null,
            question: "Would you prefer ward-based or community work?" },
        ], nextSteps: ["Write down two roles to investigate"], disclaimer: "Verify advice" },
      }) });
    });
    await goals.getByRole("button", { name: "Career direction" }).click();
    const guidance = page.getByRole("region", { name: "Career coaching guidance" });
    await expect(guidance).toContainText("Consider your preferred next care setting.");
    await expect(guidance).toContainText("Explore settings");
    await expect(guidance.getByText("Suggested next steps")).toBeVisible();
    expect(calls).toBe(1);
    await testInfo.attach("occ3-coach-result-1440", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-coach-result-390", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-coach-result-320", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await expect(composer.getByRole("button", { name: "Select agent" })).toContainText("Coach");
  });
  test("Coach accepts an optional JD and routes it to the coaching service, not CV review", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await prepare(page);
    await page.getByLabel("Coaching goals").getByRole("button", { name: "I have a target role" }).click();
    await expect(page.getByText("Share the job description in the composer", { exact: false })).toBeVisible();
    let calls = 0;
    await page.route("**/api/occ/coach", async route => {
      calls++;
      const payload = route.request().postDataJSON();
      expect(payload.description).toContain("Responsibilities");
      expect(payload.goal).toContain("target role");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice: { summary: "Explore responsibilities before applying.", recommendations: [
          { requirement: "Career preparation", cvEvidence: "documenting care plans", assessment: "supported",
            suggestion: "Compare the patient-care responsibilities and ask about training.", sampleWording: null, question: null },
        ], nextSteps: [], disclaimer: "Verify recommendations" },
      }) });
    });
    await composer.getByRole("textbox", { name: "Message Orire Career Copilot" }).fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Career coaching guidance" })).toContainText("Explore responsibilities");
    expect(calls).toBe(1);
  });
  test("unauthorized request is rejected and invalid CV cannot consume coaching", async ({ page, db, e2eUser }) => {
    await signIn(page);
    const forbidden = await page.request.post("/api/occ/coach", { data: { cv, goal: "Career progression" } });
    expect(forbidden.status()).toBe(403);
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const bad = await page.request.post("/api/occ/coach", { data: {
      cv: "We are hiring nurses. Job description: applicants need clinical experience and team communication.",
      goal: "Career progression",
    } });
    expect(bad.status()).toBe(400);
  });
});
