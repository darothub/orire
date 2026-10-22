
import { test, expect } from "@playwright/test";

/**
 * UX #107 — Before: actual Orire public guide.
 * After: the SAME real page and REAL template documents, but with temporary
 * markup/CSS applied in the browser ONLY. This does not implement a redesign.
 */
const GUIDE = "/guides/choose-the-right-cv-template";
const sizes = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "narrow-320x720", width: 320, height: 720 },
];
const templates = [
  { id: "meridian", name: "Meridian", label: "Minimal", blurb: "Swiss minimal · mono labels", feature: "Linear single-column reading", advice: "A calm starting point when work history should do most of the talking." },
  { id: "oxford", name: "Oxford", label: "Classic", blurb: "Navy + bronze · double-rule crest", feature: "Traditional single-column structure", advice: "For structured, restrained presentation without losing personality." },
  { id: "vertex", name: "Vertex", label: "Expressive", blurb: "Bold gradient sidebar", feature: "Sidebar with a visual accent", advice: "A more expressive approach where a design-led layout suits the role." },
];
const css = [
  ".content.ux107 {max-width:1140px;padding-top:28px;padding-bottom:110px}",
  ".ux107 * {box-sizing:border-box}",
  ".ux107 .content-back{margin-bottom:26px}",
  ".ux107 .ux107-stamp{position:fixed;bottom:15px;right:15px;z-index:100;background:#25312f;color:#ecfff9;border:1px solid #65b79b;border-radius:9px;padding:9px 12px;font-size:11px;letter-spacing:.06em;font-weight:800;pointer-events:none;box-shadow:0 6px 25px #0008}",
  ".ux107 .ux107-hero{position:relative;overflow:hidden;background:radial-gradient(ellipse at 100% 0%,rgba(58,217,180,.18),transparent 60%),linear-gradient(125deg,var(--panel-2),var(--panel));border:1px solid var(--line-2);border-radius:24px;padding:clamp(25px,5vw,54px)}",
  ".ux107 .ux107-overline{font-size:11px;font-weight:780;letter-spacing:.13em;color:var(--accent-2);text-transform:uppercase}",
  ".ux107 .ux107-hero h1{margin:15px 0 18px;font-size:clamp(32px,5.4vw,59px);line-height:1.1;letter-spacing:-.045em;max-width:800px}",
  ".ux107 .ux107-hero p{max-width:700px;color:var(--muted);font-size:clamp(16px,1.6vw,19px);line-height:1.65;margin:0 0 22px}",
  ".ux107 .ux107-hero .ux107-caption{font-size:12px;margin-top:18px;margin-bottom:0}",
  ".ux107 .ux107-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}",
  ".ux107 .ux107-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;border-radius:11px;padding:12px 18px;text-decoration:none;font-size:14px;font-weight:720}",
  ".ux107 .ux107-actions .ux107-primary{color:#081611;background:var(--grad)}",
  ".ux107 .ux107-actions .ux107-secondary{color:var(--text);border:1px solid var(--line-2);background:rgba(255,255,255,.04)}",
  ".ux107 .ux107-three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin-top:20px}",
  ".ux107 .ux107-mini{padding:18px;border:1px solid var(--line-2);background:var(--panel);border-radius:14px}",
  ".ux107 .ux107-mini strong{display:block;font-size:16px;margin-bottom:5px}",
  ".ux107 .ux107-mini p{font-size:13px;line-height:1.6;color:var(--muted);margin:0}",
  ".ux107 .ux107-section{margin-top:70px}",
  ".ux107 .ux107-section h2{font-size:clamp(26px,3.1vw,36px);line-height:1.14;margin:10px 0 13px;letter-spacing:-.035em}",
  ".ux107 .ux107-lede{color:var(--muted);max-width:750px;font-size:15px;line-height:1.7;margin:0 0 23px}",
  ".ux107 .ux107-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;list-style:none;padding:0;margin:0}",
  ".ux107 .ux107-steps li{padding:20px;background:var(--panel);border:1px solid var(--line-2);border-radius:14px}",
  ".ux107 .ux107-steps b{display:block;font-size:14px;color:var(--accent-2);margin-bottom:9px}",
  ".ux107 .ux107-steps strong{display:block;font-size:16px;margin-bottom:5px}",
  ".ux107 .ux107-steps p{font-size:13px;color:var(--muted);margin:0;line-height:1.6}",
  ".ux107 .ux107-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}",
  ".ux107 .ux107-card{min-width:0;display:flex;flex-direction:column;border:1px solid var(--line-2);background:var(--panel);border-radius:17px;overflow:hidden}",
  ".ux107 .ux107-card-top{display:flex;justify-content:space-between;align-items:center;padding:15px 18px 12px;gap:8px;font-size:12px;color:var(--muted)}",
  ".ux107 .ux107-card-top strong{color:var(--accent-2)}",
  ".ux107 .ux107-paper-wrap{display:flex;justify-content:center;align-items:flex-start;min-width:0;padding:18px 9px 20px;background:radial-gradient(ellipse at 50% 0%,rgba(58,217,180,.09),transparent 65%),rgba(6,13,20,.32)}",
  ".ux107 .ux107-paper-wrap img.ux107-actual-image{display:block;width:246px;height:348px;max-width:100%;object-fit:cover;object-position:top;background:#fff;border-radius:5px;box-shadow:0 11px 27px #0005}",
  ".ux107 .ux107-card-text{display:flex;flex:1;flex-direction:column;gap:8px;padding:18px 19px 21px}",
  ".ux107 .ux107-card-text h3{font-size:21px;margin:0;letter-spacing:-.025em}",
  ".ux107 .ux107-card-text p{font-size:13px;line-height:1.6;color:var(--muted);margin:0}",
  ".ux107 .ux107-card-text .ux107-feature{color:var(--text);font-weight:700}",
  ".ux107 .ux107-card-text a{font-size:14px;color:var(--accent-2);font-weight:750;margin-top:auto;padding-top:12px;text-decoration:none}",
  ".ux107 .ux107-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}",
  ".ux107 .ux107-col{padding:23px 25px;background:var(--panel);border:1px solid var(--line-2);border-radius:16px}",
  ".ux107 .ux107-col h3{margin:0 0 12px;font-size:19px}",
  ".ux107 .ux107-col p{font-size:14px;line-height:1.7;color:var(--muted);margin:0 0 12px}",
  ".ux107 .ux107-finish{padding:clamp(24px,4vw,42px);border-radius:20px;background:linear-gradient(130deg,var(--panel-2),var(--panel));border:1px solid var(--line-2)}",
  ".ux107 .ux107-finish h2{margin:12px 0 18px}",
  ".ux107 .ux107-finish ol{padding-left:21px;color:var(--muted)}",
  ".ux107 .ux107-finish li{font-size:14px;line-height:1.6;margin-bottom:7px}",
  ".ux107 a:focus-visible{outline:3px solid var(--accent-2);outline-offset:4px}",
  "@media(max-width:830px){.ux107 .ux107-grid,.ux107 .ux107-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}",
  "@media(max-width:640px){.content.ux107{padding:24px 16px 75px}.ux107 .ux107-stamp{right:8px;bottom:8px;font-size:9px}.ux107 .ux107-hero{border-radius:17px;padding:24px 20px}.ux107 .ux107-actions a{flex:1 1 100%}.ux107 .ux107-three,.ux107 .ux107-steps,.ux107 .ux107-grid,.ux107 .ux107-columns{grid-template-columns:1fr}.ux107 .ux107-mini{padding:14px 17px}.ux107 .ux107-section{margin-top:52px}.ux107 .ux107-paper-wrap{padding:20px 9px}}",
  "@media(prefers-reduced-motion:no-preference){.ux107 .ux107-card{transition:transform .18s ease,border-color .18s ease}.ux107 .ux107-card:hover{transform:translateY(-3px);border-color:var(--accent-2)}}",
].join("\n");

