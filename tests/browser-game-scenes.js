async page => {
  const base = page.url().split('#')[0].split('?')[0];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const ids = ['experience','certifications','education','awards'];
  const motionIds = ['interests','projects',...ids,'publications'];
  const errors = [], report = {layouts:[],motion:[]};
  const watch = error => errors.push(error.message);
  page.on('pageerror',watch);
  const go = async (tab,id) => { await tab.evaluate(id=>document.getElementById(id).scrollIntoView({behavior:'instant'}),id); await tab.waitForTimeout(1050); };
  try {
    for (const [width,height] of [[1440,1000],[1024,650],[390,844]]) {
      await page.setViewportSize({width,height});
      await page.goto(base+'?game='+width+'-'+Date.now());
      if(width>900) await page.locator('[data-ready=true]').waitFor();
      for(const id of ids) {
        await go(page,id);
        const layout = await page.locator('#'+id).evaluate(section=>{
          const panel=section.querySelector('[data-panel]'), copy=section.querySelector('[data-copy]');
          const heading=section.querySelector('header');
          const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
          return {id:section.id,panel:rect(panel),copy:rect(copy),heading:rect(heading),scrollWidth:document.documentElement.scrollWidth,active:!panel.inert,parts:[...copy.querySelectorAll('[data-enter]')].map(node=>({name:node.dataset.enter,...rect(node),scroll:node.scrollHeight,client:node.clientHeight}))};
        });
        check(layout.scrollWidth<=width+1,id+' causes horizontal overflow');
        check(layout.active,id+' is inert');
        if(width>900) {
          check(layout.parts.every(part=>part.bottom<=height-65&&part.y>=80), id+' exceeds desktop content area: '+JSON.stringify(layout));
          if(id==='certifications') check(layout.parts.every(part=>part.scroll<=part.client+2), 'Draft credentials should fit without an inner scroll');
        }
        report.layouts.push({width,...layout});
        await page.screenshot({path:`output/playwright/calm-${id}-${width}.png`});
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'?motion-game='+Date.now());
    await page.locator('[data-ready=true]').waitFor();
    for(const id of motionIds) {
      await go(page,'about');
      await go(page,id);
      const panel = page.locator('#'+id+' [data-panel]');
      check(await panel.locator('[data-enter]').evaluateAll(nodes=>nodes.every(n=>n.getAnimations().length===0)),id+' still starts separate flying panels');
      const edge=await page.evaluate(id=>{const n=document.getElementById(id).previousElementSibling;return n.offsetTop+innerHeight*(1+Number(n.dataset.transitionLength)/100*.8);},id);
      await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),edge);
      await page.waitForTimeout(100);
      const sample=()=>panel.evaluate(n=>{const c=getComputedStyle(n),m=new DOMMatrixReadOnly(c.transform);return {opacity:Number(c.opacity),x:m.m41,y:m.m42,scaleX:m.m11,scaleY:m.m22,skewX:m.m21,skewY:m.m12};});
      const first=await sample();
      check(first.opacity>.3&&first.opacity<.7,id+' has no gradual scroll fade');
      check(first.x===0&&first.y>=0&&first.y<=8&&first.scaleX===1&&first.scaleY===1&&first.skewX===0&&first.skewY===0,id+' still rotates/scales/slides sideways: '+JSON.stringify(first));
      await page.waitForTimeout(400);
      check(JSON.stringify(await sample())===JSON.stringify(first),id+' moves after scroll stops');
      check(await panel.locator('[data-enter]').evaluateAll(nodes=>nodes.every(n=>n.getAnimations().length===0)),id+' restarts motion on reverse scroll');
      if(id==='experience'||id==='education'||id==='awards') await page.screenshot({path:`output/playwright/calm-${id}-transition.png`});
      await go(page,id);
      check((await sample()).opacity===1&&(await sample()).y===0,id+' did not settle fully');
      report.motion.push({id,first});
    }
    // Reverse a half-complete transition, then skip across several chapters.
    await go(page,'experience');
    const edge=await page.evaluate(()=>{const n=document.getElementById('experience');return n.offsetTop+innerHeight*(1+Number(n.dataset.transitionLength)/100*.8);});
    await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),edge);
    await page.waitForTimeout(100);
    check(await page.locator('#certifications [data-panel]').evaluate(n=>Number(getComputedStyle(n).opacity)>0 && getComputedStyle(n).transform!=='none'),'Incoming screen has no soft scroll fade');
    await page.evaluate(()=>document.getElementById('experience').scrollIntoView({behavior:'instant'}));
    await page.waitForTimeout(80);
    await go(page,'awards');
    check(await page.locator('[data-enhanced=true]').getAttribute('data-active-kind')==='awards','Rapid reverse/skip selected wrong chapter');
    await page.locator('#awards [data-enter=diagonal-right] button').last().click();
    check(await page.locator('#awards [data-enter=diagonal-right] button').last().getAttribute('aria-pressed')==='true','Award selection failed');
    await go(page,'experience');
    const experience=page.locator('#experience');
    await experience.locator('[data-enter=right] button').nth(1).click();
    await experience.getByRole('button',{name:/경험 자세히/}).click();
    check(await page.getByRole('dialog',{name:'배움을 확장한 경험'}).isVisible(),'Experience dialog failed');
    await page.keyboard.press('Escape');
    for(const fallback of ['reduced','nojs','nogl']) {
      const context=await page.context().browser().newContext({viewport:{width:1440,height:1000},reducedMotion:fallback==='reduced'?'reduce':'no-preference',javaScriptEnabled:fallback!=='nojs'});
      if(fallback==='nogl') await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args);};});
      const tab=await context.newPage(); await tab.goto(base+'?game-fallback='+fallback);
      for(const id of ids) {
        await go(tab,id);
        check(await tab.locator('#'+id+' h2').isVisible(),fallback+' missing '+id);
        check(await tab.locator('#'+id).evaluate(n=>n.getBoundingClientRect().height>=n.querySelector('[data-copy]').getBoundingClientRect().height),fallback+' content escapes '+id);
        if(fallback==='reduced')check(await tab.locator('#'+id+' [data-enter]').evaluateAll(nodes=>nodes.every(n=>n.getAnimations().length===0)), 'Reduced motion animated');
      }
      check(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),fallback+' overflow');
      await context.close();
    }
    check(!errors.length,errors.join('\n'));
    return {layouts:report.layouts.map(({width,id})=>({width,id})),calmMotion:report.motion,reverse:true,selection:true,dialog:true,reduced:true,nojs:true,nogl:true,errors};
  } finally {page.off('pageerror',watch);}
}
