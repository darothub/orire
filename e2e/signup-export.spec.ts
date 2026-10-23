import { test, expect, signIn, waitForShell, SHELL_READY_TIMEOUT } from "./fixtures";
import { test as rawTest, type Page } from "@playwright/test";

/**
 * Signup → edit → export journey (critique backlog: manual signup→export QA).
 *
 * Hermetic: no real DB/SMTP. Guest path exercises the auth UI; signed-in path
 * uses the minted session + ORIRE_E2E_BYPASS so authorizeExport and verify
 * status succeed without a User row. Real email verify + Stripe remain manual
 * (see session checklist manual-signup-export-qa.md).
 *
 * Rail selectors match smoke.spec.ts — role + exact name inside Workspaces.
 */

function railNav(page: Page) {
  return page.getByRole("navigation", { name: "Workspaces" });
}

function railItem(page: Page, name: string) {
  // exact:true is required: keyboard reorder controls are named
  // "Move Export earlier" and would otherwise match name: "Export".
  return railNav(page).getByRole("button", { name, exact: true });
}

/** Landing hero can render multiple identical CTAs (slider slides). */
function guestCta(page: Page) {
  return page.getByRole("button", { name: "Get started free" }).first();
}


/** Dismiss cookie banner so it does not sit under/over the auth dialog. */
async function dismissCookies(page: Page) {
  const accept = page.getByRole("button", { name: "Accept", exact: true });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

async function openExport(page: Page) {
  await railItem(page, "Export").click();
  await expect(page.getByRole("heading", { name: "Export", exact: true })).toBeVisible({
    timeout: SHELL_READY_TIMEOUT,
  });
}

/** Mobile split: tablist "Switch pane" with Edit | Preview. */
function mobilePane(page: Page) {
  return page.getByRole("tablist", { name: "Switch pane" });
}

async function showMobileWork(page: Page) {
  const switcher = mobilePane(page);
  if (!(await switcher.count())) return;
  await switcher.getByRole("tab", { name: "Edit" }).click();
}

rawTest.describe("guest signup entry", () => {
  rawTest("landing opens Create account dialog with accessible fields", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissCookies(page);
    await expect(guestCta(page)).toBeVisible({ timeout: SHELL_READY_TIMEOUT });
    await guestCta(page).click();

    // Cookie consent is also role=dialog — name the auth overlay explicitly.
    const dialog = page.getByRole("dialog", { name: "Create your account" });
    await expect(dialog).toBeVisible({ timeout: SHELL_READY_TIMEOUT });

    await expect(dialog.getByRole("tab", { name: "Create account" })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Sign in" })).toBeVisible();

    const email = dialog.locator('input[type="email"]');
    const password = dialog.locator('input[type="password"]');
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute("minLength", "8");

    await email.fill("qa-guest@orire.test");
    await password.fill("short");
    await dialog.getByRole("button", { name: "Create account", exact: true }).click();
    const tooShort = await password.evaluate((el: HTMLInputElement) => !el.checkValidity());
    const errVisible = await dialog
      .locator(".auth-error, [role='alert']")
      .first()
      .isVisible()
      .catch(() => false);
    expect(tooShort || errVisible).toBe(true);
  });

  rawTest("mocked signup API then failed auto sign-in still confirms account create path", async ({
    page,
  }) => {
    await page.route("**/api/auth/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, verify: true }),
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissCookies(page);
    await guestCta(page).click();
    const dialog = page.getByRole("dialog", { name: "Create your account" });
    await expect(dialog).toBeVisible({ timeout: SHELL_READY_TIMEOUT });

    await dialog.locator('input[type="email"]').fill("new-user@orire.test");
    await dialog.locator('input[type="password"]').fill("password123");
    await dialog.getByRole("button", { name: "Create account", exact: true }).click();

    // Signup JSON ok; credentials sign-in has no DB user → recovery copy.
    await expect(
      dialog.getByText(/Account created|automatic sign-in failed|Please sign in/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("signed-in edit → export", () => {
  test("@smoke edit updates preview then PDF and Word downloads succeed", async ({ appPage }, testInfo) => {
    // On phone the live paper is display:none while Edit is open; PDF capture needs
    // a painted node. Mobile button reachability is covered in the mobile suite.
    test.skip(
      testInfo.project.name === "mobile",
      "Full file downloads are desktop-only; mobile covers Export CTAs",
    );

    await railItem(appPage, "Edit").click();
    await expect(appPage.getByRole("heading", { name: "Edit", exact: true })).toBeVisible({
      timeout: SHELL_READY_TIMEOUT,
    });
    const paper = appPage.locator("#cv-paper");
    await expect(paper).toBeVisible();

    const name = appPage.getByText("Full name").locator("..").locator("input");
    await name.fill("Export QA Candidate");
    await expect(paper).toContainText("Export QA Candidate");

    await openExport(appPage);
    await expect(appPage.getByRole("button", { name: "Download PDF" })).toBeVisible();
    await expect(appPage.getByRole("button", { name: "Download Word (.docx)" })).toBeVisible();
    await expect(appPage.getByRole("button", { name: "Download .txt" })).toBeVisible();
    await expect(appPage.locator("#cv-paper")).toBeVisible();

    const pdfDownload = appPage.waitForEvent("download", { timeout: 25_000 });
    await appPage.getByRole("button", { name: "Download PDF" }).click();
    const pdf = await pdfDownload;
    expect(pdf.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/);
    await expect(appPage.locator(".exp-msg.ok")).toBeVisible({ timeout: 15_000 });

    const docxDownload = appPage.waitForEvent("download", { timeout: 25_000 });
    await appPage.getByRole("button", { name: "Download Word (.docx)" }).click();
    const docx = await docxDownload;
    expect(docx.suggestedFilename().toLowerCase()).toMatch(/\.docx$/);

    const txtDownload = appPage.waitForEvent("download", { timeout: 15_000 });
    await appPage.getByRole("button", { name: "Download .txt" }).click();
    const txt = await txtDownload;
    expect(txt.suggestedFilename().toLowerCase()).toMatch(/\.txt$/);
  });

  test("copy plain text is available without leaving Export", async ({ appPage }) => {
    await openExport(appPage);
    const copy = appPage.getByRole("button", { name: /Copy as plain text/i });
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(appPage.getByRole("heading", { name: "Export", exact: true })).toBeVisible();
  });
});

rawTest.describe("mobile viewport export surfaces", () => {
  rawTest("export actions remain reachable on a phone-sized screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("orire-onboarded", "1");
      } catch {
        /* ignore */
      }
    });
    await signIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForShell(page);

    await showMobileWork(page);
    await openExport(page);
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download Word (.docx)" })).toBeVisible();
  });
});
