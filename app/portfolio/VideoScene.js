'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector2 } from 'three';
import { createMediaMixer } from './assets.mjs';

const vertexShader='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
// A fixed noise field makes the dissolve reversible: scroll position owns every particle.
const dissolveShader=/* glsl */`
uniform float uTransition;
uniform vec2 uViewport;
float random(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wave(vec2 uv){return sin(uv.x*15.0)*.018+sin(uv.x*37.0+uv.y*8.0)*.009+random(floor(uv*vec2(240.,135.)))*.025;}
float travel(){return uTransition<.5?smoothstep(.14,.48,uTransition):smoothstep(.52,.86,uTransition);}
float front(){return mix(-.14,1.14,travel());}
vec2 coverUv(vec2 uv){
  vec2 cover=vec2(min(1.,uViewport.x/uViewport.y/(16./9.)),min(1.,(16./9.)/(uViewport.x/uViewport.y)));
  return (uv-.5)*cover+.5;
}
`;
const fragmentShader=/* glsl */`
uniform sampler2D uMedia;
varying vec2 vUv;
${dissolveShader}
void main(){
  vec4 image=texture2D(uMedia,coverUv(vUv));
  if(uTransition<=.001||uTransition>=.999){gl_FragColor=image;return;}
  float edge=smoothstep(front()-.012,front()+.025,vUv.y+wave(vUv));
  float solid=uTransition<.5?edge:1.-edge;
  vec3 paper=mix(vec3(.87,.91,.97),vec3(.965,.977,.989),vUv.y);
  gl_FragColor=vec4(mix(paper,image.rgb,solid),1.);
}`;
const particleVertex=/* glsl */`
${dissolveShader}
varying vec2 vSource;
varying float vAlpha;
void main(){
  vSource=coverUv(uv);
  float seed=random(uv*vec2(379.,211.));
  float distance=abs(uv.y+wave(uv)-front());
  float band=1.-smoothstep(.02,.22,distance);
  vAlpha=band*sqrt(max(0.,sin(travel()*3.14159265)))*.9;
  float drift=(1.-band)*sin(travel()*3.14159265);
  vec2 offset=(vec2((seed-.5)*80.,(random(uv*231.)-.35)*100.)*drift+vec2(seed-.5,random(uv*137.)-.5)*4.)/uViewport;
  gl_Position=vec4(position.xy+offset,0.,1.);
  gl_PointSize=1.+seed*1.7;
}`;
const particleFragment=/* glsl */`
uniform sampler2D uMedia;
varying vec2 vSource;
varying float vAlpha;
void main(){
  float radius=length(gl_PointCoord-.5);
  if(radius>.5||vAlpha<.01)discard;
  vec3 color=mix(texture2D(uMedia,vSource).rgb,vec3(.32,.48,.72),.18);
  gl_FragColor=vec4(color,vAlpha*(1.-smoothstep(.3,.5,radius)));
}`;

function Background({sections,tracks,timeline,progress,selection,paused,occluded=false,onReady,onFailure}) {
  const {gl,invalidate,setFrameloop,size}=useThree();
  const media=useRef(null), surface=useRef(null), dust=useRef(null), ready=useRef(false), frames=useRef(0);
  const latest=useRef({selection,paused,occluded});latest.current={selection,paused,occluded};
  const uniforms=useMemo(()=>({uMedia:{value:null},uViewport:{value:new Vector2()},uTransition:{value:0}}),[]);
  useEffect(()=>{
    const requestFrame=()=>{if(!document.hidden && (!latest.current.occluded || !ready.current))invalidate();};
    const mixer=createMediaMixer(gl,tracks,requestFrame,onFailure);media.current=mixer;
    const unsubscribe=timeline.on('change',requestFrame);
    const unsubscribeProgress=progress.on('change',requestFrame);
    const visibility=()=>{const suspended=document.hidden || (latest.current.occluded && ready.current);mixer.setPaused(latest.current.paused || suspended);setFrameloop(suspended?'never':'demand');if(!suspended)invalidate();};
    const lost=event=>{event.preventDefault();onFailure();};
    document.addEventListener('visibilitychange',visibility);
    gl.domElement.addEventListener('webglcontextlost',lost);
    visibility();
    return()=>{unsubscribe();unsubscribeProgress();document.removeEventListener('visibilitychange',visibility);gl.domElement.removeEventListener('webglcontextlost',lost);mixer.dispose();media.current=null;};
  },[gl,tracks,timeline,progress,invalidate,setFrameloop,onFailure]);
  useEffect(()=>{
    const suspended=document.hidden || (occluded && ready.current);
    gl.domElement.dataset.suspended=String(suspended);
    media.current?.setPaused(paused || suspended);
    setFrameloop(suspended?'never':'demand');
    if(!suspended)invalidate();
  },[paused,occluded,selection,invalidate,setFrameloop,gl]);
  useFrame(({camera,scene})=>{
    const mixer=media.current;
    if(!mixer || document.hidden || (latest.current.occluded && ready.current) || !surface.current)return;
    const state=timeline.get();if(state.index<0)return;
    mixer.setProgress(progress.get());
    const chosen=latest.current.selection;
    const major=state.effect!=='none' && state.transition>0;
    const inSection=chosen?.sectionId===sections[state.index]?.id && state.transition===0;
    if(!major)mixer.select(inSection?chosen:null);
    if(!mixer.render(performance.now(),major))return;
    // Chapter dissolution belongs to the complete DOM surface. The shared video
    // keeps its continuous scroll clock instead of running a second, unrelated wipe.
    const dissolve=0;
    // Fiber 9 preserves its own uniform entries; update the mounted materials.
    for(const object of [surface.current,dust.current]) {
      const u=object.material.uniforms;
      u.uMedia.value=mixer.texture;
      u.uViewport.value.set(size.width,size.height);
      u.uTransition.value=dissolve;
    }
    dust.current.visible=dissolve>.001&&dissolve<.999;
    gl.render(scene,camera);
    if(!ready.current){ready.current=true;onReady(true);}
    Object.assign(gl.domElement.dataset,{
      renderer:'video',frames:String(++frames.current),transition:state.transition.toFixed(4),effect:state.effect,
      scene:sections[state.index]?.sceneId,sectionId:sections[state.index]?.id,
      videoTime:mixer.time.toFixed(3),videoTarget:mixer.targetTime.toFixed(3),videoSeeking:String(mixer.seeking),
      videoSource:tracks[0].video,background:mixer.displayed,videoPaused:String(mixer.baseVideo.paused),
      surfaceOpacity:'1.0000',players:String(mixer.selectionVideo?2:1),dissolve:dissolve.toFixed(4),
    });
    if(latest.current.occluded){mixer.setPaused(true);setFrameloop('never');gl.domElement.dataset.suspended='true';}
    else if(mixer.blending)invalidate();
  },1);
  return <><mesh ref={surface} frustumCulled={false} renderOrder={0}><planeGeometry args={[2,2]}/><shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} depthWrite={false} depthTest={false}/></mesh><points ref={dust} frustumCulled={false} renderOrder={1}><planeGeometry args={[2,2,320,180]}/><shaderMaterial uniforms={uniforms} vertexShader={particleVertex} fragmentShader={particleFragment} transparent depthWrite={false} depthTest={false}/></points></>;
}

export default function VideoScene(props){
  return <Canvas frameloop="demand" dpr={[1,1.5]} flat gl={{antialias:false,powerPreference:'high-performance'}} onCreated={({gl})=>gl.setClearColor('#111111',1)}><Background {...props}/></Canvas>;
}
