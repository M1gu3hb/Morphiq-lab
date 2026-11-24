// Firma una subida directa del navegador a Vercel Blob (así una carta puede pesar más que el límite de 4.5 MB de una función).
// Sólo firma si la clave es correcta y la ruta es exactamente la de una carta o la de la portada.
import { handleUpload } from '@vercel/blob/client';
import { json, keyOk, needStore, noteFail, tooMany } from '../_lib/lab.js';

const PATHS = {
  card: /^3d-may-effect\/cards\/[a-z2-9]{8}\.json$/,
  default: /^3d-may-effect\/default\/\d{13}\.json$/,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido.' });
  if (!needStore(res)) return;
  if (tooMany(req)) return json(res, 429, { error: 'Demasiados intentos. Espera un minuto.' });
  try {
    const out = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let p = {};
        try { p = JSON.parse(clientPayload || '{}'); } catch (_) { /* carga inválida: se rechaza abajo */ }
        if (!keyOk(p.key)) { noteFail(req); throw new Error('Clave incorrecta.'); }
        const rule = PATHS[p.kind];
        if (!rule || !rule.test(pathname)) throw new Error('Ruta no permitida.');
        return { allowedContentTypes: ['application/json'], maximumSizeInBytes: 60 * 1024 * 1024, addRandomSuffix: false, allowOverwrite: false };
      },
    });
    return json(res, 200, out);
  } catch (err) {
    return json(res, 400, { error: err && err.message ? err.message : 'No se pudo autorizar la subida.' });
  }
}
