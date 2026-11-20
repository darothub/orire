import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3 inline Improve CV", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";

  async function prepare(page: import("@playwright/test").Page) {
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie=page.getByRole("dialog",{name:"Cookie consent"});
    await cookie.waitFor({state:"visible",timeout:4000}).catch(()=>{});
    if(await cookie.isVisible())await cookie.getByRole("button",{name:"Decline"}).click();
  }
  const mockedAdvice={
    advice:{summary:"Focus on clear descriptions of real classroom work.",recommendations:[
      {requirement:"Simplify teaching experience",cvEvidence:"Teaching mathematics to secondary school students",assessment:"supported",suggestion:"Clarify your existing teaching experience without adding outcomes.",sampleWording:"Teaching mathematics to secondary school students",question:null},
      {requirement:"Clarify evidence for outcomes",cvEvidence:null,assessment:"needs-clarification",suggestion:"Only add outcomes you can verify.",sampleWording:null,question:"What outcomes did you observe?"}
    ],nextSteps:["Review the wording"],disclaimer:"Verify everything."}
  };
  test("selected Improve CV returns inline before/after and requires confirmation before local edit", async ({page,db,e2eUser},testInfo) => {
    await db.entitlement.create({data:{userId:e2eUser.id,plan:"career"}});
    await page.setViewportSize({width:1440,height:900});
    await prepare(page);
    let calls=0;
    await page.route("**/api/occ/general-review",async route=>{
      calls++;expect(route.request().postDataJSON().cv).toContain("Teaching mathematics");
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(mockedAdvice)});
    });
    await page.getByRole("button",{name:"Select agent"}).click();
    await page.getByRole("option",{name:/Improve CV/}).click();
    await page.locator('input[type="file"]').setInputFiles({name:"teacher-cv.txt",mimeType:"text/plain",buffer:Buffer.from(cv)});
    await page.getByRole("button",{name:"Send message"}).click();
    const review=page.getByRole("region",{name:"Improve CV suggestions"});
    await expect(review).toBeVisible();
    await expect(review).toContainText("BEFORE — FROM YOUR CV");
    await expect(review).toContainText("AFTER — PROPOSED");
    expect(calls).toBe(1);
    await testInfo.attach("occ3-improve-before-after-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});

    await review.getByRole("button",{name:"Review / edit"}).click();
    const editor=review.getByRole("textbox",{name:"Edit proposed CV wording"});
    await editor.fill("Teaching mathematics to students in secondary school");
    const accept=review.getByRole("button",{name:"Accept into draft"});
    await expect(accept).toBeDisabled();
    await review.getByRole("checkbox").check();
    await expect(accept).toBeEnabled();
    await accept.click();
    await expect(review).toContainText("1 accepted");
    await expect(review).toContainText("Your saved CV has not changed.");
    await review.getByText("View local working draft").click();
    await expect(review.getByRole("textbox",{name:"Local working draft"})).toHaveValue(/Teaching mathematics to students in secondary school/);
    await testInfo.attach("occ3-improve-approved-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await testInfo.attach("occ3-improve-mobile-390",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await page.setViewportSize({width:320,height:700});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await testInfo.attach("occ3-improve-mobile-320",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await review.getByRole("button",{name:"Undo last edit"}).click();
    await expect(review.getByRole("textbox",{name:"Local working draft"})).toHaveValue(cv);
  });

  test("switching to Improve CV after a CV triggers factual suggestions, and rejecting does not edit draft", async ({page,db,e2eUser})=>{
    await db.entitlement.create({data:{userId:e2eUser.id,plan:"career"}});
    await prepare(page);
    await page.locator('input[type="file"]').setInputFiles({name:"teacher-cv.txt",mimeType:"text/plain",buffer:Buffer.from(cv)});
    await page.getByRole("button",{name:"Send message"}).click();
    await expect(page.getByRole("button",{name:"General review"})).toBeVisible();
    let calls=0;
    await page.route("**/api/occ/general-review",async route=>{
      calls++;await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(mockedAdvice)});
    });
    await page.getByRole("button",{name:"Select agent"}).click();
    await page.getByRole("option",{name:/Improve CV/}).click();
    const review=page.getByRole("region",{name:"Improve CV suggestions"});
    await expect(review).toBeVisible();
    expect(calls).toBe(1);
    await review.getByRole("button",{name:"Review / edit"}).click();
    await review.getByRole("button",{name:"Reject",exact:true}).click();
    await expect(review).toContainText("Suggestion rejected. No wording was changed.");
    await review.getByText("View local working draft").click();
    await expect(review.getByRole("textbox",{name:"Local working draft"})).toHaveValue(cv);
  });
});
