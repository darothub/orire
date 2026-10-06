import { test, expect, stubAI, signIn } from "./fixtures";
import { test as rawTest } from "@playwright/test";

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

test.describe("theme", () => {
  test("toggles the theme and persists the choice", async ({ appPage }) => {
    const html = appPage.locator("html");
    const start = await html.getAttribute("data-theme");
    const flipped = start === "dark" ? "light" : "dark";

    const toggle = appPage.getByRole("button", { name: /Switch to (light|dark) theme/ });
    await toggle.click();
    await expect(html).toHaveAttribute("data-theme", flipped);

    // The choice survives a reload (persisted + applied with no flash).
    await appPage.reload();
    await expect(appPage.locator("html")).toHaveAttribute("data-theme", flipped);
  });
});

rawTest.describe("onboarding tour", () => {
  rawTest("auto-opens for a new user, then skipping persists so it stays closed", async ({
    page,
  }) => {
    // Sign in (cookie) but DON'T seed the onboarded flag — so this behaves like
    // a brand-new user who should get the guided tour.
    await signIn(page);
    await page.goto("/");

    const dialog = page.getByRole("dialog", { name: "Getting started tour" });
    await expect(dialog).toBeVisible(); // auto-opens shortly after reveal
    await expect(dialog.getByText("Welcome to orire")).toBeVisible();

    // Advancing walks through the steps; the spotlight tracks each rail item.
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByText("Edit, live")).toBeVisible();

    // Skipping closes it and records that it was seen.
    await dialog.getByRole("button", { name: "Skip" }).click();
    await expect(dialog).toBeHidden();
    const seen = await page.evaluate(() => localStorage.getItem("orire-onboarded"));
    expect(seen).toBe("1");

    // It does not re-open on the next visit.
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Getting started tour" }),
    ).toBeHidden();
  });
});

test.describe("re-brand flow", () => {
  test("re-brands the working CV and returns to the editor", async ({ appPage }) => {
    const nav = appPage.getByRole("navigation", { name: "Workspaces" });
    await nav.getByRole("button", { name: "Re-brand" }).click();

    await expect(appPage.getByRole("heading", { name: "Re-brand a CV" })).toBeVisible();

    // Explore the flow with the seeded sample CV (no upload / no AI needed).
    await appPage.getByRole("button", { name: /Try with sample CV/ }).click();

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
  test("lists managed AI providers and no removed surfaces", async ({ appPage }) => {
    await stubAI(appPage);
    await appPage.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: "Connect AI" }).click();
    await expect(appPage.getByRole("heading", { name: "Connect AI", exact: true })).toBeVisible();

    // Cut features must not reappear in the rail.
    const nav = appPage.getByRole("navigation", { name: "Workspaces" });
    await expect(nav.getByRole("button", { name: "Progress" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Team" })).toHaveCount(0);
  });
});
