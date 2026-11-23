import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.3.2 Review and Coach recovery", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");

  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const advice = {
    summary: "Use evidence from your CV when describing your experience.",
    recommendations: [],
    nextSteps: [],
    disclaimer: "Verify all suggested claims.",
  };

  async function ready(page: import("@playwright/test").Page) {
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv),
    });
    await page.getByRole("button", { name: "Send message" }).click();
  }

  test("Review retries the exact failed request without creating a duplicate user turn", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await ready(page);
    let calls = 0;
    const bodies: unknown[] = [];
    await page.route("**/api/occ/general-review", async route => {
      calls++;
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: calls === 1 ? 503 : 200, contentType: "application/json",
        body: JSON.stringify(calls === 1 ? { error: "Review temporarily unavailable." } : { advice }),
      });
    });
    await page.getByRole("button", { name: "General review" }).click();
    const retry = page.getByRole("button", { name: "Retry review request" });
    await expect(page.getByRole("alert")).toContainText("Review temporarily unavailable.");
    await expect(retry).toBeVisible();
    await testInfo.attach("occ3-review-retry-desktop-1440", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-review-retry-mobile-390", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await retry.click();
    await expect(page.getByRole("region", { name: "General CV review" })).toContainText(advice.summary);
    await expect(retry).toHaveCount(0);
    expect(calls).toBe(2);
    expect(bodies[0]).toEqual(bodies[1]);
    await expect(page.locator(".occ3-you .occ3-message-content").getByText("General review", { exact: true })).toHaveCount(1);
  });

  test("Coach retries the same career goal and clears recovery after successful guidance", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await ready(page);
    await page.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: /Coach/ }).click();
    let calls = 0;
    const bodies: unknown[] = [];
    await page.route("**/api/occ/coach", async route => {
      calls++;
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: calls === 1 ? 503 : 200, contentType: "application/json",
        body: JSON.stringify(calls === 1 ? { error: "Coaching temporarily unavailable." } : { advice }),
      });
    });
    await page.getByRole("button", { name: "Career direction" }).click();
    const retry = page.getByRole("button", { name: "Retry coaching request" });
    await expect(page.getByRole("alert")).toContainText("Coaching temporarily unavailable.");
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(page.getByRole("region", { name: "Career coaching guidance" })).toContainText(advice.summary);
    await expect(retry).toHaveCount(0);
    expect(calls).toBe(2);
    expect(bodies[0]).toEqual(bodies[1]);
    await expect(page.locator(".occ3-you .occ3-message-content").getByText("Help me plan my next career step", { exact: true })).toHaveCount(1);
  });
});
