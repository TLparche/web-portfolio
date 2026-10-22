// Prepare with node scripts/prepare-media-check.mjs, then run via playwright-cli.
async page=>{
  const context=await page.context().browser().newContext({viewport:{width:960,height:540}});
  const tab=await context.newPage();const errors=[];tab.on('pageerror',e=>errors.push(e.message));
  try{
    await tab.goto('http://127.0.0.1:3002/web-portfolio/__media-check/');
    const result=await tab.evaluate(async()=>{
      const THREE=await import('./three.js');const {createMediaMixer}=await import('./assets.js');
      const renderer=new THREE.WebGLRenderer();renderer.setSize(960,540);document.body.append(renderer.domElement);
      let failed=false;const track={video:'/bg/test/bg-src79-cuts.mp4',aspect:16/9,colorRect:[0,0,1,.5],depthRect:[0,.5,1,1]};
      const media=createMediaMixer(renderer,[{...track,id:'base'},{...track,id:'alternate'}],()=>{},()=>{failed=true;});
      const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
      const frames=async(count,hold=false)=>{for(let i=0;i<count;i++){await new Promise(requestAnimationFrame);media.render(performance.now(),hold);}};
      try{
        await frames(100);check(media.displayed==='base','Base not ready');
        media.setProgress(.25);await frames(50);const time=media.baseVideo.currentTime;
        media.select({backgroundId:'alternate'});await frames(100,true);
        check(media.displayed==='base','A decoded selection interrupted a major transition');
        await frames(100);
        check(media.displayed==='alternate' && media.selectionVideo.paused,'Selected video left scroll mode');
        check(Math.abs(media.selectionVideo.currentTime-time)<.002,'Selected video did not match scroll');
        media.setProgress(.75);await frames(60);
        check(media.baseVideo.currentTime>time && Math.abs(media.baseVideo.currentTime-media.selectionVideo.currentTime)<.002,'Base and selected video did not seek together');
        const old=media.selectionVideo;media.select(null);await frames(80);
        check(old.paused && !old.getAttribute('src'),'Retired video retained its source');
        check(media.displayed==='base','Live base not restored');
        const before=renderer.info.memory.textures;
        for(let i=0;i<4;i++){media.select({backgroundId:'alternate'});await frames(50);media.select(null);await frames(65);}
        check(renderer.info.memory.textures<=before+1,'Video swaps leaked GPU textures');
        check(renderer.getContext().getError()===0,'GPU feedback or invalid render operation');
        check(!failed,'Primary media failed');
        return {selectedVideo:true,majorDefersSelection:true,baseAndSelectionSeekTogether:true,retiredSourceReleased:true,textures:renderer.info.memory.textures,webglError:0};
      }finally{media.dispose();renderer.dispose();}
    });
    if(errors.length)throw new Error(errors.join('\n'));return result;
  }finally{await context.close();}
}
