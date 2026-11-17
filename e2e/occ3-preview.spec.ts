import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3 chat-first preview", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC access required");

  const cvText = "Professional experience: Experienced software engineer skilled in Java, Kotlin, API testing, security and payment systems. Education: software engineering.";
  const jdText = "We are looking for a software engineer with experience designing Java APIs and secure payment systems. Responsibilities include integration testing and backend delivery.";

  test("CV-only attachment enters contextual review choice and general review runs immediately", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    const composer = page.getByRole("form", { name: "OCC 3 message composer" });
    await expect(composer).toBeVisible();
    await expect(composer.getByRole("button", { name: "Select agent" })).toContainText("Review");
    await composer.getByRole("button", { name: "Attach document" }).click();
    await expect(page.getByRole("menuitem", { name: "Upload CV" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Upload CV" }).click();
    await composer.getByLabel("Upload career document").setInputFiles({
      name: "my-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cvText),
    });
    await expect(composer).toContainText("my-cv.txt");
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("I've received your CV.", { exact:false })).toBeVisible();
    await expect(page.getByRole("button", { name: "General review" })).toBeVisible();
    await testInfo.attach("occ3-cv-upload-choice-desktop-1440", { body: await page.screenshot({ fullPage:true, animations:"disabled" }), contentType:"image/png" });

    let generalCalls = 0;
    await page.route("**/api/occ/general-review", async route => {
      generalCalls++;
      expect(route.request().postDataJSON().cv).toContain("Java");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice:{summary:"Synthetic general CV review",recommendations:[
          {requirement:"Clarity",cvEvidence:"Experienced software engineer",assessment:"supported",suggestion:"Make the summary easier to scan",sampleWording:null,question:null}
        ],nextSteps:["Confirm evidence"],disclaimer:"Verify wording"}
      }) });
    });
    await page.getByRole("button", { name: "General review" }).click();
    await expect(page.getByRole("region", { name: "General CV review" })).toContainText("Synthetic general CV review");
    expect(generalCalls).toBe(1);
    await testInfo.attach("occ3-general-review-desktop-1440", { body: await page.screenshot({ fullPage:true, animations:"disabled" }), contentType:"image/png" });
    await page.setViewportSize({ width:390,height:844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach("occ3-general-review-mobile-390", { body: await page.screenshot({ fullPage:true, animations:"disabled" }), contentType:"image/png" });
    await page.setViewportSize({ width:320,height:700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach("occ3-general-review-mobile-320", { body: await page.screenshot({ fullPage:true, animations:"disabled" }), contentType:"image/png" });
  });

  test("JD branch prompts contextually, then sending JD starts targeted review", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    const composer = page.getByRole("form", { name: "OCC 3 message composer" });
    await composer.getByRole("button", { name: "Attach document" }).click();
    await page.getByRole("menuitem", { name: "Upload CV" }).click();
    await composer.getByLabel("Upload career document").setInputFiles({ name:"resume.txt",mimeType:"text/plain",buffer:Buffer.from(cvText) });
    await composer.getByRole("button", { name:"Send message" }).click();
    await page.getByRole("button", { name:"I have a job description" }).click();
    await expect(page.getByText("Paste the job description into the message box", { exact:false })).toBeVisible();
    await composer.getByRole("button", { name:"Attach document" }).click();
    await expect(page.getByRole("menuitem", { name:"Upload job description" })).toBeVisible();
    await composer.getByRole("button", { name:"Attach document" }).click();
    await composer.getByRole("textbox", { name:"Message Orire Career Copilot" }).fill(jdText);
    let targetedCalls = 0;
    await page.route("**/api/occ/advise", async route => {
      targetedCalls++;
      const payload = route.request().postDataJSON();
      expect(payload.cv).toContain("Java");
      expect(payload.description).toContain("Responsibilities");
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        advice:{summary:"Synthetic JD-specific review",recommendations:[],nextSteps:[],disclaimer:"Verify evidence"}
      })});
    });
    await composer.getByRole("button", { name:"Send message" }).click();
    await expect(page.getByRole("region", { name:"Job-specific CV review" })).toContainText("Synthetic JD-specific review");
    expect(targetedCalls).toBe(1);
    await testInfo.attach("occ3-targeted-review-desktop", {body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await expect(page.getByRole("complementary", { name:"Conversation navigation" })).toBeVisible();
  });

  test("agent menu is compact and does not trigger AI merely by changing selection", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ/preview");
    const agent = page.getByRole("button", {name:"Select agent"});
    await agent.click();
    await expect(page.getByRole("menuitemradio", {name:"Coach"})).toBeVisible();
    await page.getByRole("menuitemradio", {name:"Coach"}).click();
    await expect(agent).toContainText("Coach");
    await expect(page.getByRole("region", {name:"General CV review"})).toHaveCount(0);
  });
});
