// Shared representatives, category details, five interests and accessible fallbacks.
async page => {
  const base='http://127.0.0.1:3002/web-portfolio/';
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const errors=[];
  const consoleError=event=>{if(event.type()==='error')errors.push(event.text());};
  page.on('console',consoleError);
  const anchors=[['experience','projects'],['activities','projects'],['publications','projects'],['certifications','education'],['awards','education'],['skills','education']];
  const workKinds=['projects','experience','publications','activities'];
  const workTitles=['프로젝트','경험','연구','활동'];
  const featuredTitles=['프로젝트 01','경험 01','연구 01','활동 01','프로젝트 02','연구 02'];
  const prefixes={projects:'project',experience:'experience',publications:'research',activities:'activity'};
  const work=page.locator('[data-widget=works]');
  const cards=work.locator('[data-work-list][aria-hidden=false] button[data-work-card]');
  const activeDetail=()=>work.locator('[data-work-detail][data-work-detail-active=true]');
  const detailSelected=async(kind,index)=>{
    const id='showcase-'+prefixes[kind]+'-'+String(index+1).padStart(2,'0');
    await page.waitForFunction(({kind,id})=>{
      const root=document.querySelector('[data-widget=works]');
      const detail=root?.querySelector('[data-work-detail][data-work-detail-active=true]');
      return root?.dataset.view==='detail'&&root.dataset.category===kind&&detail?.dataset.itemId===id;
    },{kind,id});
    await activeDetail().locator('[data-work-detail-item][aria-hidden=false]').getByRole('heading',{name:workTitles[workKinds.indexOf(kind)]+' '+String(index+1).padStart(2,'0'),exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('[data-work-detail-active=true] button[data-work-thumbnail]').length===6);
    check(await page.locator('dialog[open]').count()===0,'Work details must stay inside the scene');
  };
  const selectedInterest=async id=>{
    await page.waitForFunction(id=>{
      const root=document.querySelector('[data-widget=interests]');
      return root?.dataset.shownId===id&&root.dataset.interestState==='ready'&&root.dataset.interestPhase==='idle';
    },id);
    check(await page.locator('#interests-tab-'+id).getAttribute('aria-selected')==='true','Interest selection lost '+id);
  };
  const baseUnchanged=async()=>{
    check(await page.locator('canvas').getAttribute('data-background')==='base','Selection replaced the base video');
    check(await page.locator('canvas').getAttribute('data-players')==='1','Selection created another video player');
  };
  const jump=async id=>{
    await page.locator('nav[aria-label="섹션 탐색"] a[href="#'+id+'"]').click();
    await page.waitForFunction(id=>Math.abs(document.getElementById(id).getBoundingClientRect().top)<1,id);
    await page.locator('#'+id+' > [data-panel]:not([aria-hidden=true])').waitFor();
  };
  try {
    await page.setViewportSize({width:1440,height:1000});
    for(const [hash,owner] of anchors) {
      await page.goto(base+'?merged-check='+hash+'#'+hash);
      await page.locator('[data-ready=true]').waitFor();
      await page.waitForFunction(owner=>Math.abs(document.getElementById(owner).getBoundingClientRect().top)<1,owner);
      check(await page.locator('#'+owner+'-category-'+hash).getAttribute('aria-selected')==='true','Old anchor did not select '+hash);
      check(await page.locator('[data-section]').count()===5,'Expected five sections');
      await page.reload();
      await page.locator('[data-ready=true]').waitFor();
      await page.waitForFunction(owner=>Math.abs(document.getElementById(owner).getBoundingClientRect().top)<1,owner);
      check(await page.locator('#'+owner+'-category-'+hash).getAttribute('aria-selected')==='true','Reload lost '+hash);
    }
    await page.goto(base+'?merged-interaction#projects');
    await page.locator('[data-ready=true]').waitFor();
    const categories=work.locator('[role=tab][id^="projects-category-"]');
    check(await categories.count()===4,'Work categories missing');
    check((await categories.evaluateAll(nodes=>nodes.map(n=>n.id))).join(',')===workKinds.map(kind=>'projects-category-'+kind).join(','),'Work category order changed');
    check(await cards.count()===6,'Shared gallery must contain six representatives');
    for(let index=0;index<6;index++)check((await cards.nth(index).innerText()).includes(featuredTitles[index]),'Representative order changed at '+index);
    await page.waitForTimeout(1350);
    const hoverPoint=await cards.nth(2).evaluate(node=>{const r=node.getBoundingClientRect();return {x:r.left+r.width*850/1920,y:r.top+r.height*497/1080};});
    await page.mouse.move(hoverPoint.x,hoverPoint.y);
    await page.waitForFunction(()=>document.querySelectorAll('button[data-work-card]')[2]?.getAttribute('aria-expanded')==='true');
    check(await work.getAttribute('data-view')==='list','Hover opened detail');
    await page.mouse.move(10,70);
    await page.waitForFunction(()=>![...document.querySelectorAll('button[data-work-card]')].some(node=>node.getAttribute('aria-expanded')==='true'));
    await baseUnchanged();
    await cards.first().focus();
    await page.keyboard.press('End');
    check(await cards.last().evaluate(node=>node===document.activeElement),'End did not focus the last representative');
    await page.keyboard.press('Enter');
    await detailSelected('publications',1);
    check(await work.locator('button[data-work-thumbnail]').count()===6,'A category must expose six detail thumbnails');
    await work.locator('button[data-work-page]').last().click();
    await detailSelected('publications',5);
    check(await work.locator('[data-work-thumbnail-track]').getAttribute('data-offset')==='4','Last item should leave the final two thumbnails in view');
    await page.mouse.move(1000,300);
    const scrollBefore=await page.evaluate(()=>scrollY);
    await page.mouse.wheel(0,900);
    await detailSelected('publications',0);
    check(Math.abs(await page.evaluate(()=>scrollY)-scrollBefore)<1,'Detail wheel escaped into page navigation');
    await page.waitForTimeout(550);
    await page.mouse.wheel(0,-900);
    await detailSelected('publications',5);
    await page.keyboard.press('Escape');
    await work.locator('[data-work-list]:not([hidden])').waitFor();
    check(await work.getAttribute('data-view')==='list','Escape did not restore the shared list');
    check(await cards.last().evaluate(node=>node===document.activeElement),'Escape did not restore the opening representative focus');
    for(const kind of workKinds) {
      await page.waitForTimeout(710);
      await page.locator('#projects-category-'+kind).click();
      await detailSelected(kind,0);
      check(await work.locator('button[data-work-thumbnail]').count()===6,'Six thumbnails missing for '+kind);
      check((await activeDetail().innerText()).includes('결과 입력 예정'),'Placeholder result missing for '+kind);
    }
    check(await work.locator('[data-widget=activities]').count()===0,'Activities still use a separate legacy detail UI');
    await work.getByRole('button',{name:/돌아가기|목록으로/}).click();
    await work.locator('[data-work-list]:not([hidden])').waitFor();
    check(await cards.count()===6,'Back did not restore the common six representatives');
    await baseUnchanged();
    await jump('interests');
    const interests=page.locator('[data-widget=interests]');
    check(await interests.locator('[role=tab]').count()===5,'Exactly five accessible interest tabs are required');
    await selectedInterest('bci');
    await page.locator('#interests-tab-alignment').hover();
    await page.waitForTimeout(160);
    await selectedInterest('bci');
    await interests.getByRole('button',{name:'이전 관심분야',exact:true}).click();
    await selectedInterest('speech');
    await page.locator('#interests-tab-speech').focus();
    await page.keyboard.press('Home');
    await selectedInterest('bci');
    check(await interests.getAttribute('data-instant')==='true','Keyboard interest selection should be immediate');
    check(await interests.getByRole('button',{name:/탐구 노트/}).count()===0,'The old exploration toggle remains');
    check(await interests.locator('#interests-extension').count()===0,'The old exploration panel remains');
    for(const label of ['관심 이유','접근 방법','활용 방향'])check(await interests.locator('[role=tabpanel]:not([hidden]) [data-interest-reading]').getByText(label,{exact:true}).count()===1,'Integrated reading content missing '+label);
    await baseUnchanged();
    await jump('education');
    check(await page.locator('[data-chapter-group=education] > [role=tablist] [role=tab]').count()===4,'Profile categories missing');
    await page.locator('#education-category-skills').click();
    check(await page.locator('[data-evidence=skills] dl > div').count()===4,'Four skill fields missing');
    check(await page.locator('[data-evidence=skills]').getByText('숙련도 입력 전',{exact:true}).count()===4,'Unentered proficiency was invented');
    for(const fallback of ['reduced','nojs','nogl']) {
      const context=await page.context().browser().newContext({viewport:{width:1024,height:650},javaScriptEnabled:fallback!=='nojs',reducedMotion:fallback==='reduced'?'reduce':'no-preference'});
      if(fallback==='nogl')await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args);};});
      const tab=await context.newPage();
      try {
        await tab.goto(base+'?merged-fallback='+fallback+'#awards');
        if(fallback!=='nojs') {
          await tab.waitForFunction(()=>document.querySelector('#education-category-awards')?.getAttribute('aria-selected')==='true');
          check(await tab.locator('#education-category-panel-awards').isVisible(),fallback+' hides requested awards');
          check(await tab.locator('canvas').count()===0,fallback+' mounted animated background');
        } else {
          for(const [id] of anchors)check(await tab.locator('#'+id).evaluate(node=>node.parentElement.checkVisibility()),'No-JS hides '+id);
          for(const prefix of workTitles)for(let number=1;number<=6;number++){
            const title=prefix+' '+String(number).padStart(2,'0');
            check(await tab.locator('[data-work-static]').getByRole('heading',{name:title,exact:true}).isVisible(),'No-JS hides '+title);
          }
          check(await tab.locator('[data-interest-static] article').count()===5,'No-JS interest notes missing');
          check(await tab.locator('[data-evidence=skills]').getByText('PyTorch · Braindecode · scikit-learn',{exact:true}).isVisible(),'No-JS skill tools missing');
        }
        check(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),fallback+' horizontal overflow');
      } finally {await context.close();}
    }
    check(!errors.length,errors.join('\n'));
    return {sections:5,oldAnchors:6,workCategories:4,profileCategories:4,showcasePlaceholders:24,featuredRepresentatives:6,hoverPreviewRetracts:true,inlineDetail:true,keyboardEndEnter:true,detailWheelWraps:true,focusRestored:true,unifiedActivities:true,interestCards:5,integratedNotes:true,skillRecords:true,baseVideoUnchanged:true,reduced:true,nojs:true,nogl:true,errors};
  } finally {page.off('console',consoleError);}
}
