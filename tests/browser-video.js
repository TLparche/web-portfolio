// Plain RGB video, edge-to-edge framing, and the lower-centered intro composition.
async page=>{
  const base=page.url().split('#')[0].split('?')[0];
  const check=(ok,message)=>{if(!ok)throw new Error(message);},errors=[];
  const onError=e=>errors.push(e.message),onConsole=m=>{if(m.type()==='error')errors.push(m.text());};
  page.on('pageerror',onError);page.on('console',onConsole);
  try{
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'?video-check');
    await page.locator('[data-ready=true]').waitFor();await page.waitForTimeout(500);
    check(await page.locator('canvas').getAttribute('data-renderer')==='video','Plain video is not active');
    check(await page.getByText('홀로그램 조절').count()===0,'Hologram controls remain');
    const frame=await page.locator('canvas').boundingBox();
    check(frame.x===0 && frame.y===0 && frame.width===1440 && frame.height===1000,'Video does not fill the viewport');
    check((await page.getByRole('banner').boundingBox()).height===64,'Header is not compact');
    const title=await page.locator('#about-title').boundingBox();
    check(title.y>500 && Math.abs(title.x+title.width/2-720)<2,'Intro no longer sits at the lower center');
    const before=await page.locator('canvas').getAttribute('data-frames');
    await page.mouse.move(1150,220);await page.mouse.move(1300,400);await page.waitForTimeout(150);
    check(await page.locator('canvas').getAttribute('data-frames')===before,'Pointer movement still distorts the background');
    await page.screenshot({path:'output/playwright/plain-video-about.png'});
    for(const id of ['interests','projects']){
      await page.evaluate(id=>document.getElementById(id).scrollIntoView({behavior:'instant'}),id);await page.waitForTimeout(600);
      check(await page.evaluate(()=>scrollX===0 && document.documentElement.scrollWidth<=innerWidth),'Page moves horizontally');
      await page.screenshot({path:`output/playwright/plain-video-${id}.png`});
    }
    check(errors.length===0,errors.join('\n'));
    return {plainVideo:true,fullViewport:true,compactHeader:true,lowerCenteredIntro:true,noPointerDistortion:true,verticalNavigation:true,errors};
  }finally{page.off('pageerror',onError);page.off('console',onConsole);}
}
