import Portfolio from './portfolio/Portfolio';
import { activeSections, sections, profile, backgroundTracks } from './portfolio/config.mjs';
import { loadSceneAssets } from './portfolio/scene-source.mjs';
import LoadingGate from './portfolio/LoadingGate';
import { collectImages } from './portfolio/image-preload.mjs';
import { assetUrl } from './portfolio/config.mjs';

export default function Page() {
  const scenes = loadSceneAssets();
  const first = scenes[0];
  const tracks = first ? [{ id:'base', video:first.video, poster:first.still, colorRect:first.colorRect, depthRect:first.depthRect, aspect:first.aspect, fps:first.fps }, ...backgroundTracks] : [];
  const active = activeSections(sections);
  const images = collectImages(active, scenes, tracks).map(assetUrl);
  return <LoadingGate images={images}><Portfolio sections={active} scenes={scenes} tracks={tracks} profile={profile} /></LoadingGate>;
}
