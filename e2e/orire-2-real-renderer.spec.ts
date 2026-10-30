import { test, expect } from "@playwright/test";

const names = ["Aurora", "Meridian", "Slate", "Ivory", "Oxford", "Verde"];
for (const width of [320, 390, 768, 1365]) {
  test("Orire 2 real template preview at " + width + "px", async ({ page }) => {
    await page.setViewportSize({width,height:900});
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/orire-2-design-preview");
    await expect(page.getByRole("heading",{name:"One CV. Six distinct designs."})).toBeVisible();
    for (const name of names) {
      const option = page.getByRole("button",{name:new RegExp("^" + name)});
      await option.click();
      await expect(option).toHaveAttribute("aria-pressed","true");
      await expect(page.getByRole("region",{name:name + " resume preview"})).toBeVisible();
      await expect(page.locator(".orire2-sheet")).toContainText("Ada Okonkwo");
    }
    await page.getByLabel("Zoom").selectOption("0.5");
    await expect(page.locator(".orire2-sheet-frame")).toHaveCSS("width","397px");
    await page.getByRole("button",{name:"Expand preview"}).click();
    await expect(page.getByRole("button",{name:"Collapse preview"})).toHaveAttribute("aria-pressed","true");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await page.screenshot({path:"test-results/orire2-real-" + width + ".png",fullPage:true});
  });
}
