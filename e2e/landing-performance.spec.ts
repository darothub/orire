import { expect, test } from "@playwright/test";

/**
 * UX93 measurement-only baseline. Captures browser metrics for the real
 * unauthenticated landing page without imposing arbitrary timing thresholds.
 * Run with the existing production-build Playwright webServer configuration.
 */
for (const viewport of [
  { width: 390, height: 844, label: "mobile-390" },
  { width: 1440, height: 900, label: "desktop-1440" },
]) {
  test(`landing performance baseline ${viewport.label}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      const samples: { value: number; startTime: number }[] = [];
      Object.defineProperty(window, "__orireLayoutShifts", { value: samples });
      Object.defineProperty(window, "__orireLCP", { value: { ms: 0 } });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!shift.hadRecentInput) samples.push({ value: shift.value, startTime: shift.startTime });
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) (window as Window & { __orireLCP?: { ms: number } }).__orireLCP!.ms = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Record late font/image/component layout shifts, not just those before load.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const shifts = (window as Window & { __orireLayoutShifts?: { value: number; startTime: number }[] }).__orireLayoutShifts ?? [];
      let cls = 0, sessionScore = 0, sessionStart = 0, previousShift = 0;
      for (const shift of shifts) {
        if (!sessionScore || shift.startTime - previousShift > 1000 || shift.startTime - sessionStart > 5000) {
          sessionScore = shift.value;
          sessionStart = shift.startTime;
        } else {
          sessionScore += shift.value;
        }
        previousShift = shift.startTime;
        cls = Math.max(cls, sessionScore);
      }
      return {
        url: location.pathname,
        viewport: { width: innerWidth, height: innerHeight },
        navigationMs: Math.round(navigation?.duration ?? 0),
        domInteractiveMs: Math.round(navigation?.domInteractive ?? 0),
        transferBytes: navigation?.transferSize ?? 0,
        layoutShiftScore: Number(cls.toFixed(4)),
        observedLcpMs: Math.round((window as Window & { __orireLCP?: { ms: number } }).__orireLCP?.ms ?? 0),
        resourcesLoaded: performance.getEntriesByType("resource").length,
      };
    });
    expect(metrics.navigationMs).toBeGreaterThanOrEqual(0);
    expect(metrics.layoutShiftScore).toBeGreaterThanOrEqual(0);
    expect(metrics.observedLcpMs).toBeGreaterThanOrEqual(0);
    await testInfo.attach(`landing-metrics-${viewport.label}.json`, {
      body: Buffer.from(JSON.stringify(metrics, null, 2)),
      contentType: "application/json",
    });
  });
}
