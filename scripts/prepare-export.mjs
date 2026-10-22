// Next copies all public files, including ignored local experiments, into out.
// Remove only that generated copy; public/bg/test remains available locally.
import fs from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
import { sceneManifest } from '../app/portfolio/scene-source.mjs';
nextEnv.loadEnvConfig(process.cwd());
const exportRoot = path.resolve('out');
const experimental = path.resolve(exportRoot, 'bg', 'test');
if (!fs.existsSync(path.join(exportRoot, 'index.html')) || !experimental.startsWith(exportRoot + path.sep)) {
  throw new Error('Expected a completed static export inside out/');
}
if (sceneManifest().startsWith('public/bg/test/')) {
  console.log('Local preview prepared with experimental background media.');
} else {
  fs.rmSync(experimental, { recursive: true, force: true });
  console.log('Static export prepared; local experimental media excluded.');
}
