// Run through playwright-cli run-code --filename=tests/browser-check.js on a preview.
async page => {
  const base=page.url().split('#')[0].split('?')[0];
  const errors=[];const onError=error=>errors.push(error.message);const onConsole=m=>{if(m.type()==='error')errors.push(m.text());};
  page.on('pageerror',onError);page.on('console',onConsole);
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const samePixels=async(a,b)=>{
    if(a.equals(b))return true;
    return page.evaluate(async({a,b})=>{
      const pixels=async value=>{const bitmap=await createImageBitmap(await(await fetch('data:image/png;base64,'+value)).blob());const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);bitmap.close();return context.getImageData(0,0,canvas.width,canvas.height).data;};
      const x=await pixels(a),y=await pixels(b);let changed=0;
      if(x.length!==y.length)return false;
      for(let i=0;i<x.length;i+=4){let different=false;for(let c=0;c<3;c++){const delta=Math.abs(x[i+c]-y[i+c]);if(delta>1)return false;if(delta)different=true;}if(different)changed++;}
      // A few edge pixels can differ by one 8-bit value after GPU compositing.
      return changed/(x.length/4)<.001;
    },{a:a.toString('base64'),b:b.toString('base64')});
  };
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'?live-check');
  await page.locator('[data-ready=true]').waitFor();
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(500);
  const data=()=>page.locator('canvas').evaluate(node=>({...node.dataset}));
  const a=await data();await page.waitForTimeout(650);const b=await data();
  check(Number(b.videoTime)===Number(a.videoTime),'Video advanced without scrolling');
  await page.getByRole('button',{name:'배경 프레임 고정'}).click();await page.waitForTimeout(500);
  const frozen=await data();await page.waitForTimeout(300);
  check((await data()).videoTime===frozen.videoTime,'Pause did not preserve media time');
  const sections=await page.locator('[data-section]').evaluateAll(nodes=>nodes.map(node=>({id:node.id,start:node.getBoundingClientRect().top+scrollY,length:Number(node.dataset.transitionLength),effect:node.dataset.transitionEffect})));
  check(sections.length===11,'Missing sections');check(sections.filter(s=>s.effect!=='none').length===4,'Expected exactly four major cues');
  const captures=[];
  for(const item of sections){
    const top=item.start+1000+item.length*5;
    await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),item.length?top:item.start);await page.waitForTimeout(130);
    const result=await data();check(result.effect===item.effect,'Wrong cue: '+item.id);
    check(result.videoTime===frozen.videoTime,'Navigation reset video: '+item.id);
    if(item.effect!=='none'){
      check(Math.abs(Number(result.transition)-.5)<.005,'Wrong midpoint: '+item.id);
      check(await page.locator('[data-panel]').evaluateAll(nodes=>nodes.every(node=>Number(getComputedStyle(node).opacity)<.01)),'Text in major transition');
      await page.waitForTimeout(350);
      const before=await page.screenshot({path:'output/playwright/mismatch-before.png'});
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(100);
      await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),top);await page.waitForTimeout(400);
      const after=await page.screenshot();
      if(!await samePixels(before,after)){await page.screenshot({path:'output/playwright/mismatch-after.png'});throw new Error('Reverse/jump pixels changed: '+item.effect+' '+JSON.stringify(await data()));}
      await page.screenshot({path:'output/playwright/live-'+item.effect+'.png'});captures.push(item.effect);
    }
  }
  const interest=sections.find(s=>s.id==='interests');
  await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),interest.start);await page.waitForTimeout(250);
  await page.getByRole('tab',{name:'EEG / fMRI',exact:false}).click();
  await page.waitForTimeout(600);check((await data()).background.includes('scene-05-still'),'Selection did not change background');
  await page.getByRole('tab',{name:'SPEECH',exact:false}).click();await page.getByRole('tab',{name:'ALIGNMENT',exact:false}).click();
  await page.waitForTimeout(600);check((await data()).background.includes('scene-07-still'),'Latest selection lost');
  await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),sections[0].start+1400);await page.waitForTimeout(600);
  check((await data()).background.includes('scene-07-still'),'Major transition overlapped a background replacement');
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(600);
  check((await data()).background==='base','Deferred background did not return after transition');
  await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),sections[2].start);await page.waitForTimeout(600);
  check((await data()).background==='base','Section exit did not restore base');
  check((await data()).videoTime===frozen.videoTime,'Selection reset base time');
  await page.screenshot({path:'output/playwright/live-projects.png'});
  await page.getByRole('button',{name:'인터랙티브 포트폴리오 상세 보기',exact:true}).click();
  await page.getByRole('button',{name:'이전 상세 정보',exact:true}).click();
  check(await page.getByRole('dialog').getByRole('heading',{name:'다음 가능성을 위한 자리',exact:true}).count()===1,'Details escaped their section');
  await page.keyboard.press('Escape');await page.waitForTimeout(400);
  check(await page.getByRole('button',{name:'인터랙티브 포트폴리오 상세 보기',exact:true}).evaluate(n=>n===document.activeElement),'Dialog focus did not return');
  check(errors.length===0,'Console errors: '+errors.join('\n'));
  page.off('pageerror',onError);page.off('console',onConsole);
  return {idleStopped:true,frameLock:true,deterministicEffects:captures,latestSelection:true,majorDefersSelection:true,sectionScopedDetails:true,errors};
}
