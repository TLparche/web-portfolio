// Reference composition, clipped card hit targets and details at three review sizes.
async page => {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const base='http://127.0.0.1:3002/web-portfolio/';
  const topics=['bci','eeg-fmri','alignment','representation','speech'];
  const results=[];
  for(const [width,height] of [[1440,1000],[1024,650],[390,844]]) {
    const touch=width<=900;
    const context=await page.context().browser().newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
    const tab=await context.newPage();
    try {
      await tab.goto(base+'?showcase-layout='+width+'#interests');
      if(!touch)await tab.locator('[data-ready=true]').waitFor();
      await tab.evaluate(()=>document.fonts.ready);
      const interest=tab.locator('[data-widget=interests]');
      for(let index=0;index<topics.length;index++) {
        const id=topics[index];
        if(index)await interest.getByRole('button',{name:'다음 관심분야',exact:true}).click();
        await tab.waitForFunction(id=>{
          const root=document.querySelector('[data-widget=interests]');
          return root?.dataset.shownId===id&&root.dataset.interestState==='ready'&&root.dataset.interestPhase==='idle';
        },id);
        const geometry=await interest.evaluate(root=>{
          const reading=root.querySelector('[role=tabpanel]:not([hidden]) [data-interest-reading]').getBoundingClientRect();
          const controls=root.querySelector('[data-interest-controls]').getBoundingClientRect();
          const selected=root.querySelector('[role=tab][aria-selected=true]').getBoundingClientRect();
          const rail=root.querySelector('[role=tablist]').getBoundingClientRect();
          const visibleCards=[...root.querySelector('[data-interest-track]').children].filter(node=>{
            const box=node.getBoundingClientRect();
            return box.right>rail.left+1&&box.left<rail.right-1;
          });
          return {
            clear:reading.bottom<=controls.top+1,
            readingVisible:reading.top>=0&&reading.bottom<=innerHeight&&reading.height>40,
            controlsVisible:controls.top>=0&&controls.bottom<=innerHeight+1,
            visibleCards:visibleCards.length,
            accessibleTabs:root.querySelectorAll('[role=tab]').length,
            centered:Math.abs(selected.left+selected.width/2-rail.left-rail.width/2)<2,
            overflow:document.documentElement.scrollWidth>innerWidth+1
          };
        });
        check(geometry.clear,width+': '+id+' reading overlaps cards');
        check(geometry.readingVisible&&geometry.controlsVisible,width+': reading or selector is outside the scene');
        check(geometry.accessibleTabs===5&&geometry.visibleCards===5,width+': expected five accessible topics and five visible rail cards');
        check(geometry.centered,width+': selected interest is not centered');
        check(!geometry.overflow,width+': horizontal overflow');
      }
      await tab.screenshot({path:'output/playwright/redesign-'+width+'-interests.png'});
      await tab.goto(base+'?showcase-layout='+width+'#projects');
      if(!touch)await tab.locator('[data-ready=true]').waitFor();
      const work=tab.locator('[data-widget=works]');
      const cards=work.locator('[data-work-list][aria-hidden=false] button[data-work-card]');
      await cards.first().waitFor();
      check(await cards.count()===6,'Shared representatives missing at '+width);
      await tab.waitForTimeout(1350);
      await tab.screenshot({path:'output/playwright/redesign-'+width+'-projects.png'});
      const point=await cards.first().evaluate((node,touch)=>{
        const r=node.getBoundingClientRect();
        return touch?{x:r.left+r.width*.5,y:r.top+r.height*.45}:{x:r.left+r.width*629/1920,y:r.top+r.height*354/1080};
      },touch);
      if(touch)await tab.touchscreen.tap(point.x,point.y);
      else await tab.mouse.move(point.x,point.y);
      await tab.waitForFunction(()=>document.querySelector('button[data-work-card]')?.getAttribute('aria-expanded')==='true');
      check(await work.getAttribute('data-view')==='list','Preview opened detail at '+width);
      await tab.waitForTimeout(550);
      if(touch)await tab.touchscreen.tap(point.x,point.y);
      else await tab.mouse.click(point.x,point.y);
      const detail=work.locator('[data-work-detail][data-work-detail-active=true]');
      await detail.locator('[data-work-detail-item="showcase-project-01"][aria-hidden=false]').getByRole('heading',{name:'프로젝트 01',exact:true}).waitFor();
      await tab.waitForTimeout(800);
      await tab.screenshot({path:'output/playwright/redesign-'+width+'-detail.png'});
      check(await detail.locator('button[data-work-thumbnail]').count()===6,width+': six detail thumbnails missing');
      const reading=await detail.locator('[data-work-detail-item][aria-hidden=false] [data-scene-scroll]').boundingBox();
      check(reading&&reading.y>=0&&reading.y+reading.height<=height+1,width+': detail reading is outside viewport');
      await detail.getByRole('button',{name:'돌아가기',exact:true}).click();
      await cards.first().waitFor();
      check(await cards.count()===6,width+': Back lost the common representatives');
      await tab.locator('#projects-category-activities').click();
      await detail.locator('[data-work-detail-item="showcase-activity-01"][aria-hidden=false]').getByRole('heading',{name:'활동 01',exact:true}).waitFor();
      await tab.waitForTimeout(800);
      check(await detail.locator('button[data-work-thumbnail]').count()===6,width+': activity details missing');
      check(await work.locator('[data-widget=activities]').count()===0,width+': activity UI is not unified');
      await tab.screenshot({path:'output/playwright/redesign-'+width+'-activity.png'});
      check(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+': detail overflow');
      results.push({width,height,topics:5,visibleCards:5,centeredCards:true,readingClear:true,representatives:6,touchPreviewThenOpen:touch,categoryFirstDetail:true,unifiedActivities:true});
    } finally {await context.close();}
  }
  return results;
}
