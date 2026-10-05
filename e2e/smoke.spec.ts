import { test, expect, stubAI } from "./fixtures";

/**
 * orire smoke suite — exercises the core, launch-critical user journeys with no
 * database, email, OAuth or real AI provider. Every path here is client-side
 * (zustand state + live preview), except the rebrand flow which uses the
 * "continue with this CV" branch so no upload or provider call is needed.
 */

test.describe("app shell & navigation", () => {
  test("loads the workspace with the live preview rendered", async ({ appPage }) => {
    // Default view is the two-pane editor; the right pane renders #cv-paper.
    await expect(appPage.getByRole("heading", { name: "Edit", exact: true })).toBeVisible();
    const paper = appPage.locator("#cv-paper");
    await expect(paper).toBeVisible();
    // Sample CV content is live in the preview.
    await expect(paper).toContainText("Ada Okonkwo");
  });

  test("the rail switches between workspaces", async ({ appPage }) => {
    const nav = appPage.getByRole("navigation", { name: "Workspaces" });

    await nav.getByRole("button", { name: "Export" }).click();
    await expect(appPage.getByRole("heading", { name: "Export", exact: true })).toBeVisible();

    await nav.getByRole("button", { name: "Rate" }).click();
    await expect(appPage.getByRole("heading", { name: "Rate", exact: true })).toBeVisible();

    await nav.getByRole("button", { name: "Connect AI" }).click();
    await expect(appPage.getByRole("heading", { name: "Connect AI", exact: true })).toBeVisible();

    await nav.getByRole("button", { name: "Cover" }).click();
    await expect(appPage.getByRole("heading", { name: "Cover letter", exact: true })).toBeVisible();
  });
});

test.describe("live editing", () => {
  test("editing a field updates the live preview", async ({ appPage }) => {
    const paper = appPage.locator("#cv-paper");
    await expect(paper).toContainText("Ada Okonkwo");

    const name = appPage.getByText("Full name").locator("..").locator("input");
    await name.fill("Grace Hopper");

    // The right-pane preview mirrors the edit immediately.
    await expect(paper).toContainText("Grace Hopper");
    await expect(paper).not.toContainText("Ada Okonkwo");
  });
});

test.describe("re-brand flow", () => {
  test("re-brands the working CV and returns to the editor", async ({ appPage }) => {
    const nav = appPage.getByRole("navigation", { name: "Workspaces" });
    await nav.getByRole("button", { name: "Re-brand" }).click();

    await expect(appPage.getByRole("heading", { name: "Re-brand a CV" })).toBeVisible();

    // Use the existing CV (no upload / no AI needed).
    await appPage.getByRole("button", { name: /Continue with this CV/ }).click();

    await expect(appPage.getByRole("heading", { name: "Choose a look" })).toBeVisible();
    await appPage.getByRole("button", { name: "Apply re-brand" }).click();

    // Applying snapshots the baseline and reopens the editor.
    await expect(appPage.getByRole("heading", { name: "Edit", exact: true })).toBeVisible();
    await expect(appPage.locator("#cv-paper")).toBeVisible();
  });
});

test.describe("export", () => {
  test("the export view exposes a PDF download", async ({ appPage }) => {
    await appPage.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: "Export" }).click();
    await expect(appPage.getByRole("heading", { name: "Export", exact: true })).toBeVisible();
    await expect(appPage.getByRole("button", { name: "Download PDF" })).toBeVisible();
  });
});

test.describe("connect (AI providers)", () => {
  test("lists bring-your-own-key providers and no removed surfaces", async ({ appPage }) => {
    await stubAI(appPage);
    await appPage.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: "Connect AI" }).click();
    await expect(appPage.getByRole("heading", { name: "Connect AI", exact: true })).toBeVisible();

    // Cut features must not reappear in the rail.
    const nav = appPage.getByRole("navigation", { name: "Workspaces" });
    await expect(nav.getByRole("button", { name: "Progress" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Team" })).toHaveCount(0);
  });
});
