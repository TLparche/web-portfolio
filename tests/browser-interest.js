// Topic map interaction and responsive access replace the retired plate geometry.
async page => {
  const base = page.url().split('#')[0].split('?')[0];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  for (const [width,height] of [[1440,1000],[1024,650],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.goto(base + '?interest-map=' + width);
    if(width>900) await page.locator('[data-ready=true]').waitFor();
    await page.evaluate(()=>document.getElementById('interests').scrollIntoView({behavior:'instant'}));
    await page.waitForTimeout(400);
    const section=page.locator('#interests'), tabs=section.getByRole('tab');
    check(await tabs.count()===5,'Five topic controls missing');
    check(await section.locator('[data-interest-map]').count()===1,'Topic map missing');
    check(await section.locator('[data-interest-plate]').count()===0,'Retired plate remains');
    check(await section.locator('figure[data-art-src]').getAttribute('data-art-src')==='/art/concepts/interest-observatory.webp','Observatory artwork missing');
    await tabs.first().focus(); await page.keyboard.press('ArrowRight');
    check(await tabs.nth(1).getAttribute('aria-selected')==='true','Arrow selection failed');
    await page.keyboard.press('End');
    check(await tabs.last().getAttribute('aria-selected')==='true','End selection failed');
    await page.keyboard.press('Home');
    const notes=section.locator('details'), summary=notes.locator('summary');
    await summary.click();
    check(await notes.evaluate(n=>n.open),'Exploration notes did not open');
    for(const title of ['관심 이유','접근 방법','활용 방향']) check(await notes.getByText(title,{exact:true}).count()===1,'Note heading missing: '+title);
    await summary.focus(); await page.keyboard.press('Escape');
    check(await notes.evaluate(n=>!n.open),'Escape did not close notes');
    check(await summary.evaluate(n=>n===document.activeElement),'Notes focus lost');
    await tabs.nth(4).click(); await tabs.nth(2).click(); await tabs.nth(1).click();
    check(await tabs.nth(1).getAttribute('aria-selected')==='true','Rapid latest topic lost');
    check(await section.getByRole('tabpanel').getByRole('heading',{name:'시간과 공간의 단서를 함께 읽으면 무엇이 보일까.'}).isVisible(),'Selected question missing');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
    if(width<=900) check(await page.locator('canvas').count()===0,'Mobile loaded 3D');
  }
  return {topicMap:true,topics:5,keyboard:true,notes:true,escape:true,rapidSelection:true,viewports:3};
}

