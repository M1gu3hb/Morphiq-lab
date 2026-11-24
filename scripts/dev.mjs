// Servidor local: construye y sirve dist/ con las mismas URL limpias y reescrituras que Vercel.
// Las funciones de /api no corren aquí (para eso: `vercel dev`).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAll } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 4321);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
const rewrites = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8')).rewrites || [];
const toRe = (src) => new RegExp('^' + src.replace(/:[a-z]+/gi, '[^/]+') + '$');

await buildAll();
if (!process.argv.includes('--once')) {
  let timer;
  for (const d of ['experiments', 'site']) watch(path.join(root, d), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(() => buildAll().catch((e) => console.error(e.message)), 150); });
}

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/api/')) { res.writeHead(501, { 'content-type': 'application/json' }); return res.end('{"error":"Las funciones sólo corren en Vercel"}'); }
  const rw = rewrites.find((r) => toRe(r.source).test(p)); if (rw) p = rw.destination;
  const tries = [p, p + '.html', path.posix.join(p, 'index.html')];
  for (const t of tries) {
    const file = path.join(dist, t);
    if (!file.startsWith(dist)) break;
    try { if ((await stat(file)).isFile()) { res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); return res.end(await readFile(file)); } } catch (_) {}
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('404');
}).listen(port, () => console.log(`Morphiq Lab → http://localhost:${port}`));
