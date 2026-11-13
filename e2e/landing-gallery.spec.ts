import { test, expect } from "./fixtures";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";

test("public detail page renders the actual fictional CV and readable CTA", async ({ page }) => {
  await page.goto("/templates/aurora", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Aurora CV template" })).toBeVisible();
  // The public CV is now explained by semantic text, not an opaque image role.
  // Keep the visual render check and assert the accessible fictional summary.
  await expect(page.locator(".tpl-detail-preview .sr-only")).toContainText("Ada Okonkwo");
  await expect(page.locator(".tpl-detail-preview .sr-only")).toContainText("Example candidate:");
  await expect(page.locator(".tpl-detail-preview-paper")).toContainText("Ada Okonkwo");

  const cta = page.getByRole("link", { name: /Create your CV with Aurora/ });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/");

  // Shared-content link styles must not override the CTA's high-contrast ink.
  const contrast = await cta.evaluate((el) => {
    const css = window.getComputedStyle(el);
    return { color: css.color, background: css.backgroundImage };
  });
  expect(contrast.color).toBe("rgb(8, 21, 18)");
  expect(contrast.background).toContain("gradient");
});

test("public template Word sample downloads a real fictional DOCX without signup", async ({ page }) => {
  await page.goto("/templates/aurora", { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: "Download fictional Word (.docx) sample" });
  await expect(button).toBeVisible();
  const download = page.waitForEvent("download");
  await button.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/fictional CV sample[.]docx$/i);
  const archive = await JSZip.loadAsync(await readFile(await file.path()));
  const documentXml = await archive.file("word/document.xml")?.async("string");
  expect(documentXml).toContain("Ada Okonkwo");
  expect(documentXml).toContain("w:document");
  await expect(page.getByText("Word does not reproduce the decorative PDF template layout.", { exact: false })).toBeVisible();
});
