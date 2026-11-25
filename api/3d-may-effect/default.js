// GET    /api/3d-may-effect/default → { url } de la carta fijada como portada, o { url: null } si es la original (público)
// DELETE (con sesión)              → vuelve a la portada original; con ?keep=1 sólo borra las portadas anteriores
// Cada vez que se fija una portada se guarda con la hora en el nombre; la vigente es la más reciente.
import { del, list } from '@vercel/blob';
import { guard, hasStore, json, needStore } from '../_lib/lab.js';

const PREFIX = '3d-may-effect/default/';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'DELETE') return json(res, 405, { error: 'Método no permitido.' });
  if (req.method === 'DELETE' && !(await guard(req, res))) return; // la sesión se valida antes de tocar el almacén
  if (!hasStore()) return req.method === 'GET' ? json(res, 200, { url: null }) : needStore(res); // sin almacén la portada es la original
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
    if (req.method === 'GET') return json(res, 200, { url: blobs[0] ? blobs[0].url : null });
    const old = blobs.slice(req.query && req.query.keep === '1' ? 1 : 0); // ?keep=1 conserva la vigente y limpia las anteriores
    if (old.length) await del(old.map((b) => b.url));
    return json(res, 200, { ok: true, removed: old.length });
  } catch (err) {
    console.error('[default]', err);
    return json(res, 500, { error: 'No se pudo consultar la portada.' });
  }
}
