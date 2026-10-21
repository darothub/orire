import { test, expect, type Page } from "@playwright/test";

/**
 * Issue #86: real-app before vs screenshot-only after DESIGN PROPOSAL.
 * CSS + menu control are injected in a Playwright browser, never in product code.
 */
const sizes = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 720 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

const proposalCSS = [
  ".landing-demo-frame .landing-demo-paper-scale { left:0!important; width:100%!important; top:16px!important; transform:none!important; display:flex!important; justify-content:center!important; }",
  ".landing-demo-frame .landing-demo-paper-scale > .paper.landing-demo-paper { flex:0 0 794px!important; box-sizing:border-box!important; width:794px!important; min-width:794px!important; max-width:none!important; scale:.78!important; transform-origin:top center!important; text-align:left!important; }",
  ".landing-demo-frame { height:650px!important; }",
  "@media (max-width:760px) { .landing-demo-frame .landing-demo-paper-scale > .paper.landing-demo-paper { scale:.55!important; } .landing-demo-frame { height:640px!important; } }",
  "@media (max-width:640px) { .landing-demo-frame .landing-demo-paper-scale > .paper.landing-demo-paper { scale:.40!important; } .landing-demo-frame { height:475px!important; } }",
  "@media (max-width:359px) { .landing-demo-frame .landing-demo-paper-scale > .paper.landing-demo-paper { scale:.32!important; } .landing-demo-frame { height:392px!important; } }",
  "@media (max-width:860px) {",
  " .landing-nav { position:relative; z-index:4; }",
  " .landing-menu-proposal { display:inline-flex; flex:0 0 42px; width:42px; height:42px; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.19); border-radius:10px; background:#1a2425; color:#f1f6f4; font-size:24px; }",
  " .landing-nav-links.ux86-menu-open { position:absolute; z-index:10; top:64px; right:16px; left:16px; margin:0; padding:10px; display:flex!important; flex-direction:column; align-items:stretch; gap:2px; background:#142021; border:1px solid rgba(255,255,255,.18); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.5); }",
  " .landing-nav-links.ux86-menu-open a { color:#eff6f4; font-size:15px; padding:13px 15px; min-height:44px; text-align:left; }",
  "}",
  "@media (max-width:359px) { .landing-nav-actions > .theme-toggle {display:none!important;} .landing-nav-actions {gap:7px;} .landing-nav-actions > .landing-cta {padding:10px 12px;} .landing-menu-proposal {flex-basis:38px;height:38px;width:38px;} }",
].join("\n");

async function dismissAndReveal(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Cookie consent" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Decline" }).click();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const max = document.documentElement.scrollHeight;
    for (let y = 0; y < max; y += Math.round(innerHeight * .67)) {
      scrollTo(0, y); await sleep(65);
    }
    scrollTo(0, 0); await sleep(400);
  });
}

for (const size of sizes) {
  test("real Orire before and proposed after " + size.name, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#demo")).toBeAttached();
    await dismissAndReveal(page);
    const dir = "test-results/ux86-proposal/";
    await page.locator("#demo").screenshot({
      path: dir + "BEFORE-real-demo-" + size.name + ".png", animations: "disabled",
    });
    if (size.width < 861) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: dir + "BEFORE-real-header-" + size.name + ".png", animations: "disabled",
      });
    }

    // Browser-only concept styling. No CSS or component changes in the app.
    await page.addStyleTag({ content: proposalCSS });
    if (size.width < 861) {
      await page.evaluate(() => {
        const actions = document.querySelector(".landing-nav-actions");
        if (!actions) throw new Error("Landing actions not found");
        const menu = document.createElement("button");
        menu.type = "button";
        menu.textContent = "☰";
        menu.className = "landing-menu-proposal";
        menu.setAttribute("aria-label", "Proposed mobile navigation menu");
        actions.insertBefore(menu, actions.querySelector(".landing-cta"));
      });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: dir + "AFTER-PROPOSED-menu-closed-" + size.name + ".png",
        animations: "disabled",
      });
      await page.locator(".landing-nav-links").evaluate(node => node.classList.add("ux86-menu-open"));
      await page.screenshot({
        path: dir + "AFTER-PROPOSED-menu-open-" + size.name + ".png",
        animations: "disabled",
      });
      await page.locator(".landing-nav-links").evaluate(node => node.classList.remove("ux86-menu-open"));
    }

    await page.locator("#demo").screenshot({
      path: dir + "AFTER-PROPOSED-demo-" + size.name + ".png",
      animations: "disabled",
    });

    const geometry = await page.locator("#demo").evaluate(root => {
      const frame = root.querySelector(".landing-demo-frame")?.getBoundingClientRect();
      const paper = root.querySelector(".landing-demo-paper")?.getBoundingClientRect();
      return frame && paper ? {
        frameWidth: frame.width,
        paperWidth: paper.width,
        leftGap: paper.left - frame.left,
        rightGap: frame.right - paper.right,
        fits: paper.left >= frame.left - 1 && paper.right <= frame.right + 1,
      } : null;
    });
    console.log("UX86_PROPOSAL " + size.name + ": " + JSON.stringify(geometry));
    expect(geometry?.fits).toBe(true);
  });
}
