import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import { test, expect } from "./fixtures";
import { meterFor } from "../src/lib/plan/plan";
import { decodeOrireKeywords } from "../src/lib/export/orireEmbed";

for (const theme of ["dark", "light"] as const) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`public export panel is accessible at ${viewport.width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/templates", { waitUntil: "domcontentloaded" });
      const panel = page.getByRole("region", { name: "See what you'll export" });
      await expect(panel).toBeVisible();
      await expect(panel).toContainText(`Free: ${meterFor("free", "download").cap} lifetime downloads`);
      await expect(panel).toContainText("Pro and Career: unlimited downloads");
      await expect(panel).toContainText("Word uses a clean, single-column layout");
      await expect(panel).toContainText("sample downloads do not use your allowance");
      const preview = panel.getByRole("link", { name: "View fictional CV" });
      await preview.focus();
      await expect(preview).toBeFocused();
      expect(await preview.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
      await page.keyboard.press("Tab");
      await expect(panel.getByRole("link", { name: "Sample PDF" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(panel.getByRole("button", { name: "Sample Word — download fictional CV (.docx)" })).toBeFocused();
      const audit = await new AxeBuilder({ page }).include(".public-export-panel").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(audit.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await preview.press("Enter");
      await expect(page).toHaveURL(/\/templates\/aurora$/);
      await expect(page.getByRole("region", { name: "Fictional CV example in the Aurora template" })).toBeVisible();
    });
  }
}

test("anonymous PDF sample is a readable genuine export without embedded structured CV data", async ({ page, db, e2eUser }) => {
  await page.goto("/templates", { waitUntil: "domcontentloaded" });
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Sample PDF", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Orire-fictional-Aurora-CV.pdf");
  const path = await file.path();
  expect(path).not.toBeNull();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const { text } = await extractText(doc, { mergePages: true });
    expect(text).toContain("Ada Okonkwo");
    expect(text).toContain("Senior Product Designer");
    expect(text).toContain("Open Banking Design Kit");
    expect(text).toContain("https://example.com/ada");
    expect(text).not.toContain("adaok.design");
    const metadata = await doc.getMetadata();
    const keywords = (metadata.info as { Keywords?: string }).Keywords;
    expect(decodeOrireKeywords(keywords)).toBeNull();
    expect(keywords ?? "").toBe("");
  } finally {
    await doc.loadingTask.destroy();
  }
  await expect(page.getByRole("region", { name: "See what you'll export" })).toBeVisible();
  expect(await db.exportEvent.count({ where: { userId: e2eUser.id } })).toBe(0);
  expect(await db.usageCounter.count({ where: { userId: e2eUser.id, metric: "download" } })).toBe(0);
});

test("anonymous panel Word sample contains the same fictional facts and reserved links", async ({ page, db, e2eUser }) => {
  await page.goto("/templates", { waitUntil: "domcontentloaded" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Sample Word — download fictional CV (.docx)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/fictional CV sample\.docx$/);
  const path = await file.path();
  expect(path).not.toBeNull();
  const archive = await JSZip.loadAsync(await readFile(path!));
  const xml = await archive.file("word/document.xml")?.async("string");
  expect(xml).toContain("Ada Okonkwo");
  expect(xml).toContain("Senior Product Designer");
  expect(xml).toContain("Open Banking Design Kit");
  expect(xml).toContain("https://example.com/ada");
  expect(xml).not.toContain("adaok.design");
  expect(xml).not.toContain("github.com/adaok");
  expect(await db.exportEvent.count({ where: { userId: e2eUser.id } })).toBe(0);
  expect(await db.usageCounter.count({ where: { userId: e2eUser.id, metric: "download" } })).toBe(0);
});
