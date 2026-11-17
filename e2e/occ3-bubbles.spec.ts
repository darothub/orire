import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3 conversation bubble alignment", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled test gate");

  test("user bubble is flush right and visually distinct from left-aligned AI on desktop and mobile", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie=page.getByRole("dialog",{name:"Cookie consent"});
    await cookie.waitFor({state:"visible",timeout:4000}).catch(()=>{});
    if(await cookie.isVisible())await cookie.getByRole("button",{name:"Decline"}).click();
    const cv="Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
    await page.locator('input[type="file"]').setInputFiles({ name:"teacher-cv.txt",mimeType:"text/plain",buffer:Buffer.from(cv) });
    await page.getByRole("button", {name:"Send message"}).click();
    await expect(page.getByRole("button",{name:"General review"})).toBeVisible();
    for(const [width,height] of [[1440,900],[390,844],[320,700]]){
      await page.setViewportSize({width,height});
      const user=page.locator(".occ3-you .occ3-message-content").last();
      const ai=page.locator(".occ3-occ .occ3-message-content").last();
      await expect(user).toBeVisible();
      await expect(ai).toBeVisible();
      const geometry=await page.evaluate(()=>{
        const thread=document.querySelector(".occ3-thread")!;
        const you=document.querySelector(".occ3-you .occ3-message-content")!;
        const assistant=document.querySelector(".occ3-occ .occ3-message-content")!;
        const a=thread.getBoundingClientRect(),u=you.getBoundingClientRect(),b=assistant.getBoundingClientRect();
        const uc=getComputedStyle(you),bc=getComputedStyle(assistant);
        return {rightGap:Math.abs(a.right-u.right),leftGap:Math.abs(a.left-b.left),userLeft:u.left,aiLeft:b.left,userColor:uc.backgroundColor,aiColor:bc.backgroundColor,userText:uc.color,avatar:getComputedStyle(document.querySelector(".occ3-you .occ3-message-icon")!).display,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      expect(geometry.rightGap).toBeLessThan(35);
      expect(geometry.leftGap).toBeLessThan(70);
      expect(geometry.userLeft).toBeGreaterThan(geometry.aiLeft);
      expect(geometry.userColor).not.toBe(geometry.aiColor);
      expect(geometry.userText).toBe("rgb(44, 18, 61)");
      expect(geometry.avatar).toBe("none");
      expect(geometry.overflow).toBe(false);
      await testInfo.attach(`occ3-bubble-contrast-${width}`,{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    }
  });
});
