import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.4.5 conversation responsiveness baseline", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC access required");

  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";

  test("measure composer responsiveness during an active review on desktop and mobile", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv),
    });
    await page.getByRole("button", { name: "Send message" }).click();

    let started = () => {};
    let release = () => {};
    const requestStarted = new Promise<void>(resolve => { started = resolve; });
    const requestGate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/occ/general-review", async route => {
      started();
      await requestGate;
      await route.fulfill({
        status: 503, contentType: "application/json",
        body: JSON.stringify({ error: "Baseline synthetic failure." }),
      }).catch(() => {});
    });

    // Collect browser-side Long Tasks without prescribing a speed threshold from
    // CI hardware. Results are diagnostic measurements, not benchmark pass claims.
    await page.evaluate(() => {
      (window as typeof window & { __occLongTasks?: number[] }).__occLongTasks = [];
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            (window as typeof window & { __occLongTasks?: number[] }).__occLongTasks?.push(entry.duration);
          }
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // Long Task API is optional in browsers; report unsupported if absent.
      }
    });

    await page.getByRole("button", { name: "General review" }).click();
    await requestStarted;
    await expect(page.getByTestId("occ3-processing")).toBeVisible();
    const input = page.getByRole("textbox", { name: "Message Orire Career Copilot" });
    const samples: Array<{ width: number; inputLatencyMs: number; longTasks: number[] | null; horizontalOverflow: boolean }> = [];

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const text = "Draft remains editable during progress at viewport " + width;
      const start = Date.now();
      await input.fill(text);
      await expect(input).toHaveValue(text);
      const elapsed = Date.now() - start;
      const metrics = await page.evaluate(() => ({
        longTasks: (window as typeof window & { __occLongTasks?: number[] }).__occLongTasks ?? null,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      }));
      samples.push({ width, inputLatencyMs: elapsed, ...metrics });
      expect(metrics.horizontalOverflow).toBe(false);
      await testInfo.attach(`occ3-performance-active-request-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: "disabled" }),
        contentType: "image/png",
      });
    }

    await testInfo.attach("occ3-composer-responsiveness-baseline", {
      body: Buffer.from(JSON.stringify({
        description: "Single-run CI diagnostic (not a statistically valid latency benchmark)",
        environment: testInfo.project.name,
        samples,
      }, null, 2)),
      contentType: "application/json",
    });

    await page.getByRole("button", { name: "Stop response" }).click();
    release();
    await expect(page.getByTestId("occ3-processing")).toHaveCount(0);
    await expect(input).toHaveValue("Draft remains editable during progress at viewport 320");
  });
});
