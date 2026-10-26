import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const phase = process.env.PHASE ?? 'before';
const output = new URL('./', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const measurements = [];
for (const viewport of [{width:1440,height:900,name:'desktop'}, {width:390,height:844,name:'mobile'}]) {
  for (let run = 0; run < 5; run++) {
    const context = await browser.newContext({ viewport, colorScheme:'dark', reducedMotion:'reduce', locale:'en-GB', timezoneId:'UTC' });
    await context.route('**/*', route => new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort());
    await context.addInitScript(() => {
      localStorage.setItem('orire-consent','denied');
      window.lab = { lcp:0, shifts:[], interactions:[] };
      new PerformanceObserver(list => {for(const e of list.getEntries()) window.lab.lcp = e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
      new PerformanceObserver(list => {for(const e of list.getEntries()) if(!e.hadRecentInput) window.lab.shifts.push({value:e.value,time:e.startTime});}).observe({type:'layout-shift',buffered:true});
      new PerformanceObserver(list => {for(const e of list.getEntries()) if(e.interactionId) window.lab.interactions.push(e.duration);}).observe({type:'event',buffered:true,durationThreshold:16});
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:500000,uploadThroughput:125000});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await cdp.send('Performance.enable');
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3100/',{waitUntil:'networkidle'});
    await page.getByRole('heading',{level:1}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(1500);
    if(run===0) await page.screenshot({path:new URL(`${phase}-${viewport.name}.png`,output).pathname,fullPage:false,animations:'disabled'});
    const metrics=await page.evaluate(()=>{
      let cls=0,score=0,start=0,previous=0;
      for(const s of window.lab.shifts){if(!score||s.time-previous>1000||s.time-start>5000){score=s.value;start=s.time;}else score+=s.value;previous=s.time;cls=Math.max(cls,score);}
      const js=performance.getEntriesByType('resource').filter(r=>r.name.includes('/_next/static/')&&r.name.endsWith('.js')).map(r=>({name:new URL(r.name).pathname,transfer:r.transferSize,decoded:r.decodedBodySize}));
      return {lcpMs:window.lab.lcp,cls,jsTransferBytes:js.reduce((a,r)=>a+r.transfer,0),jsDecodedBytes:js.reduce((a,r)=>a+r.decoded,0),scripts:js.sort((a,b)=>b.decoded-a.decoded),domElements:document.getElementsByTagName('*').length};
    });
    const perf=await cdp.send('Performance.getMetrics');
    await page.getByRole('button',{name:'Create your CV'}).first().click();
    await page.getByRole('dialog',{name:'Create your account'}).waitFor();
    await page.waitForTimeout(200);
    const interaction=await page.evaluate(()=>Math.max(0,...window.lab.interactions));
    measurements.push({viewport:viewport.name,run,...metrics,labInteractionMs:interaction,scriptDurationMs:(perf.metrics.find(m=>m.name==='ScriptDuration')?.value??0)*1000,errors});
    console.log(JSON.stringify(measurements.at(-1)));
    await context.close();
  }
}
await browser.close();
await writeFile(new URL(`${phase}.json`,output),JSON.stringify({phase,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),cpuSlowdown:4,latencyMs:100,downloadBytesPerSecond:500000,measurements},null,2));