function proposedGuide(previews: Record<string, string>) {
  const cards = templates.map((template, i) => [
    '<article class="ux107-card">',
    '<div class="ux107-card-top"><strong>',template.label,'</strong><span>',String(i+1).padStart(2, "0"),' / 03</span></div>',
    '<div class="ux107-paper-wrap" aria-label="Actual Orire ',template.name,' design with fictional CV information">',
    '<img class="ux107-actual-image" src="', previews[template.id], '" alt="Actual Orire ',template.name,' CV preview with fictional Ada Okonkwo details" />','</div>',
    '<div class="ux107-card-text"><h3>',template.name,'</h3><p>',template.blurb,
    '</p><p class="ux107-feature">',template.feature,'</p><p>',template.advice,
    '</p><a href="/templates/',template.id,'">Preview ',template.name,' →</a></div></article>',
  ].join("")).join("");
  return [
    '<a href="/guides" class="content-back">← All guides</a>',
    '<header class="ux107-hero"><span class="ux107-overline">ORIRE FIELD GUIDE / TEMPLATE CHOICE</span>',
    '<h1>Pick a CV template that puts your experience first.</h1>',
    '<p>The right layout helps someone find your strongest work quickly. Start with readability, the experience you need to fit, and the expectations of the role—then choose a style that feels like you.</p>',
    '<div class="ux107-actions"><a href="/templates" class="ux107-primary">Explore all 25 templates ↗</a><a href="#compare-designs" class="ux107-secondary">Compare 3 real designs ↓</a></div>',
    '<p class="ux107-caption">Every example below uses the same fictional CV. The design changes; the person’s experience does not.</p></header>',
    '<aside class="ux107-three" aria-label="Three considerations for a CV layout">',
    '<div class="ux107-mini"><strong>01 · Clarity</strong><p>Can someone find your role, employers and accomplishments at a glance?</p></div>',
    '<div class="ux107-mini"><strong>02 · Fit</strong><p>Is there enough room for relevant experience without cramped text?</p></div>',
    '<div class="ux107-mini"><strong>03 · Tone</strong><p>Does the design suit the role and organization you’re applying to?</p></div></aside>',
    '<section class="ux107-section" aria-labelledby="start-heading"><span class="ux107-overline">START WITH THE CONTENT</span>',
    '<h2 id="start-heading">Choose the frame, not the facts.</h2>',
    '<p class="ux107-lede">A template should support your evidence rather than compete with it. Ask yourself three questions before deciding on a color or layout.</p>',
    '<ol class="ux107-steps">',
    '<li><b>01</b><strong>What must stand out?</strong><p>Prioritize relevant roles, outcomes and projects for this application.</p></li>',
    '<li><b>02</b><strong>How much must fit?</strong><p>Dense experience needs clear spacing and reading order, not tiny type.</p></li>',
    '<li><b>03</b><strong>Who will read it?</strong><p>Choose a restrained look where expected; be expressive when it helps.</p></li></ol></section>',
    '<section class="ux107-section" id="compare-designs" aria-labelledby="compare-heading">',
    '<span class="ux107-overline">ACTUAL ORIRE CV TEMPLATES</span><h2 id="compare-heading">One CV. Three different first impressions.</h2>',
    '<p class="ux107-lede">These are real Orire layouts, rendered with the same fictional person’s information. Compare hierarchy and tone—not unsupported promises about ATS scores or hiring outcomes.</p>',
    '<div class="ux107-grid">',cards,'</div>',
    '<p class="ux107-lede" style="font-size:12px;margin-top:16px">Illustrative CV details are fictional. Open each public template page to inspect its complete layout.</p></section>',
    '<section class="ux107-section" aria-labelledby="columns-heading"><span class="ux107-overline">READABILITY AND PARSING</span>',
    '<h2 id="columns-heading">One column or a sidebar?</h2>',
    '<p class="ux107-lede">Both can look professional. Think about actual reading order and the application requirements rather than assuming a particular design always passes an applicant tracking system.</p>',
    '<div class="ux107-columns">',
    '<div class="ux107-col"><h3>Single-column layouts</h3><p>Usually offer a straightforward reading flow through employment history. A sensible starting point for longer, text-rich applications.</p><p><strong>Real Orire examples:</strong> Meridian and Oxford.</p></div>',
    '<div class="ux107-col"><h3>Layouts with sidebars</h3><p>Visually separate compact details from the main experience. Check small-text readability, text order and the exported file.</p><p><strong>Real Orire example:</strong> Vertex.</p></div></div></section>',
    '<section class="ux107-section ux107-finish" aria-labelledby="finish-heading"><span class="ux107-overline">THE FINAL CHECK</span>',
    '<h2 id="finish-heading">Try your actual content before committing.</h2>',
    '<ol><li>Check that the most relevant experience appears early.</li>',
    '<li>Review spacing, section headings and font size on mobile and desktop.</li>',
    '<li>After exporting, check that PDF text is selectable and reads in sensible order.</li></ol>',
    '<div class="ux107-actions"><a href="/templates" class="ux107-primary">Browse all CV templates →</a>',
    '<a href="/" class="ux107-secondary">Start building your CV</a></div></section>',
  ].join("");
}

