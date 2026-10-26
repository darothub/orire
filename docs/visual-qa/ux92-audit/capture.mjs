import {chromium,expect} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {encode} from 'next-auth/jwt';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
const errors=[];
const phase=process.env.PHASE??'proposal';
const url=new URL(process.env.DATABASE_URL??'');
if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/orire_e2e_[a-z0-9_]+$/.test(url.pathname))throw Error('Use only an explicit disposable local E2E database');
const db=new PrismaClient({datasourceUrl:url.href});
const browser=await chromium.launch();
const output=new URL('./',import.meta.url);
const extraCSS='html[data-theme=light] .app :is(.spot-card-toggle.in,.spot-card-next,.ed-evidence-btn,.ed-improve,.ed-add,.ed-coach-flag.info .ed-coach-label){color:#08775c}.landing-gallery-description{color:#9aa29c}.pw-toggle:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px}';
for(const viewport of [{width:1440,height:900,name:'desktop'},{width:390,height:844,name:'mobile'}]){
 for(const theme of phase==='proposal'?['light']:['dark','light']){
  const id=`e2e-user-${randomUUID()}`;await db.user.create({data:{id,email:`${id}@orire.test`,name:'Fictional Accessibility Audit'}});
  const context=await browser.newContext({viewport,colorScheme:theme,reducedMotion:'reduce'});
  try{
   await context.addInitScript(()=>{localStorage.setItem('orire-consent','denied');localStorage.setItem('orire-onboarded','1');});
   const token=await encode({token:{id,sub:id,email:`${id}@orire.test`,name:'Fictional Accessibility Audit'},secret:'orire-e2e-secret-do-not-use-in-production',salt:'authjs.session-token',maxAge:3600});
   await context.addCookies([{name:'authjs.session-token',value:token,domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const response=await page.goto('http://localhost:3100/');if(response.status()!==200)throw Error('Capture request failed');
   await page.getByRole('navigation',{name:'Workspaces'}).waitFor();
   const views=theme==='light'?['Home','Edit']:['Edit','Grade','AI Settings'];
   for(const view of views){
    if(view!=='Home')await page.getByRole('navigation',{name:'Workspaces'}).getByRole('button',{name:view,exact:true}).click();
    await page.locator('.ws-view').waitFor();await page.waitForTimeout(700);
    if(view==='Home')await page.locator('.spot-card-toggle.in').first().scrollIntoViewIfNeeded();
    if(view==='Edit')await page.locator(theme==='light'?'.ed-evidence-btn':'.ed-card .ed-label').first().scrollIntoViewIfNeeded();
    const label=view==='AI Settings'?'settings':view.toLowerCase();
    const stem=`${theme==='light'?'light-':''}${label}-${viewport.name}`;
    await page.screenshot({path:new URL(`${phase==='proposal'?'before':phase}-${stem}.png`,output).pathname,animations:'disabled'});
    if(phase==='proposal'){const style=await page.addStyleTag({content:extraCSS});await page.screenshot({path:new URL(`proposed-${stem}.png`,output).pathname,animations:'disabled'});await style.evaluate(el=>el.remove());}
   }
  }finally{await context.close();await db.user.delete({where:{id}});}
 }
}
const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light',reducedMotion:'reduce'});
await context.addInitScript(()=>localStorage.setItem('orire-consent','denied'));const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const response=await page.goto('http://localhost:3100/');if(response.status()!==200)throw Error('Capture request failed');
for(const state of ['light-gallery-mobile','password-focus-mobile']){
 if(state==='light-gallery-mobile')await page.locator('#templates').scrollIntoViewIfNeeded();
 else {
  await page.getByRole('button',{name:'Create your CV'}).first().click();
  const dialog=page.getByRole('dialog',{name:'Create your account'});
  await expect(dialog).toHaveCSS('opacity','1');
  await expect(dialog.locator('.auth-card')).toHaveCSS('opacity','1');
  await expect(dialog.locator('input[type=email]')).toBeFocused();
  await dialog.locator('.pw-input').focus();await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button',{name:'Show password',exact:true})).toBeFocused();
 }
 await page.screenshot({path:new URL(`${phase==='proposal'?'before':phase}-${state}.png`,output).pathname,animations:'disabled'});
 if(phase==='proposal'){const style=await page.addStyleTag({content:extraCSS});await page.screenshot({path:new URL(`proposed-${state}.png`,output).pathname,animations:'disabled'});await style.evaluate(el=>el.remove());}
}
await context.close();
const sourceFiles=['src/app/globals.css','src/app/ingest.css','src/app/templates.css','src/components/auth/PasswordInput.tsx','src/components/templates/TemplatePicker.tsx','src/components/landing/CvShowcase.tsx','src/components/landing/LiveDemo.tsx','src/components/templates/TemplateDetailPreview.tsx'];
await writeFile(new URL(`${phase}-capture.json`,output),JSON.stringify({phase,browser:browser.version(),baseUrl:'http://localhost:3100',pageErrors:errors,sourceSha256:Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]))},null,2)+'\n');
await browser.close();await db.$disconnect();
