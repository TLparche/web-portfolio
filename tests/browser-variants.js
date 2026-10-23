// Run against an ephemeral build with reordered/empty/single content fixtures.
async page => {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const variant=await page.evaluate(()=>new URL(location.href).searchParams.get('variant'));
  await page.setViewportSize({width:1024,height:650});
  const expected=variant==='single'?['projects']:['publications','interests','projects'];
  await page.reload();await page.locator('[data-ready=true]').waitFor();
  check(JSON.stringify(await page.locator('[data-section]').evaluateAll(nodes=>nodes.map(n=>n.id)))===JSON.stringify(expected),'Variant section order changed');
  check(await page.locator('h1').count()===1,'First scene does not own the page heading');
  const broken=await page.locator('a[href^="#"]').evaluateAll(nodes=>nodes.filter(n=>!document.getElementById(n.hash.slice(1))).map(n=>n.hash));
  check(broken.length===0,'Disabled sections left dead links');
  for(const id of expected) {
    await page.evaluate(id=>document.getElementById(id).scrollIntoView({behavior:'instant'}),id);await page.waitForTimeout(300);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Fixture overflow '+id);
    if(variant==='empty')check(await page.locator('#'+id).getByText(/준비하고 있습니다/).count()>0,'Empty scene has no reading state');
  }
  if(variant==='long') {
    const projects=page.locator('#projects'),button=projects.getByRole('button',{name:/상세 보기/});
    await button.click();check(await page.getByRole('dialog').isVisible(),'Long title blocked project reading');
    await page.keyboard.press('Escape');await page.waitForTimeout(350);
    check(await button.evaluate(n=>document.activeElement===n),'Long title lost focus return');
  }
  if(variant==='reordered') {
    await page.evaluate(()=>document.getElementById('publications').scrollIntoView({behavior:'instant'}));await page.waitForTimeout(300);
    await page.locator('#publications').getByRole('button',{name:/상세 보기/}).click();
    await page.getByRole('dialog').getByRole('button',{name:'다음 상세 정보',exact:true}).click();
    check(await page.getByRole('dialog').getByRole('heading',{name:'두 번째 연구 기록 테스트',exact:true}).count()===1,'Paper navigation escaped its section');
    await page.keyboard.press('Escape');await page.waitForTimeout(350);
  }
  await page.screenshot({path:'output/playwright/variant-'+variant+'.png'});
  return {variant,ids:expected,heading:true,anchors:true,accessible:true};
}
