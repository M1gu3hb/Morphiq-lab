// GET    /api/3d-may-effect/session → estado: { ok, configured, storage }
// POST   { key }                    → entra con la clave y deja una cookie de sesión (HttpOnly, 30 días)
// DELETE                            → cierra la sesión
import { clearCookie, configured, hasSession, hasStore, json, keyOk, noteFail, sameOrigin, sessionCookie, tooMany } from '../_lib/lab.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return json(res, 200, { ok: hasSession(req), configured: configured(), storage: hasStore() });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido.' });
  if (req.method === 'DELETE') { res.setHeader('set-cookie', clearCookie()); return json(res, 200, { ok: false }); }
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido.' });
  if (!configured()) return json(res, 503, { error: 'Falta configurar la clave del laboratorio (LAB_KEY) en Vercel.' });
  if (tooMany(req)) return json(res, 429, { error: 'Demasiados intentos. Espera un minuto.' });
  const key = req.body && typeof req.body === 'object' ? req.body.key : null;
  if (!keyOk(key)) { noteFail(req); return json(res, 401, { error: 'Clave incorrecta.' }); }
  res.setHeader('set-cookie', sessionCookie());
  return json(res, 200, { ok: true, configured: true, storage: hasStore() });
}
