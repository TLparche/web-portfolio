// Slow first decode and slow selection never reveal an unprepared canvas or stale asset.
async page => {
  const base=page.url().split('#')[0].split('?')[0];
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}});
  const tab=await context.newPage();const errors=[];tab.on('pageerror',e=>errors.push(e.message));
  let releaseVideo;const blocked=new Promise(resolve=>{releaseVideo=resolve;});
  await tab.route('**/*.mp4',async route=>{await blocked;await route.continue();});
  try{
    await tab.goto(base+'?loading#interests',{waitUntil:'domcontentloaded'});
    await tab.locator('[data-enhanced=true]').waitFor();
    check(await tab.locator('[data-ready=false]').count()===1,'Unprepared canvas revealed');
    const poster=tab.locator('#interests > [data-panel] > figure');
    const bounds=await poster.boundingBox();
    check(bounds.width>=1420 && bounds.height===1000 && Math.abs(bounds.y)<1,'Poster is not full screen');
    check(await poster.locator('img').evaluate(n=>n.currentSrc.includes('scene-01-still')),'Desktop poster differs between sections');
    await tab.screenshot({path:'output/playwright/background-poster.png'});
    releaseVideo();await tab.locator('[data-ready=true]').waitFor();await tab.waitForTimeout(400);
    check(await poster.evaluate(n=>getComputedStyle(n).visibility)==='hidden','Poster remains above prepared video');
    const requests=[];tab.on('request',r=>{if(/entry|exit|\.bin/.test(r.url()))requests.push(r.url());});
    await tab.evaluate(()=>document.getElementById('publications').scrollIntoView({behavior:'instant'}));await tab.waitForTimeout(200);
    check(await tab.locator('[data-ready=true]').count()===1,'Navigation re-exposed the poster');
    check(requests.length===0,'Live transitions still load endpoint frames');
    await tab.evaluate(()=>document.getElementById('interests').scrollIntoView({behavior:'instant'}));await tab.waitForTimeout(200);
    // Delay a selection, then supersede it before its image can complete.
    await tab.route('**/scene-05-still.webp',async route=>{await tab.waitForTimeout(700);await route.continue();});
    await tab.getByRole('tab',{name:'EEG / fMRI',exact:false}).click();
    await tab.getByRole('tab',{name:'SPEECH',exact:false}).click();
    await tab.waitForTimeout(1000);
    check((await tab.locator('canvas').getAttribute('data-background')).includes('scene-10-still'),'Late asset replaced newest selection');
    check(await tab.locator('[data-ready=true]').count()===1,'Slow selection hid the renderer');
    check(errors.length===0,errors.join('\n'));
    return {fullPoster:true,decodedHandoff:true,noEndpoints:true,latestSelection:true};
  }finally{releaseVideo();await context.close();}
}
