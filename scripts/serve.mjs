// Static export preview, including byte ranges for seekable MP4s.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('out');
const prefix = process.env.PREVIEW_BASE_PATH || '';
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp4':'video/mp4', '.woff2':'font/woff2', '.png':'image/png', '.ico':'image/x-icon' };
http.createServer((request,response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname); } catch { response.writeHead(400).end(); return; }
  if (prefix && pathname !== prefix && !pathname.startsWith(`${prefix}/`)) { response.writeHead(404).end(); return; }
  const file = path.resolve(root, '.' + (pathname.slice(prefix.length) || '/'));
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  const target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file,'index.html') : file;
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404).end(); return; }
  const size = fs.statSync(target).size;
  const mime = types[path.extname(target)] || 'application/octet-stream';
  const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
  const start = range ? Number(range[1]) : 0;
  const end = range && range[2] ? Math.min(Number(range[2]),size-1) : size-1;
  if (start > end || start >= size) { response.writeHead(416,{'Content-Range':`bytes */${size}`}).end(); return; }
  response.writeHead(range ? 206 : 200, { 'Content-Type':mime, 'Content-Length':end-start+1, 'Accept-Ranges':'bytes', ...(range ? {'Content-Range':`bytes ${start}-${end}/${size}`} : {}) });
  if (request.method === 'HEAD') response.end(); else fs.createReadStream(target,{start,end}).pipe(response);
}).listen(Number(process.env.PORT || 3000),'127.0.0.1',() => console.log(`Static preview: http://127.0.0.1:${process.env.PORT || 3000}${prefix}/`));
