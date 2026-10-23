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
      const samples: number[] = [];
      Object.defineProperty(window, "__orireLayoutShifts", { value: samples });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!shift.hadRecentInput) samples.push(shift.value);
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const shifts = (window as Window & { __orireLayoutShifts?: number[] }).__orireLayoutShifts ?? [];
      return {
        url: location.pathname,
        viewport: { width: innerWidth, height: innerHeight },
        navigationMs: Math.round(navigation?.duration ?? 0),
        domInteractiveMs: Math.round(navigation?.domInteractive ?? 0),
        transferBytes: navigation?.transferSize ?? 0,
        layoutShiftScore: Number(shifts.reduce((sum, value) => sum + value, 0).toFixed(4)),
      };
    });
    expect(metrics.navigationMs).toBeGreaterThanOrEqual(0);
    expect(metrics.layoutShiftScore).toBeGreaterThanOrEqual(0);
    await testInfo.attach(`landing-metrics-${viewport.label}.json`, {
      body: Buffer.from(JSON.stringify(metrics, null, 2)),
      contentType: "application/json",
    });
  });
}
