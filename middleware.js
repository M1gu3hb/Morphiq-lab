// Candado del laboratorio. La librería, la portada del experimento y el editor sólo se muestran a quien ya
// escribió el código de acceso en este dispositivo; a los demás se les sirve la pantalla de acceso (/gate).
//
// Los enlaces compartidos (/3d-may-effect/<nombre>) NO están en `matcher`: no pasan por aquí y siguen públicos.
// Experimento nuevo → añade aquí sus páginas privadas.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { next, rewrite } from '@vercel/functions';

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/', '/index', '/index.html', '/experiments.json',
    '/3d-may-effect', '/3d-may-effect/', '/3d-may-effect/index', '/3d-may-effect/index.html',
    '/3d-may-effect/lab', '/3d-may-effect/lab/', '/3d-may-effect/lab.html',
  ],
};

const COOKIE = '__Host-morphiq-gate';

/** ¿Trae la petición una cookie de acceso vigente y bien firmada? (misma firma que gateCookie en api/_lib/lab.js) */
export function hasAccess(cookieHeader, root) {
  if (!root) return false;
  const raw = String(cookieHeader || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const key = createHash('sha256').update(`morphiq-lab:gate:${root}`).digest();
  const good = Buffer.from(createHmac('sha256', key).update(String(exp)).digest('base64url')), got = Buffer.from(sig);
  return good.length === got.length && timingSafeEqual(good, got);
}

export default function middleware(request) {
  const root = process.env.LAB_KEY || process.env.BLOB_READ_WRITE_TOKEN || '';
  if (hasAccess(request.headers.get('cookie'), root)) return next();
  return rewrite(new URL('/gate', request.url), { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
