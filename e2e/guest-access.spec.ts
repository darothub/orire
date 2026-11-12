import { test, expect } from "./fixtures";

test.describe("guest access", () => {
  test("guest can open the editor, and AI/export prompt sign-up with a reason", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try as guest" }).click();

    const rail = page.getByRole("navigation", { name: "Workspaces" });
    await expect(rail).toBeVisible({ timeout: 30_000 });

    await rail.getByRole("button", { name: "Tailor", exact: true }).click();
    await page.getByRole("button", { name: "Open Rewrite" }).click();
    const dialog = page.getByRole("dialog", { name: "Create your account" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Sign up to refine your CV with AI");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(page.getByRole("dialog", { name: "Create your account" })).toContainText(
      "Sign up to export your CV",
    );
  });
});
