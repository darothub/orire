import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3 fluid interface", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC access required");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";

  test("focus has no input outline; modern picker, busy stages and readable user bubble", async ({page,db,e2eUser},testInfo) => {
    await db.entitlement.create({data:{userId:e2eUser.id,plan:"career"}});
    await signIn(page);
    await page.setViewportSize({width:1440,height:900});
    await page.goto("/occ/preview");
    const cookie=page.getByRole("dialog",{name:"Cookie consent"});
    await cookie.waitFor({state:"visible",timeout:4000}).catch(()=>{});
    if(await cookie.isVisible())await cookie.getByRole("button",{name:"Decline"}).click();
    const input=page.getByRole("textbox",{name:"Message Orire Career Copilot"});
    await input.focus();
    const computed=await input.evaluate(node=>{
      const field=getComputedStyle(node),wrapper=getComputedStyle(node.closest(".occ3-composer")!);
      return {outline:field.outlineStyle,border:field.borderTopWidth,wrapperBorder:wrapper.borderTopColor};
    });
    expect(computed.outline).toBe("none");
    expect(computed.border).toBe("0px");
    expect(computed.wrapperBorder).toBe("rgba(0, 0, 0, 0)");
    const picker=page.getByRole("button",{name:"Select agent"});
    await picker.click();
    const menu=page.getByRole("listbox",{name:"OCC agents"});
    await expect(menu.getByText("CHOOSE AN AGENT")).toBeVisible();
    await expect(menu.getByRole("option")).toHaveCount(5);
    await testInfo.attach("occ3-modern-agent-menu-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await menu.getByRole("option",{name:/Review/}).click();

    await page.locator('input[type="file"]').setInputFiles({name:"teacher-cv.txt",mimeType:"text/plain",buffer:Buffer.from(cv)});
    await page.getByRole("button",{name:"Send message"}).click();
    const user=page.locator(".occ3-you .occ3-message-content").last();
    await expect(user).toBeVisible();
    expect(await user.locator(".occ3-file small").evaluate(node=>getComputedStyle(node).color)).toBe("rgb(44, 18, 61)");
    await expect(page.getByRole("button",{name:"General review"})).toBeVisible();

    let unblock: (()=>void)|undefined;
    const gate=new Promise<void>(resolve=>{unblock=resolve;});
    await page.route("**/api/occ/general-review",async route=>{
      await gate;
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        advice:{summary:"Clear classroom experience.",recommendations:[
          {requirement:"Clarity",cvEvidence:"Teaching mathematics",assessment:"supported",suggestion:"Use concise examples.",sampleWording:null,question:null}
        ],nextSteps:[],disclaimer:"Verify suggestions."}
      })});
    });
    await page.getByRole("button",{name:"General review"}).click();
    const status=page.getByTestId("occ3-processing");
    await expect(status).toBeVisible();
    await expect(status).toContainText("Generating review");
    await expect(status).toContainText("No edits are applied.");
    await testInfo.attach("occ3-processing-stage-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    unblock?.();
    await expect(status).toHaveCount(0);
    await expect(page.getByRole("region",{name:"General CV review"})).toBeVisible();
    for(const [width,height] of [[390,844],[320,700]]){
      await page.setViewportSize({width,height});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await testInfo.attach(`occ3-fluid-mobile-${width}`,{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    }
  });
});
