// Historical filename retained: the three reference boundaries now use discrete navigation.
async page => {
  const base='http://127.0.0.1:3002/web-portfolio/';
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  await page.setViewportSize({width:1920,height:1080});
  await page.goto(base+'?reference-navigation#about');
  await page.locator('[data-ready=true]').waitFor();
  await page.waitForFunction(()=>Math.abs(document.getElementById('about').getBoundingClientRect().top)<1);
  await page.mouse.move(1800,600);
  await page.mouse.wheel(0,300);
  await page.waitForTimeout(350);
  const mid=await page.locator('#interests [data-panel]').evaluate(n=>({y:n.getBoundingClientRect().y,opacity:Number(getComputedStyle(n).opacity)}));
  check(mid.y>0&&mid.y<1080&&mid.opacity===1,'Interest page did not enter vertically');
  await page.screenshot({path:'output/playwright/reference-page-midpoint.png'});
  await page.waitForFunction(()=>Math.abs(document.getElementById('interests').getBoundingClientRect().top)<1);
  await page.waitForTimeout(500);
  check(await page.locator('canvas').getAttribute('data-suspended')==='true','Opaque interest stage did not suspend rendering');
  const frames=await page.locator('canvas').getAttribute('data-frames');
  for(let step=1;step<=4;step++) {
    await page.mouse.wheel(0,250);
    await page.waitForFunction(step=>document.querySelector('[data-widget=interests]')?.dataset.interestScrollStep===String(step),step);
    await page.waitForTimeout(350);
    check(await page.locator('[data-active-kind=interests]').count()===1,'Interest wipe left the section before its final step');
  }
  await page.mouse.wheel(0,250);
  await page.waitForTimeout(40);
  const out=await page.locator('#interests [data-panel]').evaluate(n=>Number(getComputedStyle(n).opacity));
  check(out<1,'Showcase departure did not fade');
  for(let i=0;i<5;i++){await page.mouse.wheel(0,100);await page.waitForTimeout(30);}
  await page.waitForTimeout(1200);
  check(await page.locator('[data-active-kind=projects]').count()===1,'One wheel gesture skipped multiple sections');
  await page.screenshot({path:'output/playwright/reference-work-entry.png'});
  await page.getByRole('navigation',{name:'섹션 탐색',exact:true}).getByRole('link',{name:'이력·역량',exact:true}).click();
  await page.waitForFunction(()=>Math.abs(document.getElementById('education').getBoundingClientRect().top)<1);
  await page.locator('[data-moving=false]').waitFor();
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.suspended==='false');
  await page.waitForFunction(()=>{const d=document.querySelector('canvas').dataset;return d.videoSeeking==='false'&&Math.abs(Number(d.videoTime)-Number(d.videoTarget))<.002;});
  check(Number(await page.locator('canvas').getAttribute('data-frames'))>Number(frames),'Leaving an opaque stage did not resume the video');
  await page.locator('#education').evaluate(n=>scrollTo({top:n.getBoundingClientRect().top+scrollY+innerHeight*1.225,behavior:'instant'}));
  await page.waitForTimeout(200);
  check(await page.locator('#education [data-panel]').evaluate(n=>Number(getComputedStyle(n).opacity))===0,'Final fade did not clear outgoing text');
  check(await page.locator('#contact [data-panel]').evaluate(n=>Number(getComputedStyle(n).opacity))===0,'Final fade entered too soon');
  await page.locator('#interests').evaluate(n=>n.scrollIntoView({behavior:'instant'}));
  await page.waitForTimeout(300);
  await page.getByRole('navigation',{name:'섹션 탐색',exact:true}).getByRole('link',{name:'소개',exact:true}).click();
  await page.waitForTimeout(350);
  const reverse=await page.locator('#about [data-panel]').evaluate(n=>n.getBoundingClientRect().y);
  check(reverse<0&&reverse>-1080,'Reverse page transition has the wrong direction');
  await page.waitForFunction(()=>Math.abs(document.getElementById('about').getBoundingClientRect().top)<1);
  return {verticalPage:true,reversePage:true,showcaseExit:true,oneGestureOneSection:true,opaqueVideoSuspended:true,videoResumed:true,finalFade:true};
}
