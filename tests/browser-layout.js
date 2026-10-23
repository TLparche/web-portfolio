async (page) => {
  const base=page.url().split('#')[0].split('?')[0];
  const check=(ok,message)=>{if(!ok) throw new Error(message);};
  const browser=page.context().browser();
  for(const width of [320,900,901]) {
    const context=await browser.newContext({viewport:{width,height:780}});
    const tab=await context.newPage();await tab.goto(base);await tab.waitForTimeout(500);
    check(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}`);
    check((await tab.locator('canvas').count()>0)===(width>900),`Wrong 3D boundary at ${width}`);
    await tab.evaluate(()=>{
      const title=document.querySelector('#projects-title');title.textContent='매우 긴 프로젝트 제목과 연구 경험을 함께 기록하는 포트폴리오 화면 '.repeat(4);
      document.getElementById('projects').scrollIntoView({behavior:'instant'});
    });
    await tab.waitForTimeout(120);
    check(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Long title overflow at ${width}`);
    if(width===320) await tab.screenshot({path:'output/playwright/mobile-small.png',fullPage:true});
    await context.close();
  }
  const low=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2});
  await low.addInitScript(()=>Object.defineProperty(navigator,'hardwareConcurrency',{value:2}));
  const tab=await low.newPage();await tab.goto(base);await tab.locator('[data-ready="true"]').waitFor();
  check(await tab.locator('canvas').getAttribute('data-renderer')==='video','Low tier did not use the plain video renderer');
  check(await tab.locator('canvas').evaluate(node=>node.width/node.clientWidth)<=1.5,'DPR exceeds 1.5');
  await tab.evaluate(()=>window.scrollTo({top:1700,behavior:'instant'}));await tab.waitForTimeout(150);
  await tab.screenshot({path:'output/playwright/low-tier.png'});
  await low.close();await page.bringToFront();
}
