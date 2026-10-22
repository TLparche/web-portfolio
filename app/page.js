import Portfolio from './portfolio/Portfolio';
import { activeSections, sections, profile, backgroundTracks } from './portfolio/config.mjs';
import { loadSceneAssets } from './portfolio/scene-source.mjs';

export default function Page() {
  const scenes = loadSceneAssets();
  const first = scenes[0];
  const tracks = first ? [{ id:'base', video:first.video, poster:first.still, colorRect:first.colorRect, depthRect:first.depthRect, aspect:first.aspect, fps:first.fps }, ...backgroundTracks] : [];
  return <Portfolio sections={activeSections(sections)} scenes={scenes} tracks={tracks} profile={profile} />;
}
