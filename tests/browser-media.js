// Scroll seeking, rapid reversals, deep links and the hidden-tab path.
async page => {
  const base=page.url().split('#')[0].split('?')[0];
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{
    window.testMedia=[];window.testPlayCalls=0;window.testOverlappingSeeks=0;
    const create=document.createElement.bind(document),time=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime');
    document.createElement=function(name,...args){const node=create(name,...args);if(name==='video')window.testMedia.push(node);return node;};
    Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{...time,set(value){if(this.seeking)window.testOverlappingSeeks++;time.set.call(this,value);}});
    HTMLMediaElement.prototype.play=function(){window.testPlayCalls++;return Promise.reject(new DOMException('Unexpected autoplay','NotAllowedError'));};
  });
  const tab=await context.newPage();const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const errors=[];tab.on('pageerror',e=>errors.push(e.message));tab.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const data=()=>tab.locator('canvas').evaluate(node=>({...node.dataset}));
  const move=p=>tab.evaluate(p=>{const start=document.querySelector('[data-section]').getBoundingClientRect().top+scrollY;scrollTo({top:Math.round(start+(document.documentElement.scrollHeight-innerHeight-start)*p),behavior:'instant'});},p);
  const settle=()=>tab.waitForFunction(()=>{
    const video=window.testMedia.find(v=>v.src),canvas=document.querySelector('canvas');
    if(!video || !canvas)return false;
    const start=document.querySelector('[data-section]').getBoundingClientRect().top+scrollY;
    const p=Math.max(0,(scrollY-start)/(document.documentElement.scrollHeight-innerHeight-start));
    const target=Math.min(Math.ceil(video.duration*30)-1,Math.floor(p*video.duration*30))/30;
    return !video.seeking && canvas.dataset.videoSeeking==='false' && Math.abs(Number(canvas.dataset.videoTime)-target)<.002;
  });
  try{
    await tab.goto(base);await tab.locator('[data-ready=true]').waitFor();await settle();
    const duration=await tab.evaluate(()=>window.testMedia.find(v=>v.src).duration);
    const times=[];
    for(const p of [.06,.75,.06,.99,0,.08]){await move(p);await settle();times.push(Number((await data()).videoTime));}
    check(times[1]>times[0] && times[2]===times[0] && times[4]===0,'Forward/reverse frames did not match scroll');
    const frozen=await data();await tab.waitForTimeout(500);const idle=await data();
    check(idle.videoTime===frozen.videoTime,'Video advanced while scroll stopped');
    check(Number(idle.frames)-Number(frozen.frames)<=2,'Idle renderer kept running');
    await tab.evaluate(async()=>{const start=document.querySelector('[data-section]').getBoundingClientRect().top+scrollY;for(const p of [.1,.9,.6,.05,.8,.08]){scrollTo({top:start+(document.documentElement.scrollHeight-innerHeight-start)*p,behavior:'instant'});await new Promise(requestAnimationFrame);}});
    await settle();check(Number((await data()).videoTime)<duration*.09,'Rapid input did not settle on the latest request');
    await tab.getByRole('navigation',{name:'주요 메뉴',exact:true}).getByRole('link',{name:'작업·경험',exact:true}).click();
    await tab.waitForFunction(()=>Math.abs(document.getElementById('projects').getBoundingClientRect().top)<1);
    await tab.waitForFunction(()=>document.querySelector('canvas').dataset.suspended==='true');
    const covered=await data();await tab.waitForTimeout(500);check((await data()).frames===covered.frames,'Opaque work stage kept rendering video');
    check(Number((await data()).videoTime)>0,'Menu reset video to its first frame');
    await tab.getByRole('button',{name:'배경 프레임 고정',exact:true}).click();const locked=(await data()).videoTime;
    await move(.85);await tab.waitForTimeout(350);check((await data()).videoTime===locked,'Frame lock ignored');
    await tab.getByRole('button',{name:'배경 스크롤 연동 켜기',exact:true}).click();await settle();
    const hidden=await tab.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));return {time:window.testMedia.find(v=>v.src).currentTime,frames:document.querySelector('canvas').dataset.frames};});
    await move(.1);await tab.waitForTimeout(250);
    check((await data()).frames===hidden.frames,'Hidden renderer advanced');
    check(await tab.evaluate(t=>window.testMedia.find(v=>v.src).currentTime===t,hidden.time),'Hidden media sought new frames');
    await tab.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await settle();
    const calls=await tab.evaluate(()=>({play:window.testPlayCalls,overlap:window.testOverlappingSeeks}));
    check(calls.play===0 && calls.overlap===0,'Autoplay or overlapping seeks: '+JSON.stringify(calls));
    await tab.goto(base+'?deep-link#skills');await tab.locator('[data-ready=true]').waitFor();await settle();
    await tab.waitForFunction(()=>Math.abs(document.getElementById('education').getBoundingClientRect().top)<1);
    check(await tab.locator('#education-category-skills').getAttribute('aria-selected')==='true','Skills deep link did not select its profile tab');
    await tab.reload();await tab.locator('[data-ready=true]').waitFor();
    await tab.waitForFunction(()=>Math.abs(document.getElementById('education').getBoundingClientRect().top)<1);await settle();
    check(await tab.locator('#education-category-skills').getAttribute('aria-selected')==='true','Reload lost the skills tab');
    const expected=await tab.evaluate(()=>{
      const video=window.testMedia.find(v=>v.src),start=document.getElementById('about').getBoundingClientRect().top+scrollY;
      const education=document.getElementById('education').getBoundingClientRect().top+scrollY;
      const progress=(education-start)/(document.documentElement.scrollHeight-innerHeight-start);
      return {progress,time:Math.min(Math.ceil(video.duration*30)-1,Math.floor(progress*video.duration*30))/30};
    });
    check(expected.progress>0 && expected.progress<1,'Merged profile has no valid video position');
    check(Math.abs(Number((await data()).videoTime)-expected.time)<.002,'Deep link video frame does not match the merged education position');
    await tab.screenshot({path:'output/playwright/scroll-frame-skills.png'});
    check(errors.length===0,errors.join('\n'));
    return {scrollFrames:true,idleStopped:true,reverse:true,latestSeek:true,menu:true,frameLock:true,hiddenSuspended:true,deepLink:true,duration,times,errors};
  }finally{await context.close();}
}
