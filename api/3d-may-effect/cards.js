// GET /api/3d-may-effect/cards (con clave) → enlaces publicados. También sirve para comprobar la clave.
import { list } from '@vercel/blob';
import { guard, hasStore, json } from '../_lib/lab.js';

const PREFIX = '3d-may-effect/cards/';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido.' });
  if (!guard(req, res)) return;
  if (!hasStore()) return json(res, 200, { cards: [], storage: false });
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
    const cards = blobs
      .map((b) => ({ id: b.pathname.slice(PREFIX.length).replace(/\.json$/, ''), size: b.size, uploadedAt: b.uploadedAt }))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    return json(res, 200, { cards, storage: true });
  } catch (err) {
    console.error('[cards]', err);
    return json(res, 500, { error: 'No se pudieron listar los enlaces.' });
  }
}
