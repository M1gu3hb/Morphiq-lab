// Firma una subida directa del navegador a Vercel Blob (así una carta puede pesar más que el límite de 4.5 MB de una función).
// Sólo firma si hay sesión válida y la ruta es exactamente la de una carta o la de la portada.
import { handleUpload } from '@vercel/blob/client';
import { guard, json, needStore, slugOk } from '../_lib/lab.js';

const CARD = /^3d-may-effect\/cards\/([a-z0-9-]{1,32})\.json$/;
const DEFAULT = /^3d-may-effect\/default\/\d{13}\.json$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido.' });
  if (!guard(req, res)) return;
  if (!needStore(res)) return;
  try {
    const out = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let p = {};
        try { p = JSON.parse(clientPayload || '{}'); } catch (_) { /* carga inválida: se rechaza abajo */ }
        const m = CARD.exec(pathname);
        const ok = p.kind === 'card' ? Boolean(m && slugOk(m[1])) : p.kind === 'default' ? DEFAULT.test(pathname) : false;
        if (!ok) throw new Error('Ruta no permitida.');
        // Un enlace se puede volver a publicar con el mismo nombre (se actualiza); la portada siempre es un archivo nuevo.
        return { allowedContentTypes: ['application/json'], maximumSizeInBytes: 60 * 1024 * 1024, addRandomSuffix: false, allowOverwrite: p.kind === 'card', cacheControlMaxAge: 300 };
      },
    });
    return json(res, 200, out);
  } catch (err) {
    return json(res, 400, { error: err && err.message ? err.message : 'No se pudo autorizar la subida.' });
  }
}
