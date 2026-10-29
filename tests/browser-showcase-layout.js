async page => {
  const base=process.env.PREVIEW_URL || 'http://127.0.0.1:3111/web-portfolio/';
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const results=[];
  for(const [width,height] of [[2560,1215],[1920,1080],[1600,801],[1440,900],[1366,768],[1280,720],[1024,768],[1366,600]]) {
    await page.setViewportSize({width,height});
    await page.goto(base+'#projects');
    await page.getByRole('progressbar',{name:'첫 장면 준비'}).waitFor({state:'hidden'});
    const work=page.locator('[data-widget=works]');
    await work.locator('#work-domain-platform').waitFor();
    check(await work.locator('[data-work-domain]').count()===6,width+': six domains');
    check(await work.locator('[data-work-domain]').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).clipPath.startsWith('polygon('))),width+': diagonal geometry');
    const rail=work.locator('[data-work-list]');
    const entry=await rail.boundingBox();
    await page.mouse.move(entry.x+2,entry.y+2);
    const findAt=async(domain=null)=>await work.evaluate((root,id)=>{
      const area=root.querySelector('[data-work-list]').getBoundingClientRect(),y=Math.round(area.top+area.height/2);
      for(let x=Math.ceil(area.left+20);x<area.right-20;x++) {
        const hit=document.elementFromPoint(x,y),card=hit?.closest('[data-work-domain]');
        if(id?card?.dataset.workDomain===id:hit?.matches('[data-work-list]'))return {x:x+3,y};
      }
    },domain);
    const target=await findAt('ai');
    await page.mouse.move(target.x,target.y,{steps:12});
    await page.waitForFunction(()=>document.querySelector('#work-domain-ai')?.getAttribute('aria-expanded')==='true');
    await page.waitForFunction(()=>{const b=document.querySelector('#work-domain-ai');return getComputedStyle(b).clipPath===b.style.clipPath;});
    const gap=await findAt();
    await page.mouse.move(gap.x,gap.y,{steps:12});
    await page.waitForTimeout(150);
    check(await work.locator('#work-domain-ai').getAttribute('aria-expanded')==='true',width+': a stationary pointer in a gallery gap keeps the preview open');
    await page.mouse.move(entry.x-10,entry.y-10);
    await page.waitForFunction(()=>!document.querySelector('[data-work-domain][aria-expanded=true]'));
    await work.locator('#work-domain-platform').press('Enter');
    await work.locator('#work-open-yt-edit').click();
    await work.locator('#work-summary-title').waitFor();
    const initialFrame=await work.locator('[data-media-frame]').evaluate(n=>{const b=n.getBoundingClientRect();return {left:b.left,top:b.top,width:b.width,height:b.height};});
    check(await work.locator('[data-media-caption]').evaluate(n=>{const b=n.getBoundingClientRect(),footer=n.closest('[data-media-footer]').getBoundingClientRect(),image=document.querySelector('[data-media-viewport]').getBoundingClientRect();return b.top>=footer.top&&b.bottom<=footer.bottom&&footer.bottom<=innerHeight&&n.scrollHeight<=n.clientHeight&&b.top-image.bottom>=0&&b.top-image.bottom<=64&&Math.abs((b.left+b.right-image.left-image.right)/2)<1;}),width+': the full caption follows the image without an oversized footer gap');
    check(await work.evaluate(n=>{const panel=n.querySelector('[data-gallery-section]').getBoundingClientRect(),heading=n.querySelector('[data-work-heading]').getBoundingClientRect(),image=n.querySelector('[data-media-viewport]').getBoundingClientRect();return Math.abs(heading.top-image.top)<1&&heading.top-panel.top<=25;}),width+': title and image start together at the top of the panel');
    check(await work.locator('[data-work-intro]').evaluate(n=>[...n.querySelectorAll('h3,h4,p,dt,dd,summary')].every(e=>e.scrollWidth<=e.clientWidth+1)),width+': titles and prose wrap inside the reading column');
    check(await work.locator('[data-gallery-media]').evaluate(n=>n.scrollHeight<=n.clientHeight+1),width+': the media and caption do not require nested scrolling');
    check(await work.locator('[data-gallery-media] figure>button').evaluate(n=>n.lastElementChild.getBoundingClientRect().top>=n.querySelector('[data-media-viewport]').getBoundingClientRect().bottom),width+': enlarge action does not cover image content');
    check(await work.locator('[data-media-viewport]').evaluate(n=>{const i=n.querySelector('img'),b=i.getBoundingClientRect();return getComputedStyle(n).transform==='none'&&getComputedStyle(i).transform==='none'&&Math.abs(b.width/b.height-i.naturalWidth/i.naturalHeight)<.002;}),width+': image and embedded lettering keep their original proportions');
    await work.getByRole('button',{name:'영상의 시작·종료 구간과 타임라인을 편집하는 YT-edit 확대',exact:true}).click();
    check(await page.locator('dialog[open] [data-zoomed=false]').evaluate(n=>{const image=n.querySelector('img');return image.clientWidth>n.clientWidth-2&&n.scrollWidth<=n.clientWidth+1;}),width+': enlarged image uses available width');
    await page.getByRole('button',{name:'원본 크기로 보기',exact:true}).click();
    check(await page.locator('dialog[open] [data-zoomed=true]').count()===1,width+': original image size');
    await page.keyboard.press('Escape');
    check(await page.locator('dialog[open]').count()===0,width+': image closes');
    check(await work.getAttribute('data-view')==='gallery',width+': image Escape preserves gallery');
    check(await work.locator('[data-zoomed=true]').count()===0,width+': image zoom resets');
    const strip=await work.getByRole('tablist',{name:'분야 기록 선택'}).evaluate(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom}));
    check(strip.top>=0&&strip.bottom<=height,width+': filmstrip remains in view');
    check(await work.getByRole('tablist',{name:'분야 기록 선택'}).evaluate(n=>n.scrollHeight<=n.clientHeight),width+': record strip does not clip titles or add a vertical scrollbar');
    if(width>900) {
      const panel=work.locator('[data-work-copy]');
      check(await panel.locator('p').first().evaluate(n=>{const size=parseFloat(getComputedStyle(n).fontSize);return size>=17&&size<=18;}),width+': readable body type stays within its desktop scale');
      const toc=work.getByRole('tablist',{name:'경험 상세 목차'});
      check(await toc.evaluate(n=>n.clientHeight)>120,width+': readable TOC height');
      const composition=await work.evaluate(n=>{
        const box=selector=>n.querySelector(selector).getBoundingClientRect();
        const image=box('[data-media-frame]'),heading=box('[data-work-heading]'),copy=box('[data-work-copy]'),toc=box('aside'),strip=box('[aria-label="분야 기록 선택"]');
        return toc.left>=image.right&&copy.right<=image.left&&heading.right<=image.left&&heading.bottom<=copy.top&&image.bottom<=strip.top;
      });
      check(composition,width+': description, media and right-hand TOC keep their reading order');
      check(await work.evaluate(n=>getComputedStyle(n.querySelector('[data-media-frame]'),'::before').transform===getComputedStyle(n.querySelector('[data-work-intro]'),'::before').transform),width+': media frame and explanation frame use the same angle');
      const top=await toc.evaluate(n=>n.getBoundingClientRect().top);
      await panel.press('Control+End');
      await page.waitForFunction(()=>{const n=document.querySelector('[data-work-copy]');return Math.abs(n.scrollTop-(n.scrollHeight-n.clientHeight))<2;});
      check(await toc.evaluate(n=>n.getBoundingClientRect().top)===top,width+': TOC stays while reading');
      check(await work.locator('#work-display').evaluate(n=>n.scrollTop)===0,width+': outer frame does not scroll');
      await toc.getByRole('tab').first().press('ArrowDown');
      check(await panel.evaluate(n=>n.scrollTop)===0,width+': section resets reading position');
      check(await work.locator('[data-gallery-media]').getAttribute('data-media-source')==='cover',width+': text-only section keeps the explicit cover');
      check(await work.locator('[data-media-caption]').evaluate(n=>{const label=n.querySelector('p').getBoundingClientRect(),caption=n.getBoundingClientRect();return label.top>=caption.top&&label.bottom<=caption.bottom;}),width+': representative-image label remains inside the image caption');
    } else {
      check(await work.evaluate(n=>n.querySelector('[data-work-heading]').getBoundingClientRect().bottom<=n.querySelector('[data-gallery-media] [data-media-viewport]').getBoundingClientRect().top),width+': mobile title leads into media');
      check(await work.evaluate(n=>getComputedStyle(n.querySelector('[data-media-frame]'),'::before').transform===getComputedStyle(n.querySelector('[data-work-heading]'),'::before').transform),width+': mobile frame and heading share the same angle');
    }
    await work.locator('#work-open-yt-edit').press('ArrowLeft');
    check(await work.locator('#work-open-momotalk-studio').getAttribute('aria-selected')==='true',width+': keyboard record switch');
    check(await work.locator('#work-summary-title').innerText()==='MomoTalk Studio',width+': complete product name');
    check(await work.locator('[data-media-frame]').evaluate((n,initial)=>{const b=n.getBoundingClientRect();return ['left','top','width'].every(key=>Math.abs(b[key]-initial[key])<1);},initialFrame),width+': different image ratios keep the same top edge and column width');
    check(await work.locator('[data-work-copy]').evaluate(n=>n.clientHeight)>=42,width+': panoramic explanation remains usable');
    check(await work.evaluate(n=>{const image=n.querySelector('[data-media-viewport]').getBoundingClientRect(),stage=n.querySelector('[data-gallery-media]').getBoundingClientRect();return image.top>=stage.top-1&&image.bottom<=stage.bottom+1;}),width+': the full image remains visible above the caption');
    check(await work.locator('[data-gallery-section]').getAttribute('data-gallery-section')==='overview',width+': new record resets its detail');
    await page.keyboard.press('Escape');
    check(await work.locator('#work-domain-platform').evaluate(node=>node===document.activeElement),width+': domain focus restored');
    await work.locator('#work-domain-platform').press('ArrowRight');
    check(await work.locator('#work-domain-web').evaluate(node=>node===document.activeElement),width+': ribbon arrow navigation');
    check(await work.evaluate(node=>Math.abs(node.getBoundingClientRect().left)<1&&node.scrollLeft===0),width+': gallery expansion preserves the frame');
    await work.locator('#work-domain-platform').press('Enter');
    await work.locator('#work-open-holo-studio').click();
    await work.locator('#work-tab-holo-studio-section-2').click();
    check(await work.locator('[data-media-footer]').evaluate(n=>{const footer=n.getBoundingClientRect(),caption=n.querySelector('[data-media-caption]').getBoundingClientRect(),picker=n.querySelector('[aria-label="자료 넘기기"]').parentElement.getBoundingClientRect();return caption.bottom<=footer.bottom&&picker.bottom<=footer.bottom&&picker.top>=caption.bottom&&footer.bottom<=innerHeight;}),width+': the full caption and media controls stay together beneath the image');
    await work.getByRole('button',{name:'다음 자료',exact:true}).click();
    check(await work.locator('[data-gallery-media]').evaluate(n=>n.dataset.galleryMedia==='1'&&n.scrollTop===0&&n.scrollHeight<=n.clientHeight+1),width+': changing media keeps the complete image visible');
    await work.getByRole('link',{name:'자세한 기록 읽기'}).click();
    await page.getByRole('heading',{level:1}).waitFor();
    check(await page.locator('figure figcaption').first().isVisible(),width+': standalone work pages retain their original captions');
    const mobile=width<=700;
    check(await page.locator('aside details').isVisible()===mobile,width+': responsive TOC');
    if(mobile)await page.locator('aside summary').click();
    await page.getByRole('link',{name:'출력 · 편집한 장면을 영상으로',exact:true}).filter({visible:true}).click();
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+': horizontal overflow');
    await page.screenshot({path:'output/playwright/works-'+width+'.png',fullPage:true});
    results.push({width,height,domains:6,focusAndScrollRestored:true,responsiveTOC:true,overflow:false});
  }
  return results;
}
