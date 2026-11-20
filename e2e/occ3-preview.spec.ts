import { test, expect, signIn } from "./fixtures";
import { sampleCV } from "../src/lib/cv/sample";

test.describe("OCC 3.0 preview integration safeguards", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC access required");

  test("saved CV, compact agent selector, and no AI request on switching agents", async ({ page, db, e2eUser }, testInfo) => {
    const saved = await db.document.create({ data: {
      userId: e2eUser.id, title: "My saved Orire CV", template: "aurora",
      data: JSON.parse(JSON.stringify(sampleCV)),
    } });
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    // The banner can mount after initial hydration; do not race its visibility.
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();

    const composer = page.getByRole("form", { name: "OCC 3.0 composer" });
    await composer.getByRole("button", { name: "Attach document" }).click();
    await expect(page.getByRole("button", { name: "Choose: My saved Orire CV" })).toBeVisible();
    await testInfo.attach("occ3-saved-cv-menu-desktop-1440", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await page.getByRole("button", { name: "Choose: My saved Orire CV" }).click();
    await expect(composer).toContainText("My saved Orire CV");

    let analysisCalls = 0;
    await page.route("**/api/occ/general-review", async route => { analysisCalls++; await route.abort(); });
    await page.route("**/api/occ/advise", async route => { analysisCalls++; await route.abort(); });
    const selector = composer.getByRole("button", { name: "Select agent" });
    await selector.click();
    await expect(page.getByRole("listbox", { name: "OCC agents" })).toBeVisible();
    await page.getByRole("option", { name: "Coach" }).click();
    await expect(selector).toContainText("Coach");
    expect(analysisCalls).toBe(0);
    await selector.click();
    await page.getByRole("option", { name: "Review" }).click();
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("button", { name: "General review" })).toBeVisible();
    expect(analysisCalls).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-saved-cv-mobile-390", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-saved-cv-mobile-320", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    expect(saved.id).toBeTruthy();
  });


  test("Review agent sends typed review focus to the analysis endpoint", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();

    const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
    await page.locator('input[type="file"]').setInputFiles({ name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv) });
    const composer = page.getByRole("form", { name: "OCC 3.0 composer" });
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("button", { name: "General review" })).toBeVisible();

    let requestBody: Record<string, unknown> | null = null;
    await page.route("**/api/occ/general-review", async route => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ advice: { summary: "Focused review", recommendations: [], nextSteps: [] } }),
      });
    });
    const focus = "Focus on whether my achievements and impact are communicated clearly.";
    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(focus);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Here's your general CV review.")).toBeVisible();
    expect(requestBody?.focus).toBe(focus);
  });

  test("general CV review rejects a job advert masquerading as a CV", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    const response = await page.request.post("/api/occ/general-review", {
      data: { cv: "We are looking for a senior manager. Job description: candidates must have strong communication skills and professional experience." },
    });
    expect(response.status()).toBe(400);
  });
});