async function dismissCookies(page: import("@playwright/test").Page) {
  // CookieBanner is not a role=dialog on public content routes.
  // Wait for the rendered button; preserve the same dismissed-cookie browser
  // state in BEFORE and AFTER so the consent strip never hides UI evidence.
  const decline = page.getByRole("button", { name: "Decline", exact: true });
  await decline.waitFor({ state: "visible", timeout: 1600 }).catch(() => {});
  if (await decline.isVisible().catch(() => false)) {
    await decline.click();
    await expect(decline).toBeHidden();
  }
}

for (const viewport of sizes) {
  test("UX107 real before / proposed after " + viewport.name, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    const folder = "test-results/ux107-browser-proposal/";
    await page.goto(GUIDE, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "How to choose the right CV template" })).toBeVisible();
    await expect(page.getByText(/Outline — section headings and notes are in place/)).toBeVisible();
    await dismissCookies(page);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: folder+"BEFORE-ACTUAL-guide-"+viewport.name+"-full.png", fullPage: true, animations:"disabled" });
    await page.screenshot({ path: folder+"BEFORE-ACTUAL-guide-"+viewport.name+"-first-view.png", animations:"disabled" });

    // Every image is an ACTUAL PNG screenshot of Orire's real CV renderer,
    // not a CSS illustration, recreated template or scraped stock graphic.
    const previews: Record<string,string> = {};
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const template of templates) {
      await page.goto("/templates/"+template.id, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: template.name+" CV template" })).toBeVisible();
      const frame = page.locator(".tpl-detail-preview-window");
      await expect(frame).toBeVisible();
      const text = await frame.locator(".paper").textContent();
      expect(text).toContain("Ada Okonkwo");
      const image = await frame.screenshot({
        path: folder+"ACTUAL-ORIRE-template-"+template.id+"-source.png",
        animations: "disabled",
      });
      expect(image.byteLength).toBeGreaterThan(10_000);
      previews[template.id] = "data:image/png;base64,"+image.toString("base64");
    }
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // Reopen the actual guide; inject the proposed styling only in browser.
    await page.goto(GUIDE, { waitUntil: "domcontentloaded" });
    await dismissCookies(page);
    await page.addStyleTag({ content: css });
    await page.locator("main.content").evaluate((main, html) => {
      main.classList.add("ux107");
      main.innerHTML = html;
    }, proposedGuide(previews));
    await expect(page.getByRole("heading", { name: "Pick a CV template that puts your experience first." })).toBeVisible();
    await expect(page.locator(".ux107-card")).toHaveCount(3);
    await expect(page.locator(".ux107-paper-wrap img.ux107-actual-image")).toHaveCount(3);
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".ux107-actual-image").evaluateAll(async (images) => {
      await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
    });
    await page.screenshot({ path: folder+"AFTER-PROPOSED-guide-"+viewport.name+"-full.png", fullPage:true, animations:"disabled" });
    await page.screenshot({ path: folder+"AFTER-PROPOSED-guide-"+viewport.name+"-first-view.png", animations:"disabled" });
    await page.locator("#compare-designs").screenshot({ path: folder+"AFTER-PROPOSED-real-CV-comparison-"+viewport.name+".png", animations:"disabled" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log("UX107_PROPOSAL "+viewport.name+" horizontalOverflow="+overflow);
    expect(overflow).toBe(false);
    for (const template of templates) {
      await expect(page.getByRole("link", { name: "Preview "+template.name }))
        .toHaveAttribute("href", "/templates/"+template.id);
    }
    expect(errors).toEqual([]);
  });
}
