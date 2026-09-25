import { TextureLoader, VideoTexture, LinearFilter, NoColorSpace, WebGLRenderTarget, Scene, OrthographicCamera, Mesh, PlaneGeometry, ShaderMaterial, Vector4, Color } from 'three';
import { assetUrl } from './config.mjs';
import { clamp, videoFrameTime } from './timeline.mjs';

const rect = (r = [0,0,1,1]) => new Vector4(r[0], 1-r[3], r[2]-r[0], r[3]-r[1]);
const configure = texture => { texture.colorSpace = NoColorSpace; texture.minFilter = texture.magFilter = LinearFilter; texture.generateMipmaps = false; return texture; };
const vertex = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const fragment = /* glsl */`
uniform sampler2D uLive; uniform sampler2D uPrevious;
uniform vec4 uColor;
uniform float uAspect; uniform float uBlend; uniform float uCopy;
uniform vec3 uAccent; uniform float uTint;
uniform sampler2D uBase;
uniform vec4 uBaseColor;
uniform float uOverlay;
varying vec2 vUv;
void main(){
  if(uCopy>0.5){gl_FragColor=texture2D(uLive,vUv);return;}
  vec2 uv=vUv;
  vec2 cover=vec2(min(1.,(16./9.)/uAspect),min(1.,uAspect/(16./9.)));
  uv=(uv-.5)*cover+.5;
  vec2 sampleUv=uColor.xy+clamp(uv,.001,.999)*uColor.zw;
  vec4 live=texture2D(uLive,sampleUv);
  if(uOverlay>.5){
    vec2 baseUv=uBaseColor.xy+vUv*uBaseColor.zw;
    vec4 background=texture2D(uBase,baseUv);
    live=mix(background,live,.65);
  }
  live.rgb=mix(live.rgb,uAccent,uTint);
  gl_FragColor=mix(texture2D(uPrevious,vUv),live,uBlend);
}`;

