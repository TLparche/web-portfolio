// Opening card, chapter handoff and native fallbacks.
async page => {
  const base='http://127.0.0.1:3002/web-portfolio/';
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const errors=[];
  const captureError=error=>errors.push(error.message);
  page.on('pageerror',captureError);
  try {
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'?name-card-check');
    await page.locator('[data-ready=true]').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(150);
    const card=page.locator('[data-preview-stage]');
    check(await card.getAttribute('inert')===null,'Opening card is not accessible');
    check(await page.locator('#about [data-panel]').getAttribute('inert')!==null,'Hidden intro is focusable');
    check(await page.locator('[data-section]').count()===5,'Cover changed the chapter count');
    check(await page.locator('[data-preview] a').count()===1,'Empty contact placeholders became links');
    check(Number(await page.locator('canvas').getAttribute('data-video-target'))===0,'Cover advanced the video');
    await page.screenshot({path:'output/playwright/name-card-1440.png'});
    await page.mouse.wheel(0,500);
    await page.waitForFunction(()=>scrollY===500);
    await page.waitForTimeout(120);
    const opacity=await card.evaluate(n=>Number(getComputedStyle(n).opacity));
    check(opacity>0 && opacity<1,'Cover is not linked to scroll');
    check(Number(await page.locator('canvas').getAttribute('data-video-target'))===0,'Cover transition advanced the video');
    await page.screenshot({path:'output/playwright/name-card-transition.png'});
    await page.mouse.wheel(0,-500);
    await page.waitForFunction(()=>scrollY===0);
    await page.getByRole('link',{name:'스크롤해서 더 알아보기 EXPLORE THE PORTFOLIO'}).click();
    await page.waitForFunction(()=>Math.abs(document.getElementById('about').getBoundingClientRect().top)<1);
    await page.waitForTimeout(120);
    check(await card.getAttribute('inert')!==null,'Hidden cover is focusable');
    check(await page.locator('#about [data-panel]').getAttribute('inert')===null,'First page is inaccessible');
    check(await page.locator('#about').innerText().then(text=>text.includes('01 / 05')),'First page numbering changed');
    check(Number(await page.locator('canvas').getAttribute('data-video-target'))===0,'First page lost its first video frame');
    await page.screenshot({path:'output/playwright/name-card-intro.png'});
    await page.getByRole('link',{name:'포트폴리오 처음으로',exact:true}).click();
    await page.waitForFunction(()=>scrollY===0);
    await page.waitForTimeout(100);
    check(await card.evaluate(n=>Number(getComputedStyle(n).opacity))===1,'Reverse scroll did not restore the card');
    await page.setViewportSize({width:1024,height:650});
    await page.waitForTimeout(150);
    const cta=await page.getByRole('link',{name:'스크롤해서 더 알아보기 EXPLORE THE PORTFOLIO'}).boundingBox();
    check(cta && cta.y+cta.height<650,'Short desktop clips the entry link');
    await page.screenshot({path:'output/playwright/name-card-1024.png'});
    for(const mode of ['mobile','reduced','nojs']) {
      const context=await page.context().browser().newContext({viewport:{width:390,height:844},javaScriptEnabled:mode!=='nojs',reducedMotion:mode==='reduced'?'reduce':'no-preference'});
      try {
        const tab=await context.newPage();
        await tab.goto(base+'?name-card-'+mode);
        check(await tab.getByRole('heading',{name:'이름 / 닉네임',exact:true}).isVisible(),mode+' hides the name');
        check(await tab.locator('canvas').count()===0,mode+' mounted the desktop video');
        check(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),mode+' has horizontal overflow');
        await tab.screenshot({path:'output/playwright/name-card-'+mode+'.png'});
        await tab.getByRole('link',{name:'스크롤해서 더 알아보기 EXPLORE THE PORTFOLIO'}).click();
        await tab.waitForFunction(()=>Math.abs(document.getElementById('about').getBoundingClientRect().top)<1);
        check(await tab.locator('#about [data-panel]').isVisible(),mode+' cannot enter the portfolio');
      } finally {await context.close();}
    }
    check(!errors.length,errors.join('\n'));
    return {cover:true,placeholders:true,scrollFade:true,firstPage:true,reverse:true,chapterCount:5,videoStartsAtIntro:true,shortDesktop:true,mobile:true,reduced:true,nojs:true,errors};
  } finally {page.off('pageerror',captureError);}
}
