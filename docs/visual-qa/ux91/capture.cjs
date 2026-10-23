const { chromium } = require('playwright');
const fs = require('fs');
const out = __dirname;
(async () => {
 const browser = await chromium.launch({executablePath:process.env.ORIRE_CAPTURE_BROWSER || undefined,headless:true});
 const evidence = {sourceCommit:'48fa224703aaf6e219fd01f2e3218b81b5518baf',browser:browser.version(),theme:'dark',capturedAt:new Date().toISOString(),baseURL:process.env.BASE_URL || 'http://127.0.0.1:3493',pages:[]};
 for(const [label,width,height] of [['desktop-1440',1440,900],['mobile-390',390,844]]) {
  const context = await browser.newContext({viewport:{width,height},colorScheme:'dark',reducedMotion:'reduce',locale:'en-GB',timezoneId:'Europe/Lisbon'});
  await context.addInitScript(() => {localStorage.setItem('orire-theme','dark');localStorage.setItem('orire-consent','denied');});
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  for (const [route,file] of [['/templates','BEFORE-actual-templates'],['/templates/aurora','BEFORE-actual-aurora']]) {
   const r=await page.goto(evidence.baseURL+route,{waitUntil:'networkidle'}); await page.evaluate(()=>document.fonts.ready); await page.screenshot({path:`${out}/${file}-${label}.png`,animations:'disabled'});
   if(r.status()!==200) throw new Error(`Unexpected ${r.status()} for ${route}`);
   evidence.pages.push({route,viewport:{width,height},status:r.status(),file:`${file}-${label}.png`,errors:[...errors]});
  }
  await context.close();
 }
 fs.writeFileSync(`${out}/capture-provenance.json`,JSON.stringify(evidence,null,2)+'\n');
 await browser.close();console.log('Captured four real baseline screenshots.');
})().catch(e=>{console.error(e);process.exit(1)});
