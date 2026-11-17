import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3 Interview conversation preview", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC access required");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const jd = "We are hiring a secondary teacher. Responsibilities include curriculum development, lesson planning, and helping students with mathematics.";

  test("Interview starts from CV, asks for JD in chat, then shows questions and grounded feedback without panels", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({width:1440,height:900});
    await page.goto("/occ/preview");
    const cookie=page.getByRole("dialog",{name:"Cookie consent"});
    await cookie.waitFor({state:"visible",timeout:4000}).catch(()=>{});
    if(await cookie.isVisible()) await cookie.getByRole("button",{name:"Decline"}).click();

    const composer = page.getByRole("form", {name:"OCC 3.0 composer"});
    await composer.getByRole("button", {name:"Select agent"}).click();
    await page.getByRole("option",{name:"Interview"}).click();
    await expect(composer.getByRole("button",{name:"Select agent"})).toContainText("Interview");
    await page.locator('input[type="file"]').setInputFiles({name:"teacher-cv.txt",mimeType:"text/plain",buffer:Buffer.from(cv)});
    await composer.getByRole("button",{name:"Send message"}).click();
    await expect(page.getByText("Paste or attach a job description for the mock interview.",{exact:false})).toBeVisible();

    let questionCalls=0, feedbackCalls=0;
    await page.route("**/api/occ/interview",async route=>{
      const data=route.request().postDataJSON();
      if(data.mode==="question"){
        questionCalls++;
        expect(data.cv).toContain("Teaching mathematics");
        expect(data.description).toContain("Responsibilities");
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({question:{
          question: data.turnIndex===0 ? "Tell me about your approach to teaching a difficult topic." : "How do you adapt a lesson for different learners?",
          focus:"Teaching approach",
          answerStarters:["Begin with a real example and explain your approach.","Describe the situation, what you did, and what you learned."],
        },turnIndex:data.turnIndex})});
      }else{
        feedbackCalls++;
        expect(data.answer).toContain("students");
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({feedback:{
          strength:"You described a classroom situation.",
          improvement:"Explain what changed for the students.",
          example:"An optional outline; verify it against your experience.",
          followUp:"How did you check understanding?",
          betterWording:"I explain new topics using examples to help students understand.",
          whyBetter:"It is easier to follow.",
        },turnIndex:data.turnIndex})});
      }
    });
    const input=composer.getByRole("textbox",{name:"Message Orire Career Copilot"});
    await input.fill(jd);
    await composer.getByRole("button",{name:"Send message"}).click();
    const first=page.getByRole("region",{name:"Interview question 1"});
    await expect(first).toBeVisible();
    await expect(first).toContainText("approach to teaching");
    await expect(first.getByText("Two suggested answer approaches")).toBeVisible();
    await testInfo.attach("occ3-interview-question-desktop-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});

    await input.fill("I explain new topics using examples to help students understand and practise in class.");
    await composer.getByRole("button",{name:"Send message"}).click();
    const feedback=page.getByRole("region",{name:"Interview feedback 1"});
    await expect(feedback).toContainText("You described a classroom situation.");
    await expect(feedback.getByRole("button",{name:"Next question"})).toBeVisible();
    await expect(feedback.getByText("Clearer wording suggestion")).toBeVisible();
    expect(questionCalls).toBe(1);
    expect(feedbackCalls).toBe(1);
    await testInfo.attach("occ3-interview-feedback-desktop-1440",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await testInfo.attach("occ3-interview-feedback-mobile-390",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await page.setViewportSize({width:320,height:700});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await testInfo.attach("occ3-interview-feedback-mobile-320",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
    await feedback.getByRole("button",{name:"Next question"}).click();
    await expect(page.getByRole("region",{name:"Interview question 2"})).toBeVisible();
    expect(questionCalls).toBe(2);
  });

  test("changing to Interview after CV is submitted asks for a JD without running AI", async ({page,db,e2eUser})=>{
    await db.entitlement.create({data:{userId:e2eUser.id,plan:"career"}});
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie=page.getByRole("dialog",{name:"Cookie consent"});
    await cookie.waitFor({state:"visible",timeout:4000}).catch(()=>{});
    if(await cookie.isVisible())await cookie.getByRole("button",{name:"Decline"}).click();
    await page.locator('input[type="file"]').setInputFiles({name:"teacher-cv.txt",mimeType:"text/plain",buffer:Buffer.from(cv)});
    await page.getByRole("button",{name:"Send message"}).click();
    await expect(page.getByRole("button",{name:"General review"})).toBeVisible();
    let calls=0;
    await page.route("**/api/occ/interview",async route=>{calls++;await route.abort();});
    await page.getByRole("button",{name:"Select agent"}).click();
    await page.getByRole("option",{name:"Interview"}).click();
    await expect(page.getByText("Interview selected. Paste or attach the target job description to begin.")).toBeVisible();
    expect(calls).toBe(0);
  });
});
