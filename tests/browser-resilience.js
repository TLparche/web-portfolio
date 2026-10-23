// Run with playwright-cli run-code after opening the static preview.
async (page) => {
  const base=page.url().split('#')[0].split('?')[0];
  const check=(condition,message)=>{if(!condition) throw new Error(message);};
  const browser=page.context().browser();
  const plain=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const plainPage=await plain.newPage();
  await plainPage.goto(base);
  check(await plainPage.locator('[data-section]').count()===11,'No-JS content missing');
  check(await plainPage.getByRole('heading',{name:'Ideas into experiences.'}).isVisible(),'No-JS heading hidden');
  check(await plainPage.locator('canvas').count()===0,'No-JS canvas present');
  await plainPage.screenshot({path:'output/playwright/no-js.png'});
  await plain.close();

  const noGL=await browser.newContext({viewport:{width:1440,height:1000}});
  await noGL.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl') ? null : original.call(this,type,...args);};});
  const noGLPage=await noGL.newPage();
  const glRequests=[];noGLPage.on('request',request=>{if(/\.mp4|\.bin/.test(request.url())) glRequests.push(request.url());});
  await noGLPage.goto(base);await noGLPage.waitForTimeout(400);
  check(await noGLPage.locator('[data-enhanced="false"]').count()===1 && glRequests.length===0,'WebGL failure did not use static fallback');
  await noGL.close();

  const missing=await browser.newContext({viewport:{width:1440,height:1000}});
  const missingPage=await missing.newPage();
  await missingPage.route('**/*.mp4',route=>route.abort());
  await missingPage.goto(base);await missingPage.waitForTimeout(800);
  check(await missingPage.locator('[data-enhanced="false"]').count()===1,'Missing video did not recover');
  check(await missingPage.locator('[data-copy]').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node.parentElement).opacity==='1')),'Missing asset hid content');
  await missing.close();

  for (const options of [{viewport:{width:390,height:844}},{viewport:{width:1440,height:1000},reducedMotion:'reduce'}]) {
    const context=await browser.newContext(options);const tab=await context.newPage();const requests=[];
    tab.on('request',r=>{if(/\.mp4|\.bin/.test(r.url()))requests.push(r.url());});
    await tab.goto(base);await tab.waitForTimeout(500);
    check(await tab.locator('canvas').count()===0 && requests.length===0,'Mobile/reduced motion fetched media');
    check(await tab.locator('[data-section]').count()===11,'Static content missing');await context.close();
  }
  const denied=await browser.newContext({viewport:{width:1440,height:1000}});
  await denied.addInitScript(()=>{window.testPlayCalls=0;HTMLMediaElement.prototype.play=function(){window.testPlayCalls++;return Promise.reject(new DOMException('Gesture required','NotAllowedError'));};});
  const deniedPage=await denied.newPage();await deniedPage.goto(base);await deniedPage.locator('[data-ready=true]').waitFor();
  check(await deniedPage.evaluate(()=>window.testPlayCalls===0),'Scroll video unnecessarily requested autoplay');await denied.close();

  await page.bringToFront();await page.goto(base);await page.locator('[data-ready="true"]').waitFor();
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(200);
  const performance=await page.evaluate(async()=>{
    const intervals=[];let previous=0;
    const framesBefore=Number(document.querySelector('canvas').dataset.frames);
    await new Promise(resolve=>{
      let frame=0;
      function step(time){if(previous) intervals.push(time-previous);previous=time;window.scrollTo({top:frame*15,behavior:'instant'});frame++;if(frame<180) requestAnimationFrame(step);else resolve();}
      requestAnimationFrame(step);
    });
    const sorted=[...intervals].sort((a,b)=>a-b);
    return {meanFps:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length),p95FrameMs:sorted[Math.floor(sorted.length*.95)],renderedFrames:Number(document.querySelector('canvas').dataset.frames)-framesBefore,renderer:document.querySelector('canvas').dataset.renderer,dpr:document.querySelector('canvas').width/document.querySelector('canvas').clientWidth};
  });
  // The CLI browser keeps every tab visible. Exercise the browser visibility
  // event explicitly, including an invalidation while rendering is suspended.
  const hiddenBefore=await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));return document.querySelector('canvas').dataset.frames;});
  await page.evaluate(()=>window.scrollBy(0,80));await page.waitForTimeout(250);
  check(await page.locator('canvas').getAttribute('data-frames')===hiddenBefore,'Rendering continued on the hidden-state path');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(120);
  check(Number(await page.locator('canvas').getAttribute('data-frames'))>Number(hiddenBefore),'Rendering did not resume');
  // Returning structured metrics keeps the evidence in CLI output.
  return {performance,noJavaScript:true,webglFailure:true,assetFailure:true,visibilityEvent:true,mobile:true,reducedMotion:true,noAutoplayRequired:true};
}
