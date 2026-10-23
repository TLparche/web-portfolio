import Portfolio from './portfolio/Portfolio';
import { activeSections, sections, profile, assetUrl } from './portfolio/config.mjs';
import LoadingGate from './portfolio/LoadingGate';
import { collectImages } from './portfolio/image-preload.mjs';
import { visualFor } from './portfolio/chapter-timeline.mjs';

export default function Page() {
  const active=activeSections(sections);
  const sceneImages=Object.fromEntries([{id:'preview'},...active].map(section=>{
    const visual=visualFor(profile,section.id);
    const images=collectImages(section,{image:visual.src});
    if(section.id==='preview')images.push('/art/archive/entrance-atelier.webp','/art/archive/entrance-lens.webp');
    return [section.id,images.map(assetUrl)];
  }));
  return <LoadingGate sceneImages={sceneImages} sections={active} profile={profile}><Portfolio sections={active} profile={profile}/></LoadingGate>;
}
