// Records the implemented reference interactions, using the same routes as the browser checks.
async page => {
  const context=await page.context().browser().newContext({viewport:{width:1920,height:1080},recordVideo:{dir:'output/playwright/implementation-reference',size:{width:1920,height:1080}}});
  const tab=await context.newPage();
  const video=tab.video();
  try {
    await tab.goto('http://127.0.0.1:3002/web-portfolio/?reference-recording#about');
    await tab.locator('[data-ready=true]').waitFor();
    await tab.evaluate(()=>document.fonts.ready);
    await tab.waitForTimeout(700);
    await tab.mouse.move(1780,520);
    await tab.mouse.wheel(0,360);
    await tab.waitForTimeout(2000);
    await tab.screenshot({path:'output/playwright/implementation-reference/interests-1920.png'});
    await tab.mouse.move(100,300,{steps:12});
    await tab.waitForTimeout(900);
    await tab.screenshot({path:'output/playwright/implementation-reference/interests-expanded-1920.png'});
    await tab.mouse.move(1905,980,{steps:12});
    await tab.waitForTimeout(600);
    for(let step=1;step<=4;step++) {
      await tab.mouse.wheel(0,240);
      await tab.waitForFunction(step=>document.querySelector('[data-widget=interests]')?.dataset.interestScrollStep===String(step),step);
      await tab.waitForTimeout(500);
    }
    await tab.screenshot({path:'output/playwright/implementation-reference/interests-revealed-1920.png'});
    for(let step=3;step>=0;step--) {
      await tab.mouse.wheel(0,-240);
      await tab.waitForFunction(step=>document.querySelector('[data-widget=interests]')?.dataset.interestScrollStep===String(step),step);
      await tab.waitForTimeout(400);
    }
    await tab.getByRole('button',{name:'다음 관심분야',exact:true}).click();
    await tab.waitForTimeout(2350);
    await tab.getByRole('button',{name:'다음 관심분야',exact:true}).click();
    await tab.waitForTimeout(2350);
    await tab.locator('#interests-tab-alignment').hover();
    await tab.waitForTimeout(700);
    await tab.getByRole('button',{name:'이전 관심분야',exact:true}).click();
    await tab.waitForTimeout(2350);
    await tab.mouse.move(1770,600);
    for(let step=1;step<=4;step++) {
      await tab.mouse.wheel(0,240);
      await tab.waitForFunction(step=>document.querySelector('[data-widget=interests]')?.dataset.interestScrollStep===String(step),step);
      await tab.waitForTimeout(350);
    }
    await tab.mouse.wheel(0,360);
    await tab.waitForTimeout(1600);
    await tab.screenshot({path:'output/playwright/implementation-reference/works-list-1920.png'});
    const cards=tab.locator('[data-work-list][aria-hidden=false] [data-work-card]');
    const point=await cards.first().evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width*630/1920,y:r.top+r.height*350/1080};});
    await tab.mouse.move(point.x,point.y,{steps:15});
    await tab.waitForTimeout(1400);
    await tab.screenshot({path:'output/playwright/implementation-reference/works-hover-1920.png'});
    await tab.mouse.click(point.x,point.y);
    await tab.waitForTimeout(1600);
    await tab.screenshot({path:'output/playwright/implementation-reference/works-detail-1920.png'});
    await tab.mouse.move(1250,400,{steps:12});
    await tab.mouse.wheel(0,420);
    await tab.waitForTimeout(1150);
    await tab.mouse.wheel(0,420);
    await tab.waitForTimeout(1150);
    await tab.locator('[data-work-detail-active=true] [data-work-page]').last().click();
    await tab.waitForTimeout(1300);
    await tab.getByRole('button',{name:/돌아가기/}).click();
    await tab.waitForTimeout(1500);
    await tab.locator('#projects-category-publications').click();
    await tab.waitForTimeout(1450);
    await tab.mouse.move(1200,400);
    await tab.mouse.wheel(0,-500);
    await tab.waitForTimeout(1200);
    await tab.keyboard.press('Escape');
    await tab.waitForTimeout(1300);
    await tab.mouse.move(1800,500);
    await tab.mouse.wheel(0,350);
    await tab.waitForTimeout(1100);
  } finally { await context.close(); }
  await video.saveAs('output/playwright/implementation-reference/interaction.webm');
  return {recording:'output/playwright/implementation-reference/interaction.webm',viewport:'1920×1080'};
}
