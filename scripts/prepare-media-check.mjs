// Ephemeral browser harness for the actual media owner, using the installed Three version.
// Run after a preview build; a subsequent build replaces the export directory.
import fs from 'node:fs';
const dir='out/__media-check';
fs.mkdirSync(dir,{recursive:true});
fs.copyFileSync('node_modules/three/build/three.module.js',`${dir}/three.js`);
fs.writeFileSync(`${dir}/config.js`,"export const assetUrl=path=>'/web-portfolio'+path;");
fs.copyFileSync('app/portfolio/timeline.mjs',`${dir}/timeline.js`);
fs.writeFileSync(`${dir}/assets.js`,fs.readFileSync('app/portfolio/assets.mjs','utf8').replace("from 'three'","from './three.js'").replace("'./config.mjs'","'./config.js'").replace("'./timeline.mjs'","'./timeline.js'"));
fs.writeFileSync(`${dir}/index.html`,'<!doctype html><html><head><title>Media validation</title></head><body></body></html>');
console.log('Prepared temporary /web-portfolio/__media-check/');
