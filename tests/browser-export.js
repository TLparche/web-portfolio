async page=>{
  const base=page.url().split('#')[0].split('?')[0];const errors=[];
  const onError=e=>errors.push(e.message),onConsole=m=>{if(m.type()==='error')errors.push(m.text());};
  page.on('pageerror',onError);page.on('console',onConsole);
  await page.setViewportSize({width:1440,height:1000});await page.goto(base);await page.locator('[data-ready=true]').waitFor();
  const images=await page.locator('img').evaluateAll(async nodes=>{for(const node of nodes)node.loading='eager';await Promise.all(nodes.map(node=>node.decode()));return nodes.length;});
  const broken=await page.locator('a[href^="#"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')).filter(href=>!document.getElementById(href.slice(1))));
  if(broken.length)throw new Error('Broken anchors: '+broken);
  const source=await page.locator('canvas').getAttribute('data-video-source');
  const illustrations=['interest-observatory','project-portfolio','project-experiment','project-observation','project-next','paper-research'];
  for(const name of illustrations){const result=await page.request.get(base+'art/concepts/'+name+'.webp');if(result.status()!==200)throw new Error('Missing exported illustration: '+name);}
  if(source==='/bg/bg.mp4'){const experimental=await page.request.get(base+'bg/test/bg-src79-cuts.mp4');if(experimental.status()!==404)throw new Error('Experimental media leaked into deployment');}
  const prefix=base.includes('/web-portfolio')?'/web-portfolio':'';
  const url=await page.evaluate(path=>new URL(path,location.href).href,prefix+source);
  const video=await page.request.get(url,{headers:{Range:'bytes=0-1023'}});
  if(video.status()!==206)throw new Error('Export video range failed');
  if(errors.length)throw new Error(errors.join('\n'));
  await page.screenshot({path:'output/playwright/export-'+(prefix?'pages':'root')+'.png'});
  await page.evaluate(()=>document.getElementById('projects').scrollIntoView({behavior:'instant'}));await page.waitForTimeout(400);
  if(!await page.locator('[data-copy]>noscript').evaluateAll(nodes=>nodes.every(n=>{const range=document.createRange();range.selectNodeContents(n);return [...range.getClientRects()].every(rect=>!rect.width||!rect.height);})))throw new Error('Export exposed fallback markup');
  await page.screenshot({path:'output/playwright/export-'+(prefix?'pages':'root')+'-projects.png'});
  page.off('pageerror',onError);page.off('console',onConsole);
  return {base,images,illustrations:illustrations.length,brokenAnchors:broken,videoStatus:video.status(),source,errors};
}
