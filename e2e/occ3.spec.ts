import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.0 isolated chat preview", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC feature access is required");

  test("CV-only composer offers general or JD review in conversation with responsive layout", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const decline = page.getByRole("button", { name: "Decline", exact: true });
    // Consent may mount after hydration and otherwise block composer clicks.
    await decline.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await decline.isVisible()) await decline.click();
    const chat = page.getByRole("region", { name: "OCC 3.0 conversation" });
    await expect(page.getByRole("form", { name: "OCC 3.0 composer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Attach document" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select agent" })).toBeVisible();
    await testInfo.attach("occ3-empty-desktop-1440", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await page.getByRole("button", { name: "Attach document" }).click();
    await expect(page.getByRole("button", { name: "Upload CV", exact: true })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: "My_CV.txt", mimeType: "text/plain",
      buffer: Buffer.from("Professional Summary: Experienced nurse providing compassionate clinical care. Work experience: Supporting patients and documenting care plans. Education: Nursing diploma. Skills: Communication, clinical teamwork."),
    });
    await expect(page.getByText("My_CV.txt")).toBeVisible();
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(chat.getByText("I've received your CV.", { exact: false })).toBeVisible();
    await expect(chat.getByRole("button", { name: "General review" })).toBeVisible();

    await page.route("**/api/occ/general-review", async route => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice: { summary: "Your CV communicates nursing experience. Verify any suggested edits.",
          recommendations: [{ requirement: "Clarity of responsibilities", cvEvidence: "Supporting patients and documenting care plans", assessment: "supported", suggestion: "Group responsibilities into clear bullets.", sampleWording: null, question: null }],
          nextSteps: ["Check the clarity of each entry."], disclaimer: "Check every recommendation against your original CV." },
      }) });
    });
    await chat.getByRole("button", { name: "General review" }).click();
    await expect(chat.getByRole("region", { name: "General CV review" })).toBeVisible();
    await expect(chat.getByText("Your CV communicates nursing experience.", { exact: false })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await testInfo.attach("occ3-general-mobile-390", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 320, height: 700 });
    await testInfo.attach("occ3-general-mobile-320", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("JD option requests JD inside chat and automatically launches targeted review on Send", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page); await page.goto("/occ/preview");
    const decline = page.getByRole("button", { name: "Decline", exact: true });
    // Consent may mount after hydration and otherwise block composer clicks.
    await decline.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await decline.isVisible()) await decline.click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "My_CV.txt", mimeType: "text/plain",
      buffer: Buffer.from("Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration."),
    });
    await page.getByRole("button", { name: "Send message" }).click();
    await page.getByRole("button", { name: "I have a job description" }).click();
    await expect(page.getByText("Paste the job description into the chat", { exact: false })).toBeVisible();
    let calls = 0;
    await page.route("**/api/occ/advise", async route => {
      calls++;
      const data = route.request().postDataJSON();
      expect(data.description.toLowerCase()).toContain("responsibilities");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice: { summary: "Your teaching experience may be relevant.", recommendations: [{ requirement: "Lesson planning", cvEvidence: "creating lesson plans", assessment: "supported", suggestion: "Explain your lesson planning process.", sampleWording: null, question: null }], nextSteps: [], disclaimer: "Verify every claim." },
      }) });
    });
    const input = page.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill("We are hiring a secondary teacher. Responsibilities include curriculum development, lesson planning and supporting students in mathematics.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Targeted CV review" })).toBeVisible();
    expect(calls).toBe(1);
  });
});
