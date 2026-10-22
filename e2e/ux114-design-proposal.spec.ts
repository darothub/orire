import { test, expect } from "./fixtures";

/**
 * Screenshot-only before/after visual proposal using real Orire, not a product implementation.
 * The AI provider is intercepted with an adversarial response; no real model,
 * account, credit, payment, SMTP or customer CV is touched.
 */
for (const viewport of [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 720 },
]) {
  test("UX114 authentic Orire before/proposed after " + viewport.name, async ({ appPage }) => {
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

    // Real Orire app screenshot proposal ONLY. CSS is injected in the browser
    // after BEFORE captures. This file does not change any shipped application CSS.
    const positions = [
      ["review-warning", appPage.locator(".rev-ground").first()],
      ["review-actions", appPage.locator(".rev-bulk")],
      ["review-footer", appPage.getByRole("button", { name: "Keep my original CV" })],
    ] as const;
    const capture = async (prefix: string) => {
      for (const [position, target] of positions) {
        await target.scrollIntoViewIfNeeded();
        await appPage.screenshot({
          path: "test-results/ux114-proposal/" + prefix + "-" + viewport.name + "-" + position + ".png",
          fullPage: false,
          animations: "disabled",
        });
      }
    };
    await capture("BEFORE-ACTUAL-Orire");
    const originalPosition = await appPage.locator(".mpane-switch").evaluate(
      (el) => getComputedStyle(el).position,
    );
    expect(originalPosition).toBe("sticky");
    await appPage.addStyleTag({
      content: "@media (max-width: 767px) { .mpane-switch { position: static !important; top: auto !important; z-index: auto !important; } }",
    });
    await expect.poll(() => appPage.locator(".mpane-switch").evaluate(
      (el) => getComputedStyle(el).position,
    )).toBe("static");
    await capture("AFTER-PROPOSED-Orire");
    const htmlWidth = await appPage.evaluate(() => document.documentElement.scrollWidth);
    expect(htmlWidth).toBeLessThanOrEqual(viewport.width + 1);

    // Rejection is a no-op; the editor retains the original sample CV.
    await appPage.getByRole("button", { name: "Keep my original CV" }).click();
    await rail.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(appPage.locator("#cv-paper")).toContainText("Ada Okonkwo");
    await expect(appPage.locator("#cv-paper")).not.toContainText("999%");
    expect(errors).toEqual([]);
  });
}