/** One owner for videos, GPU snapshots and the current display. No CPU pixel copies. */
export function createMediaMixer(gl, tracks, invalidate, onFailure) {
  // Normalize only RGB. Packed source depth is never sampled by this renderer.
  const target = () => new WebGLRenderTarget(960,540,{depthBuffer:false,stencilBuffer:false,minFilter:LinearFilter,magFilter:LinearFilter});
  const output = target(), previous = target();
  const scene = new Scene(), camera = new OrthographicCamera(-1,1,1,-1,0,1);
  const material = new ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,depthTest:false,depthWrite:false,uniforms:{
    uLive:{value:null},uPrevious:{value:previous.texture},uColor:{value:rect()},
    uAspect:{value:16/9},uBlend:{value:1},uCopy:{value:0},
    uAccent:{value:new Color()},uTint:{value:0},
    uBase:{value:null},uBaseColor:{value:rect(tracks[0].colorRect)},uOverlay:{value:0},
  }});
  const quad = new Mesh(new PlaneGeometry(2,2),material); scene.add(quad);
  const draw = destination => {
    const saved = gl.getRenderTarget();
    try { gl.setRenderTarget(destination); gl.render(scene,camera); } finally { gl.setRenderTarget(saved); }
  };
  const copy = (texture,destination) => {
    const names=['uPrevious','uBase'];
    const saved=names.map(name=>material.uniforms[name].value);
    names.forEach(name=>{material.uniforms[name].value=null;});
    material.uniforms.uLive.value=texture; material.uniforms.uCopy.value=1;
    draw(destination); material.uniforms.uCopy.value=0;
    names.forEach((name,index)=>{material.uniforms[name].value=saved[index];});
  };
  let paused=false, closed=false, selected=null, requested='base', displayed='', started=0, painted=false;
  let lastRender=performance.now(), holding=false;
  let progress=0, displayedTime=0;
  const images=new Map();
  function videoTrack(track, primary=false) {
    const video=document.createElement('video');
    video.muted=true; video.playsInline=true; video.preload='auto';
    video.dataset.backgroundTrack=track.id;
    // Three r166 doesn't cancel its VideoTexture callback on disposal.
    // Track the callback on this owned element so retiring a source releases it.
    let callbackId;
    if(video.requestVideoFrameCallback){const request=video.requestVideoFrameCallback.bind(video);video.requestVideoFrameCallback=callback=>{callbackId=request(callback);return callbackId;};}
    const texture=configure(new VideoTexture(video));
    let dead=false, requestedTime=null;
    const entry={...track,texture,video,ready:false,failed:false,decodedTime:0};
    const failure=()=>{entry.failed=true; if(primary) onFailure(); invalidate();};
    const loaded=()=>{if(dead || video.seeking)return;entry.ready=true;entry.decodedTime=video.currentTime;texture.needsUpdate=true;invalidate();};
    const metadata=()=>invalidate();
    video.addEventListener('loadeddata',loaded);video.addEventListener('seeked',loaded);video.addEventListener('loadedmetadata',metadata);video.addEventListener('error',failure);
    video.src=assetUrl(track.video); video.load();
    entry.seek=()=>{
      if(dead || entry.failed || document.hidden || video.seeking || !Number.isFinite(video.duration))return;
      const time=videoFrameTime(progress,video.duration,track.fps);
      // Media backends may complete a seek a few milliseconds off target.
      // Compare requests too, or seeked -> invalidate -> seek loops forever.
      if(time===requestedTime || Math.abs(video.currentTime-time)<.001)return;
      // One in-flight seek; progress stores only the latest scroll request.
      entry.ready=false;video.currentTime=time;requestedTime=time;
    };
    entry.dispose=()=>{dead=true;video.pause();if(callbackId!==undefined)video.cancelVideoFrameCallback(callbackId);video.removeEventListener('loadeddata',loaded);video.removeEventListener('seeked',loaded);video.removeEventListener('loadedmetadata',metadata);video.removeEventListener('error',failure);video.removeAttribute('src');video.load();texture.dispose();};
    return entry;
  }
  const base=videoTrack(tracks[0],true);
  function imageTrack(value) {
    const key=value.image;
    if(images.has(key)) return images.get(key);
    const entry={id:key,aspect:16/9,colorRect:[0,0,1,1],accent:value.accent,ready:false};
    entry.texture=new TextureLoader().load(assetUrl(key),texture=>{
      if(closed || images.get(key)!==entry){texture.dispose();return;}
      entry.aspect=texture.image.width/texture.image.height;entry.ready=true;configure(texture);invalidate();
    },undefined,()=>{entry.failed=true;invalidate();});
    configure(entry.texture); images.set(key,entry); return entry;
  }
  return {
    texture:output.texture,
    get baseVideo(){return base.video;},
    get selectionVideo(){return selected?.video;},
    get displayed(){return displayed;},
    get time(){return displayedTime;},
    get targetTime(){return videoFrameTime(progress,base.video.duration,base.fps);},
    get seeking(){return base.video.seeking || !!selected?.video?.seeking;},
    get blending(){return !holding && performance.now()-started<450;},
    setPaused(value){paused=value;invalidate();},
    setProgress(value){if(!paused)progress=clamp(Number.isFinite(value)?value:0);},
    select(value){
      const track=value?.backgroundId && tracks.find(track=>track.id===value.backgroundId);
      const key=track?.id || value?.image || 'base';
      if(key===requested)return;
      requested=key;
      // Capture the current blend before retiring a player, including interrupted changes.
      if(painted)copy(output.texture,previous);
      selected?.dispose?.(); selected=null;
      if(key!=='base')selected=track?videoTrack(track):imageTrack(value);
      while(images.size>3){const [old,entry]=images.entries().next().value;if(old===key)break;entry.texture.dispose();images.delete(old);}
      invalidate();
    },
    render(now, holdSelection=false){
      if(closed || document.hidden)return false;
      // Large transitions hold selection fades, independently of scroll seeking.
      if(holdSelection || holding)started+=now-lastRender;
      lastRender=now;holding=holdSelection;
      const entry=selected?.failed?base:selected||base;
      // A first/deep-linked frame and a newly selected video must match the scroll first.
      if(!painted)base.seek();
      if(displayed!==entry.id)entry.seek?.();
      if(!base.ready || !entry.ready){base.seek();selected?.seek?.();return painted;}
      const id=entry.id;
      if(holdSelection && displayed && displayed!==id){base.seek();selected?.seek?.();return painted;}
      if(displayed!==id){
        if(painted && !selected)copy(output.texture,previous);
        started=painted?now:now-450;displayed=id;
      }
      const u=material.uniforms;
      u.uLive.value=entry.texture;
      u.uBase.value=base.texture;u.uOverlay.value=entry!==base && !entry.video ? 1 : 0;
      u.uColor.value.copy(rect(entry.colorRect));u.uAspect.value=entry.aspect;
      u.uTint.value=entry.accent ? .05 : 0;
      if(entry.accent)u.uAccent.value.set(entry.accent).convertLinearToSRGB();
      const t=Math.min(1,Math.max(0,(now-started)/450));u.uBlend.value=t*t*(3-2*t);
      draw(output);painted=true;displayedTime=base.decodedTime;
      // Upload the completed frame before requesting the newest target.
      base.seek();selected?.seek?.();return true;
    },
    dispose(){closed=true;base.dispose();selected?.dispose?.();images.forEach(entry=>entry.texture.dispose());images.clear();output.dispose();previous.dispose();quad.geometry.dispose();material.dispose();},
  };
}
