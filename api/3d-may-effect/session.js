// GET    /api/3d-may-effect/session → estado: { ok, configured, storage, setup }
//        con ?setup=1 y sin clave creada, escribe el código de configuración en los registros de Vercel
// POST   { key }                    → entra con la clave y deja una cookie de sesión (HttpOnly, 30 días)
// POST   { setup: { code, key } }   → crea la primera clave (exige el código de configuración)
// POST   { change: { key } }        → cambia la clave (exige sesión); cierra las demás sesiones
// DELETE                            → cierra la sesión
import { checkKey, clearCookie, guard, hasSession, hasStore, isConfigured, json, keyValid, noteFail, sameOrigin, saveKey, sessionCookie, setupCode, setupCodeOk, tooMany } from '../_lib/lab.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const configured = await isConfigured(), storage = hasStore(), setup = !configured && storage;
      if (setup && req.query && req.query.setup === '1') console.log(`[morphiq-lab] Código de configuración: ${setupCode()}`);
      return json(res, 200, { ok: configured && (await hasSession(req)), configured, storage, setup });
    }
    if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido.' });
    if (req.method === 'DELETE') { res.setHeader('set-cookie', clearCookie()); return json(res, 200, { ok: false }); }
    if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido.' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (body.change) {
      if (process.env.LAB_KEY) return json(res, 409, { error: 'La clave está fija en la variable LAB_KEY de Vercel.' });
      if (!(await guard(req, res))) return;
      if (!keyValid(body.change.key)) return json(res, 400, { error: 'La clave debe tener al menos 8 caracteres.' });
      res.setHeader('set-cookie', sessionCookie(await saveKey(body.change.key)));
      return json(res, 200, { ok: true, configured: true, storage: true });
    }

    if (tooMany(req)) return json(res, 429, { error: 'Demasiados intentos. Espera un minuto.' });

    if (body.setup) {
      if (!hasStore()) return json(res, 503, { error: 'Falta conectar el almacenamiento (Vercel Blob) a este proyecto.' });
      if (await isConfigured()) return json(res, 409, { error: 'La clave ya está creada. Entra con ella.' });
      if (!setupCodeOk(body.setup.code)) { noteFail(req); return json(res, 401, { error: 'Código de configuración incorrecto.' }); }
      if (!keyValid(body.setup.key)) return json(res, 400, { error: 'La clave debe tener al menos 8 caracteres.' });
      res.setHeader('set-cookie', sessionCookie(await saveKey(body.setup.key)));
      return json(res, 200, { ok: true, configured: true, storage: true });
    }

    if (!(await isConfigured())) return json(res, 503, { error: hasStore() ? 'Aún no has creado la clave del laboratorio.' : 'Falta conectar el almacenamiento (Vercel Blob) a este proyecto.' });
    const gen = await checkKey(body.key);
    if (!gen) { noteFail(req); return json(res, 401, { error: 'Clave incorrecta.' }); }
    res.setHeader('set-cookie', sessionCookie(gen));
    return json(res, 200, { ok: true, configured: true, storage: hasStore() });
  } catch (err) {
    console.error('[session]', err);
    return json(res, 503, { error: 'No se pudo consultar el almacenamiento. Inténtalo de nuevo.' });
  }
}
