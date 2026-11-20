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
    await expect(popup).toBeVisible();
    await expect(popup.getByRole("button",{name:/Upload CV/})).toBeVisible();
    await expect(popup).toContainText("YOUR ORIRE LIBRARY");
    const initialToggle=form.getByRole("button",{name:/^(Expand|Collapse) message composer$/});
    await expect(initialToggle).toHaveCount(0);
    const initialGeometry=await page.evaluate(()=>{
      const composer=document.querySelector(".occ3-composer")!.getBoundingClientRect();
      const menu=document.querySelector(".occ3-attach-menu")!.getBoundingClientRect();
      return {left:Math.abs(composer.left-menu.left),width:Math.abs(composer.width-menu.width),above:menu.bottom<=composer.top};
    });
    expect(initialGeometry.left).toBeLessThan(2);
    expect(initialGeometry.width).toBeLessThan(2);
    expect(initialGeometry.above).toBe(true);
    await testInfo.attach("occ3-attachment-menu-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await attach.click();
    await page.locator('input[type="file"]').setInputFiles({name:"teacher-cv.txt",mimeType:"text/plain",buffer:Buffer.from(cv)});

    const input=form.getByRole("textbox",{name:"Message Orire Career Copilot"});
    const shortHeight=await input.evaluate(e=>e.getBoundingClientRect().height);
    await expect(form.getByRole("button",{name:"Expand message composer"})).toHaveCount(0);
    await input.fill(("I would like some career advice about a teaching position with curriculum design and assessment responsibilities. ").repeat(13));
    await expect.poll(()=>input.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThan(shortHeight+40);
    await expect(form.getByRole("button",{name:"Expand message composer"})).toBeVisible();
    const compactHeight=await input.evaluate(e=>e.getBoundingClientRect().height);
    expect(compactHeight).toBeLessThanOrEqual(178);
    const expand=form.getByRole("button",{name:"Expand message composer"});
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
    await expect(form.getByRole("button",{name:"Expand message composer"})).toHaveCount(0);
    await testInfo.attach("occ3-sent-message-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    for(const [width,height] of [[390,844],[320,700]]){
      await page.setViewportSize({width,height});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await attach.click();
      await expect(popup).toBeVisible();
      const geometry=await page.evaluate(()=>{
        const form=document.querySelector(".occ3-composer")!.getBoundingClientRect();
        const menu=document.querySelector(".occ3-attach-menu")!.getBoundingClientRect();
        return {left:Math.abs(form.left-menu.left),width:Math.abs(form.width-menu.width),above:menu.bottom<=form.top,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      expect(geometry.left).toBeLessThan(2);
      expect(geometry.width).toBeLessThan(2);
      expect(geometry.above).toBe(true);
      expect(geometry.overflow).toBe(false);
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
