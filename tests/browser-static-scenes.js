async page => {
  const base=page.url().split('#')[0].split('?')[0];const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const browser=page.context().browser(),results=[];
  for(const mode of ['no-js','no-webgl','reduced','touch']) {
    const context=await browser.newContext({viewport:mode==='touch'?{width:390,height:844}:{width:1440,height:1000},javaScriptEnabled:mode!=='no-js',reducedMotion:mode==='reduced'?'reduce':'no-preference',hasTouch:mode==='touch'});
    const tab=await context.newPage(),requests=[];
    tab.on('request',request=>{if(/\.mp4|\.bin/.test(request.url()))requests.push(request.url());});
    if(mode==='no-webgl')await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});
    try {
      await tab.goto(base);await tab.waitForTimeout(600);
      check(await tab.locator('canvas').count()===0 && requests.length===0,'Static mode loaded media: '+mode);
      for(const id of ['interests','projects','publications']) {
        // Native link navigation works even when JavaScript is disabled.
        await tab.goto(base+'#'+id);await tab.waitForTimeout(150);
        const section=tab.locator('#'+id);check(await section.locator('[data-copy]').isVisible(),'Static scene missing: '+id);
        const rect=await section.boundingBox(),copy=await section.locator('[data-copy]').boundingBox();
        check(copy.y+copy.height<=rect.y+rect.height+1,'Static content overlaps next section: '+id+' '+mode);
        check(await tab.locator('html').evaluate(n=>n.scrollWidth<=innerWidth),'Static overflow: '+mode);
        await tab.screenshot({path:`output/playwright/static-${mode}-${id}.png`});
      }
      if(mode==='no-js')check(await tab.locator('#projects h3').count()>=4,'No-JS records missing');
      else {
        await tab.goto(base+'#projects');
        const choice=tab.locator('#projects').getByRole('tab').nth(1);
        if(mode==='touch')await choice.tap();else await choice.click();
        check(await choice.getAttribute('aria-selected')==='true','Static choice failed');
        const open=tab.locator('#projects').getByRole('button',{name:'질문에서 시작한 실험 상세 보기',exact:true});
        if(mode==='touch')await open.tap();else await open.click();
        check(await tab.getByRole('dialog').isVisible(),'Static reading failed');
      }
      results.push(mode);
    } finally {await context.close();}
  }
  return {staticScenes:results,noMedia:true,nativeLinks:true,touchReading:true};
}
