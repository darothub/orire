import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.3.3 interrupted response isolation", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const advice = { summary: "Review your evidence carefully.", recommendations: [], nextSteps: [], disclaimer: "Verify everything." };

  test("stopping a Review request prevents stale results and preserves retry context", async ({ page, db, e2eUser }, testInfo) => {
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
    const requests: string[] = [];
    const firstResponse = { release: () => {} };
    await page.route("**/api/occ/general-review", async route => {
      requests.push(route.request().postData() ?? "");
      if (requests.length === 1) {
        // Hold the first response until explicitly released after Stop.
        await new Promise<void>(resolve => { firstResponse.release = resolve; });
        try {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ advice }) });
        } catch { /* The browser already aborted this request. */ }
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ advice }) });
      }
    });
    await page.getByRole("button", { name: "General review" }).click();
    const stop = page.getByRole("button", { name: "Stop response" });
    await expect(stop).toBeVisible();
    await testInfo.attach("occ3-stop-review-desktop-1440", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-stop-review-mobile-390", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await stop.click();
    firstResponse.release();
    await expect(page.getByRole("alert")).toContainText("Response stopped");
    await expect(page.getByRole("region", { name: "General CV review" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry review request" })).toBeVisible();
    await page.getByRole("button", { name: "Retry review request" }).click();
    await expect(page.getByRole("region", { name: "General CV review" })).toContainText(advice.summary);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toBe(requests[1]);
    await expect(page.locator(".occ3-you .occ3-message-content").getByText("General review", { exact: true })).toHaveCount(1);
  });
});
