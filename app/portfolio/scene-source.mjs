import fs from 'node:fs';

const defaultManifest = 'public/bg/morph/scenes.json';

/** Local experiments stay opt-in for a Pages preview and out of CI exports. */
export function sceneManifest(env = process.env) {
  const inCI = env.CI === 'true' || env.GITHUB_ACTIONS === 'true';
  if (inCI && env.PORTFOLIO_LOCAL_PREVIEW !== 'true') return defaultManifest;
  const match = /^test\/([a-zA-Z0-9_-]+)\.json$/.exec(env.NEXT_PUBLIC_BG_MANIFEST || '');
  const candidate = match && `public/bg/test/morph/${match[1]}/scenes.json`;
  return candidate && fs.existsSync(candidate) ? candidate : defaultManifest;
}

export const loadSceneAssets = () => JSON.parse(fs.readFileSync(sceneManifest(), 'utf8'));
