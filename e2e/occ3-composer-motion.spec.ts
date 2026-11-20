import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3 composer and attachment interactions", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-only gate");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  async function setup(page: import("@playwright/test").Page) {
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state:"visible", timeout:4000 }).catch(()=>{});
    if(await cookie.isVisible()) await cookie.getByRole("button", {name:"Decline"}).click();
  }
  test("attachment picker, grow-on-paste, expand/collapse and send animation on desktop/mobile",async ({page,db,e2eUser},testInfo)=>{
    await db.entitlement.create({data:{userId:e2eUser.id,plan:"career"}});
    await page.setViewportSize({width:1440,height:900});
    await setup(page);
    const form=page.getByRole("form",{name:"OCC 3.0 composer"});
    const attach=form.getByRole("button",{name:"Attach document"});
    await attach.click();
    const popup=page.getByRole("group",{name:"Attach to conversation"});
    const formBounds = await form.boundingBox();
    await expect(popup).toBeVisible();
    const popupBounds = await popup.boundingBox();
    expect(formBounds && popupBounds).toBeTruthy();
    expect(Math.abs(popupBounds!.x - formBounds!.x)).toBeLessThan(2);
    expect(Math.abs(popupBounds!.width - formBounds!.width)).toBeLessThan(2);
    expect(popupBounds!.y + popupBounds!.height).toBeLessThan(formBounds!.y);
    await expect(popup.getByRole("button",{name:/Upload CV/})).toBeVisible();
    await expect(popup).toContainText("YOUR ORIRE LIBRARY");
    await testInfo.attach("occ3-attachment-menu-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await attach.click();
    await page.locator('input[type="file"]').setInputFiles({name:"teacher-cv.txt",mimeType:"text/plain",buffer:Buffer.from(cv)});

    const input=form.getByRole("textbox",{name:"Message Orire Career Copilot"});
    const expand=form.getByRole("button",{name:"Expand message composer"});
    await expect(expand).toHaveCount(0);
    const shortHeight=await input.evaluate(e=>e.getBoundingClientRect().height);
    await input.fill(("I would like some career advice about a teaching position with curriculum design and assessment responsibilities. ").repeat(13));
    await expect.poll(()=>input.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThan(shortHeight+40);
    const compactHeight=await input.evaluate(e=>e.getBoundingClientRect().height);
    expect(compactHeight).toBeLessThanOrEqual(178);
    await expect(expand).toBeVisible();
    await expand.click();
    await expect(form.getByRole("button",{name:"Collapse message composer"})).toBeVisible();
    await expect.poll(()=>input.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThan(compactHeight+25);
    await testInfo.attach("occ3-expanded-composer-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await form.getByRole("button",{name:"Collapse message composer"}).click();
    await expect.poll(()=>input.evaluate(e=>e.getBoundingClientRect().height)).toBeLessThanOrEqual(178);
    await form.getByRole("button",{name:"Send message"}).click();
    const user=page.locator(".occ3-you .occ3-message-content").last();
    await expect(user).toBeVisible();
    await expect(page.getByRole("button",{name:"General review"})).toBeVisible();
    await testInfo.attach("occ3-sent-message-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    for(const [width,height] of [[390,844],[320,700]]){
      await page.setViewportSize({width,height});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await attach.click();
      await expect(popup).toBeVisible();
      const menuRect = await popup.boundingBox();
      const composerRect = await form.boundingBox();
      expect(Math.abs(menuRect!.x - composerRect!.x)).toBeLessThan(2);
      expect(Math.abs(menuRect!.width - composerRect!.width)).toBeLessThan(2);
      await testInfo.attach(`occ3-attachment-menu-${width}`,{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
      await attach.click();
    }
  });

  test("reduced-motion preference suppresses send animation but preserves the conversation",async ({page,db,e2eUser})=>{
    await db.entitlement.create({data:{userId:e2eUser.id,plan:"career"}});
    await page.emulateMedia({reducedMotion:"reduce"});
    await setup(page);
    await page.locator('input[type="file"]').setInputFiles({name:"teacher-cv.txt",mimeType:"text/plain",buffer:Buffer.from(cv)});
    const field=page.getByRole("textbox",{name:"Message Orire Career Copilot"});
    await field.fill("Please help me with my CV");
    await page.getByRole("button",{name:"Send message"}).click();
    const bubble=page.locator(".occ3-you").last();
    await expect(bubble).toBeVisible();
    expect(await bubble.evaluate(e=>getComputedStyle(e).animationName)).toBe("none");
    await expect(page.getByRole("button",{name:"General review"})).toBeVisible();
  });
});
