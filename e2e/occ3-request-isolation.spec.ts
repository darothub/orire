import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.3.3 interrupted requests and agent isolation", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const advice = { summary: "This response must not leak into a different conversation.", recommendations: [], nextSteps: [], disclaimer: "Verify claims." };

  async function prepare(page: import("@playwright/test").Page) {
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv) });
    await page.getByRole("button", { name: "Send message" }).click();
  }

  test("agent switch interrupts an in-flight review without leaking its response", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await prepare(page);
    let release: (() => void) | undefined;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    let requestStarted: (() => void) | undefined;
    const started = new Promise<void>(resolve => { requestStarted = resolve; });
    await page.route("**/api/occ/general-review", async route => {
      requestStarted?.();
      await waiting;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ advice }) }).catch(() => {});
    });
    await page.getByRole("button", { name: "General review" }).click();
    await started;
    await page.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: /Coach/ }).click();
    await expect(page.getByText("Coach selected.", { exact: false })).toBeVisible();
    release?.();
    await expect(page.getByRole("region", { name: "General CV review" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry review request" })).toHaveCount(0);
    await expect(page.getByTestId("occ3-processing")).toHaveCount(0);
    await testInfo.attach("occ3-agent-interruption-desktop-1440", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-agent-interruption-mobile-390", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
  });

  test("new chat aborts an in-flight Coach request and remains empty", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await prepare(page);
    await page.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: /Coach/ }).click();
    let release: (() => void) | undefined;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    let requestStarted: (() => void) | undefined;
    const started = new Promise<void>(resolve => { requestStarted = resolve; });
    await page.route("**/api/occ/coach", async route => {
      requestStarted?.();
      await waiting;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ advice }) }).catch(() => {});
    });
    await page.getByRole("button", { name: "Career direction" }).click();
    await started;
    await page.getByRole("button", { name: /New chat/ }).click();
    release?.();
    await expect(page.getByText("Start by attaching your CV using the paperclip below.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Career coaching guidance" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry coaching request" })).toHaveCount(0);
    await expect(page.getByTestId("occ3-processing")).toHaveCount(0);
  });
});
