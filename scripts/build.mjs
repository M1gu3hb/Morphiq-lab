// Construye el laboratorio completo en dist/.
// Convención por experimento (experiments/<slug>/):
//   meta.json            ficha que aparece en la librería
//   *.html               páginas → dist/<slug>/
//   assets/              archivos estáticos → dist/<slug>/assets/
//   src/pages/*.js       módulos de página (ESM, con código compartido) → dist/<slug>/js/
//   src/standalone/*.js  bundles autónomos (IIFE, todo incluido) → dist/<slug>/js/
import { build } from 'esbuild';
import { cp, mkdir, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist'), expDir = path.join(root, 'experiments');
const dev = process.argv.includes('--dev');
const js = async (dir) => (existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f)) : []);

export async function buildAll() {
  const t0 = Date.now();
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, 'site'), dist, { recursive: true });

  const list = [];
  for (const slug of (await readdir(expDir)).sort()) {
    const dir = path.join(expDir, slug);
    if (!(await stat(dir)).isDirectory() || !existsSync(path.join(dir, 'meta.json'))) continue;
    const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8'));
    list.push({ slug, ...meta });
    const out = path.join(dist, slug);
    await mkdir(path.join(out, 'js'), { recursive: true });
    for (const f of await readdir(dir)) if (f.endsWith('.html')) await cp(path.join(dir, f), path.join(out, f));
    if (existsSync(path.join(dir, 'assets'))) await cp(path.join(dir, 'assets'), path.join(out, 'assets'), { recursive: true });
    const common = { bundle: true, minify: !dev, sourcemap: dev, target: 'es2020', logLevel: 'warning', loader: { '.png': 'dataurl', '.webp': 'dataurl' }, legalComments: 'none' };
    const pages = await js(path.join(dir, 'src/pages'));
    if (pages.length) await build({ ...common, entryPoints: pages, outdir: path.join(out, 'js'), format: 'esm', splitting: true, chunkNames: 'chunk-[hash]' });
    for (const entry of await js(path.join(dir, 'src/standalone'))) await build({ ...common, entryPoints: [entry], outfile: path.join(out, 'js', path.basename(entry)), format: 'iife', define: { 'import.meta.url': JSON.stringify(`https://morphiqlab.vercel.app/${slug}/js/`) } }); // un IIFE no tiene import.meta: sin esto, las librerías que lo leen al cargar rompen el bundle
  }
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  await writeFile(path.join(dist, 'experiments.json'), JSON.stringify(list, null, 2));
  console.log(`✓ ${list.length} experimento(s) en ${Date.now() - t0} ms`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildAll();
