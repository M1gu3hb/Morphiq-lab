// POST /api/gate { pin } → comprueba el código de acceso del sitio y deja la cookie que abre la librería,
// la portada y el editor en este dispositivo (180 días). Los enlaces compartidos no la necesitan.
import { gateCookie, gateOn, gatePinOk, json, noteFail, sameOrigin, tooMany } from './_lib/lab.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido.' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido.' });
  if (!gateOn()) return json(res, 503, { error: 'El acceso no está configurado.' });
  if (tooMany(req)) return json(res, 429, { error: 'Demasiados intentos. Espera un minuto.' });
  const pin = req.body && typeof req.body === 'object' ? req.body.pin : null;
  if (!(await gatePinOk(typeof pin === 'string' ? pin.trim() : pin))) {
    noteFail(req);
    await wait(900); // cada intento fallido cuesta tiempo: frena probar códigos uno tras otro
    return json(res, 401, { error: 'Código incorrecto.' });
  }
  res.setHeader('set-cookie', gateCookie());
  return json(res, 200, { ok: true });
}
