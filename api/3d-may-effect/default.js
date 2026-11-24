// GET    /api/3d-may-effect/default → { url } de la carta fijada como portada, o { url: null } si es la original (público)
// DELETE (con clave)                → vuelve a la portada original
// Cada vez que se fija una portada se guarda con la hora en el nombre; la vigente es la más reciente.
import { del, list } from '@vercel/blob';
import { guard, json, needStore } from '../_lib/lab.js';

const PREFIX = '3d-may-effect/default/';

export default async function handler(req, res) {
  if (!needStore(res)) return;
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
    if (req.method === 'GET') {
      if (blobs.length > 3) await del(blobs.slice(3).map((b) => b.url)).catch(() => {}); // conserva sólo las tres últimas
      return json(res, 200, { url: blobs[0] ? blobs[0].url : null });
    }
    if (req.method === 'DELETE') {
      if (!guard(req, res)) return;
      if (blobs.length) await del(blobs.map((b) => b.url));
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: 'Método no permitido.' });
  } catch (err) {
    console.error('[default]', err);
    return json(res, 500, { error: 'No se pudo consultar la portada.' });
  }
}
