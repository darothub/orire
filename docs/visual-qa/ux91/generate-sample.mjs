/**
 * Regenerate the public examples using the real Aurora renderer and Studio
 * exporters. Run with every other Next server/build stopped: Next dev writes
 * .next. The temporary generation route is removed even if generation fails.
 * No account, production database, external provider or network host is used.
 */
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { extractText, getDocumentProxy } from "unpdf";
import JSZip from "jszip";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const routeDirectory = path.join(root, "src/app/local-export-generation");
const samples = path.join(root, "public/samples");
const evidence = path.join(root, "docs/visual-qa/ux91");
const baseURL = "http://127.0.0.1:3102";
const environment = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "en_US.UTF-8" };
for (const file of (await readdir(root)).filter((name) => /^\.env(?:\.|$)/.test(name))) {
  for (const line of (await readFile(path.join(root, file), "utf8")).split("\n")) {
    const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (key) environment[key] = "";
  }
}
Object.assign(environment, {
  NEXT_TELEMETRY_DISABLED: "1", AUTH_TRUST_HOST: "true",
  AUTH_SECRET: "fictional-public-sample-local-generation-only",
  AUTH_URL: baseURL, APP_URL: "https://orire.app",
  DATABASE_URL: "postgresql://orire_e2e:unused@127.0.0.1:55488/orire_e2e_public_samples",
  DIRECT_URL: "postgresql://orire_e2e:unused@127.0.0.1:55488/orire_e2e_public_samples",
  OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", RESEND_API_KEY: "",
  TURNSTILE_SECRET_KEY: "", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
  NEXT_PUBLIC_META_PIXEL_ID: "", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
});

// No production route is added. This file exists only during local generation.
const source = `"use client";
import { Aurora } from "@/components/templates/Aurora";
import { publicSampleCV } from "@/lib/cv/publicSample";
export default function LocalExportGeneration() {
  return <main>
    <div id="cv-paper" className="paper" style={{ width: 794, minWidth: 794, maxWidth: "none", textAlign: "left" }}><Aurora cv={publicSampleCV} /></div>
    <pre id="sample-data" hidden>{JSON.stringify(publicSampleCV)}</pre>
    <button onClick={async () => { const { exportCVtoPDF } = await import("@/lib/export/pdf"); await exportCVtoPDF("paged", "Orire-fictional-Aurora-CV", publicSampleCV, { embedData: false }); }}>Generate PDF</button>
    <button onClick={async () => { const { exportCVtoDocx } = await import("@/lib/export/docx"); await exportCVtoDocx("Orire-fictional-Word-CV", publicSampleCV); }}>Generate Word</button>
  </main>;
}
`;
await mkdir(routeDirectory); // Refuse to overwrite an existing route.
let server;
let browser;
let output = "";
try {
  await writeFile(path.join(routeDirectory, "page.tsx"), source);
  server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3102"], {
    cwd: root, env: environment, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  const serverDone = new Promise((resolve) => server.once("close", resolve));
  server.stdout.on("data", (chunk) => { output = (output + chunk).slice(-6000); });
  server.stderr.on("data", (chunk) => { output = (output + chunk).slice(-6000); });
  const deadline = Date.now() + 90_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Local generation server exited: ${output}`);
    try {
      const response = await fetch(`${baseURL}/local-export-generation`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) { ready = true; break; }
    } catch { /* local route compiling */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, `Local generation server did not become ready: ${output}`);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", reducedMotion: "reduce", locale: "en-GB", timezoneId: "Europe/Lisbon" });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname) || ["data:", "blob:"].includes(url.protocol) ? route.continue() : route.abort();
  });
  await context.addInitScript(() => {
    localStorage.setItem("orire-consent", "denied");
    localStorage.setItem("orire-theme", "dark");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/local-export-generation`, { waitUntil: "networkidle" });
  await expect(page.locator("#cv-paper")).toContainText("Ada Okonkwo");
  await page.waitForFunction(() => [...document.querySelectorAll(".au-block")].every((node) => getComputedStyle(node).opacity === "1"));
  await page.evaluate(() => document.fonts.ready);
  const cv = JSON.parse(await page.locator("#sample-data").textContent());
  await page.locator("#cv-paper").screenshot({ path: path.join(evidence, "sample-source-aurora.png"), animations: "disabled" });
  await mkdir(samples, { recursive: true });
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
  const pdfPath = path.join(samples, "orire-fictional-aurora-cv.pdf");
  await (await pdfDownload).saveAs(pdfPath);
  const wordDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate Word", exact: true }).click();
  const wordPath = path.join(evidence, "sample-generated-word.docx");
  await (await wordDownload).saveAs(wordPath);
  assert.deepEqual(errors, []);
  const pdfBytes = await readFile(pdfPath);
  const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));
  const { text } = await extractText(pdf, { mergePages: true });
  assert(text.includes(cv.basics.fullName));
  assert(text.includes("https://example.com/ada"));
  assert(!text.includes("adaok.design"));
  const metadata = await pdf.getMetadata();
  assert(!metadata.info.Keywords, "Public sample must not embed the structured CV");
  const pages = pdf.numPages;
  await pdf.loadingTask.destroy();
  const archive = await JSZip.loadAsync(await readFile(wordPath));
  const xml = await archive.file("word/document.xml").async("string");
  assert(xml.includes(cv.basics.fullName));
  assert(xml.includes("https://example.com/ada"));
  assert(!xml.includes("adaok.design"));
  const sourcePaths = ["src/lib/cv/publicSample.ts", "src/lib/cv/sample.ts", "src/lib/export/pdf.ts", "src/lib/export/docx.ts", "src/lib/export/orireEmbed.ts", "src/components/templates/Aurora.tsx", "src/components/templates/shared.ts", "src/app/resume.css", "src/app/globals.css", "src/app/templates.css"];
  const fingerprints = {};
  for (const file of sourcePaths) fingerprints[file] = createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
  const hash = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
  await writeFile(path.join(evidence, "sample-provenance.json"), JSON.stringify({
    capturedAt: new Date().toISOString(), baseCommit: execFileSync("git", ["-c", "core.fsmonitor=false", "rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    sourceNote: "Working-tree source fingerprints below identify the actual generator inputs; base commit alone does not describe uncommitted implementation.",
    url: `${baseURL}/local-export-generation`, browser: browser.version(), viewport: { width: 1440, height: 900 }, theme: "dark", reducedMotion: true,
    renderer: "Aurora", pdfExporter: "exportCVtoPDF(paged, ..., publicSampleCV, {embedData:false})", wordExporter: "exportCVtoDocx(..., publicSampleCV)",
    sourceFingerprints: fingerprints, pdf: { path: "public/samples/orire-fictional-aurora-cv.pdf", sha256: await hash(pdfPath), bytes: pdfBytes.length, pages, structuredDataMetadata: false, readableTextVerified: true },
    word: { path: "docs/visual-qa/ux91/sample-generated-word.docx", sha256: await hash(wordPath), bytes: (await readFile(wordPath)).length, documentXmlVerified: true },
    cv, pageErrors: errors,
  }, null, 2) + "\n");
  console.log(`Generated actual Aurora PDF (${pages} pages, ${pdfBytes.length} bytes) and fictional Word sample; readable text, reserved URLs and absent structured PDF metadata verified.`);
  await context.close();
  await browser.close(); browser = undefined;
  process.kill(-server.pid, "SIGTERM");
  await serverDone;
  server = undefined;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) process.kill(-server.pid, "SIGTERM");
  await rm(routeDirectory, { recursive: true, force: true });
}
