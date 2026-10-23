// The three content scenes: screenshots, distinct reading layouts, failure/late-art paths.
async page => {
  const base=page.url().split('#')[0].split('?')[0];
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const errors=[];const watch=e=>errors.push(e.message);page.on('pageerror',watch);
  const captures=[];
  try {
    for(const [width,height] of [[1440,1000],[1024,650],[390,844]]) {
      await page.setViewportSize({width,height});await page.goto(base+'?scenes='+width);
      if(width>900)await page.locator('[data-ready=true]').waitFor();
      check(await page.locator('[data-copy]>noscript').evaluateAll(nodes=>nodes.every(n=>{const range=document.createRange();range.selectNodeContents(n);return [...range.getClientRects()].every(rect=>!rect.width||!rect.height);})), 'No-JS source text leaked into the interactive layout');
      for(const id of ['interests','projects','publications']) {
        await page.evaluate(id=>document.getElementById(id).scrollIntoView({behavior:'instant'}),id);await page.waitForTimeout(650);
        check(await page.locator('#'+id+' [data-copy]').isVisible(),'Scene missing: '+id);
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow: '+id+' '+width);
        const path=`output/playwright/final-${id}-${width}.png`;await page.screenshot({path});captures.push(path);
      }
      const publication=page.locator('#publications');
      await publication.getByRole('tab').last().click();
      check(await publication.getByRole('tabpanel').getByText('다음 질문을 위한 빈 페이지.',{exact:true}).count()>=1,'Empty document unavailable');
      await publication.getByRole('tab').first().click();
      const paperOpen=publication.getByRole('button',{name:/상세 보기/});await paperOpen.click();
      const dialog=page.getByRole('dialog');
      check(await dialog.locator('[data-reading=paper]').count()===1,'Paper reading layout missing');
      const toc=dialog.getByRole('navigation',{name:'논문 목차'});
      check(await toc.getByRole('link').count()===4,'Paper contents missing');
      await toc.getByRole('link',{name:'검증',exact:true}).click();
      check(await dialog.getByRole('heading',{name:'검증',exact:true}).isVisible(),'TOC target missing');
      await dialog.evaluate(n=>n.scrollTop=0);
      await page.screenshot({path:`output/playwright/final-paper-detail-${width}.png`});
      await page.keyboard.press('Escape');await page.waitForTimeout(350);
      check(await paperOpen.evaluate(n=>n===document.activeElement),'Paper focus did not return');
      await page.evaluate(()=>document.getElementById('projects').scrollIntoView({behavior:'instant'}));await page.waitForTimeout(350);
      const projects=page.locator('#projects');
      check(await projects.getByRole('tab').count()===4,'Project list missing');
      check(await projects.locator('[aria-label="프로젝트 썸네일"]').count()===0,'Duplicate thumbnail strip remains');
      await projects.getByRole('tab').first().focus();await page.keyboard.press('ArrowDown');
      check(await projects.getByRole('tab').nth(1).getAttribute('aria-selected')==='true','Vertical list keyboard failed');
      await projects.getByRole('tab').first().click();
      const open=projects.getByRole('button',{name:'인터랙티브 포트폴리오 상세 보기',exact:true});await open.click();
      check(await dialog.locator('[data-reading=project]').count()===1,'Project reading layout missing');
      for(const title of ['문제','접근','구현','검증','회고'])check(await dialog.getByRole('heading',{name:title,exact:true}).count()===1,'Work chapter missing: '+title);
      await page.screenshot({path:`output/playwright/final-project-detail-${width}.png`});
      await dialog.getByRole('button',{name:'이전 상세 정보',exact:true}).click();
      check(await dialog.getByRole('heading',{name:'다음 가능성을 위한 자리',exact:true}).isVisible(),'Details escaped projects');
      await page.keyboard.press('Escape');await page.waitForTimeout(350);
      check(await open.evaluate(n=>n===document.activeElement),'Project focus did not return');
    }
    const context=await page.context().browser().newContext({viewport:{width:1440,height:1000}});
    const tab=await context.newPage();
    let release;const blocked=new Promise(resolve=>release=resolve);
    try {
      await tab.route('**/project-experiment.webp',async route=>{await blocked;await route.continue();});
      await tab.route('**/project-next.webp',route=>route.abort());
      await tab.goto(base+'?slow-art#projects');await tab.locator('[data-ready=true]').waitFor();
      const projects=tab.locator('#projects'),art=projects.locator('figure[data-art-src]');
      await projects.getByRole('tab').nth(1).click();
      check((await art.getAttribute('data-art-src')).includes('project-portfolio'),'Slow art replaced current poster');
      await projects.getByRole('tab').nth(2).click();
      await tab.waitForFunction(()=>document.querySelector('#projects [data-art-src]')?.dataset.artSrc.includes('project-observation'));
      release();await tab.waitForTimeout(600);
      check((await art.getAttribute('data-art-src')).includes('project-observation'),'Stale image replaced current poster');
      await projects.getByRole('tab').last().click();
      await tab.waitForFunction(()=>document.querySelector('#projects [data-art-state]')?.dataset.artState==='error');
      check((await art.getAttribute('data-art-src')).includes('project-observation'),'Failed image erased previous poster');
      await projects.getByRole('button',{name:'다음 가능성을 위한 자리 상세 보기'}).click();
      check(await tab.getByRole('dialog').getByRole('heading',{name:'다음 가능성을 위한 자리',exact:true}).isVisible(),'Image failure blocked reading');
    } finally {release();await context.close();}
    check(errors.length===0,errors.join('\n'));
    return {captures,distinctReaders:true,contents:true,focusReturn:true,keyboard:true,emptyDocument:true,lateImage:true,imageFailure:true,errors};
  } finally {page.off('pageerror',watch);}
}
