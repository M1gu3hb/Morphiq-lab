// GET  /api/3d-may-effect/card?id=…  → { url } de una carta compartida (público)
// DELETE (con clave)                 → elimina el enlace
import { del, head } from '@vercel/blob';
import { guard, hasStore, json, needStore, slugOk } from '../_lib/lab.js';

export default async function handler(req, res) {
  const id = String((req.query && req.query.id) || '');
  if (!slugOk(id)) return json(res, 400, { error: 'Nombre de enlace inválido.' });
  if (!hasStore()) return req.method === 'GET' ? json(res, 404, { error: 'Esa carta no existe.' }) : needStore(res);
  const pathname = `3d-may-effect/cards/${id}.json`;
  try {
    if (req.method === 'GET') { const b = await head(pathname); return json(res, 200, { url: b.url, size: b.size, uploadedAt: b.uploadedAt }); }
    if (req.method === 'DELETE') { if (!guard(req, res)) return; await del(pathname); return json(res, 200, { ok: true }); }
    return json(res, 405, { error: 'Método no permitido.' });
  } catch (err) {
    if (err && /not.?found|does not exist/i.test(String(err.name) + String(err.message))) return json(res, 404, { error: 'Esa carta no existe.' });
    console.error('[card]', err);
    return json(res, 500, { error: 'No se pudo leer la carta.' });
  }
}
