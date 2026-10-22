import { test, expect } from "./fixtures";

/**
 * Genuine Orire UI review state, in the CI-local signed fake session.
 * The AI provider is intercepted with an adversarial response; no real model,
 * account, credit, payment, SMTP or customer CV is touched.
 */
for (const viewport of [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 720 },
]) {
  test("UX85 suspicious AI edits require explicit review " + viewport.name, async ({ appPage }) => {
    const errors: string[] = [];
    appPage.on("pageerror", (error) => errors.push(error.message));
    await appPage.setViewportSize({ width: viewport.width, height: viewport.height });
    await appPage.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    // The real consent dialog is positioned over the review footer; dismiss it
    // before navigating. This also leaves screenshots unobstructed.
    const consent = appPage.getByRole("dialog", { name: "Cookie consent" });
    await expect(consent).toBeVisible({ timeout: 15_000 });
    await consent.getByRole("button", { name: "Decline" }).click();
    await expect(consent).toBeHidden();

    await appPage.route("**/api/ai/refine", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          provider: "openai",
          model: "gpt-5-mini",
          raw: JSON.stringify({
            summary: "Experienced product designer improving accessible interfaces.",
            experience: [
              { ref: 0, role: "Invented CEO", highlights: ["Increased revenue by 999% and managed 5000 employees."] },
              { ref: 999, role: "Invented employer", highlights: ["Never happened."] },
            ],
          }),
        }),
      });
    });

    const rail = appPage.getByRole("navigation", { name: "Workspaces" });
    await rail.getByRole("button", { name: "Refine", exact: true }).click();
    await expect(appPage.getByRole("heading", { name: "Refine to a job" })).toBeVisible();

    await appPage.locator(".conn-card").first().getByRole("button", { name: "Select", exact: true }).click();
    await appPage.getByRole("button", { name: "Continue", exact: true }).click();
    await appPage.getByRole("button", { name: "Try with sample CV" }).click();
    await appPage.locator("textarea.ai-jd").fill(
      "Hiring a product designer with experience improving accessibility and user interfaces.",
    );
    // Framer Motion may leave the previous step in the DOM during its exit
    // transition. Scope Continue to the active job-description step.
    await appPage.locator(".refine-step").filter({
      has: appPage.locator("textarea.ai-jd"),
    }).getByRole("button", { name: "Continue", exact: true }).click();
    await appPage.getByRole("button", { name: "Refine my CV" }).click();

    await expect(appPage.getByRole("button", { name: /Review & apply/ })).toBeVisible({ timeout: 15_000 });
    await expect(appPage.locator(".cmp-flags")).toContainText("999%");
    await appPage.getByRole("button", { name: /Review & apply/ }).click();

    await expect(appPage.getByText("Review OpenAI (ChatGPT)’s changes")).toBeVisible();
    await expect(appPage.locator(".rev-bulk")).toContainText("0 of");
    await expect(appPage.locator(".rev-ground")).toContainText("Review required");
    await expect(appPage.getByText(/possible unsupported detail/)).toBeVisible();
    await expect(appPage.getByRole("button", { name: "Keep my original CV" })).toBeVisible();
    const allChanges = appPage.locator(".rev-change");
    expect(await allChanges.count()).toBeGreaterThan(0);
    const toggles = appPage.locator(".rev-toggle");
    for (let i = 0; i < await toggles.count(); i++) {
      await expect(toggles.nth(i)).toHaveAttribute("aria-pressed", "false");
    }

    const path = "test-results/ux85-review/";
    await appPage.screenshot({
      path: path + "AFTER-actual-AI-review-default-reject-" + viewport.name + ".png",
      animations: "disabled",
    });
    await appPage.locator(".rev").screenshot({
      path: path + "AFTER-actual-AI-review-panel-" + viewport.name + ".png",
      animations: "disabled",
    });

    // UX114: full-viewport evidence at natural scroll positions. Never use an
    // element screenshot to diagnose sticky UI: it may stitch scroll positions.
    if (viewport.width <= 390) {
      const paneSwitch = appPage.locator(".mpane-switch");
      await expect(paneSwitch).toBeVisible();
      for (const [position, target] of [
        ["review-warning", appPage.locator(".rev-ground").first()],
        ["review-actions", appPage.locator(".rev-bulk")],
        ["review-footer", appPage.getByRole("button", { name: "Keep my original CV" })],
      ] as const) {
        await target.scrollIntoViewIfNeeded();
        await appPage.screenshot({
          path: "test-results/ux114-viewport/BEFORE-ACTUAL-Orire-" + viewport.name + "-" + position + ".png",
          animations: "disabled",
          fullPage: false,
        });
        // Record geometry of the actual viewport rather than falsely claiming
        // an overlay based on stitched component screenshots.
        const geometry = await appPage.evaluate(() => {
          const switcher = document.querySelector(".mpane-switch");
          const warning = document.querySelector(".rev-ground");
          const actions = document.querySelector(".rev-bulk");
          const footer = document.querySelector(".rev-foot");
          const rect = (el: Element | null) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
          };
          return { switcher: rect(switcher), warning: rect(warning), actions: rect(actions), footer: rect(footer) };
        });
        test.info().annotations.push({
          type: "ux114-viewport-geometry-" + position,
          description: JSON.stringify(geometry),
        });
      }
      const htmlWidth = await appPage.evaluate(() => document.documentElement.scrollWidth);
      expect(htmlWidth).toBeLessThanOrEqual(viewport.width + 1);
    }

    // Rejection is a no-op; the editor retains the original sample CV.
    await appPage.getByRole("button", { name: "Keep my original CV" }).click();
    await rail.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(appPage.locator("#cv-paper")).toContainText("Ada Okonkwo");
    await expect(appPage.locator("#cv-paper")).not.toContainText("999%");
    expect(errors).toEqual([]);
  });
}
