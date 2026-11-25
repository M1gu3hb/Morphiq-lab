// Servidor local: construye y sirve dist/ con las mismas URL limpias y reescrituras que Vercel.
// Las funciones de /api también corren aquí, con las variables de entorno de la terminal.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAll } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 4321);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
const vercel = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const rewrites = vercel.rewrites || [];
const headersFor = (p) => Object.fromEntries((vercel.headers || []).filter((h) => new RegExp('^' + h.source + '$').test(p)).flatMap((h) => h.headers.map((x) => [x.key.toLowerCase(), x.value]))); // mismas cabeceras que producción (incluida la CSP)
const toRe = (src) => new RegExp('^' + src.replace(/:[a-z]+/gi, '[^/]+') + '$');

// LAB_FAKE_STORE=1: la clave se guarda en memoria en vez de en Vercel Blob, para probar el alta y el acceso sin red.
if (process.env.LAB_FAKE_STORE) {
  process.env.BLOB_READ_WRITE_TOKEN ||= 'vercel_blob_rw_local_local';
  const mem = new Map(); let n = 0;
  (await import('../api/_lib/lab.js')).__setBackend({
    list: async ({ prefix }) => ({ blobs: [...mem.values()].filter((b) => b.pathname.startsWith(prefix)) }),
    put: async (pathname, body) => { const url = `memoria://${pathname}-${++n}`; mem.set(url, { url, pathname, body, uploadedAt: new Date() }); return { url }; },
    del: async (urls) => { for (const u of [].concat(urls)) mem.delete(u); },
    fetch: async (u) => ({ ok: mem.has(u), json: async () => JSON.parse(mem.get(u).body) }),
  });
}

await buildAll();
if (!process.argv.includes('--once')) {
  let timer;
  for (const d of ['experiments', 'site']) watch(path.join(root, d), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(() => buildAll().catch((e) => console.error(e.message)), 150); });
}

// Ejecuta una función de /api como lo hace Vercel: req.query y req.body ya interpretados.
async function runApi(req, res, url) {
  const file = path.join(root, url.pathname + '.js');
  if (!file.startsWith(path.join(root, 'api')) || url.pathname.includes('/_')) return false;
  try { await stat(file); } catch (_) { return false; }
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  req.query = Object.fromEntries(url.searchParams);
  try { req.body = raw && /json/.test(req.headers['content-type'] || '') ? JSON.parse(raw) : raw || undefined; } catch (_) { req.body = undefined; }
  const mod = await import(pathToFileURL(file).href);
  await mod.default(req, res);
  return true;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  try {
    if (p.startsWith('/api/')) {
      if (await runApi(req, res, url)) return;
      res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"No existe"}');
    }
    // Igual que Vercel: primero el archivo (con URL limpias) y sólo si no existe se aplican las reescrituras.
    const serve = async (q) => {
      for (const t of [q, q + '.html', path.posix.join(q, 'index.html')]) {
        const file = path.join(dist, t);
        if (!file.startsWith(dist)) return false;
        try { if ((await stat(file)).isFile()) { res.writeHead(200, { ...headersFor(p), 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(await readFile(file)); return true; } } catch (_) {}
      }
      return false;
    };
    if (await serve(p)) return;
    const rw = rewrites.find((r) => toRe(r.source).test(p));
    if (rw && (await serve(rw.destination))) return;
    res.writeHead(404, { ...headersFor(p), 'content-type': 'text/html; charset=utf-8' }); res.end(await readFile(path.join(dist, '404.html')).catch(() => '404'));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end('{"error":"Error interno"}');
  }
}).listen(port, () => console.log(`Morphiq Lab → http://localhost:${port}`));
