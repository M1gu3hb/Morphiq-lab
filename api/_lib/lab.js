// Utilidades compartidas por las funciones del laboratorio.
// Leer una carta es público. Escribir (publicar enlaces, cambiar la portada, borrar) exige haber entrado con la
// clave LAB_KEY: al entrar se entrega una cookie de sesión firmada (HttpOnly), así la clave nunca queda guardada
// en el navegador.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

const digest = (s) => createHash('sha256').update(String(s)).digest();
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
export const configured = () => Boolean(process.env.LAB_KEY);
export const hasStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export function keyOk(key) {
  if (!configured() || typeof key !== 'string' || !key || key.length > 200) return false;
  return timingSafeEqual(digest(key), digest(process.env.LAB_KEY)); // se comparan los hashes: misma longitud y tiempo constante
}

// Nombre corto de un enlace (mantener igual que en experiments/3d-may-effect/src/api.js).
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const RESERVED = ['lab', 'c', 'js', 'assets', 'api', 'index', 'default', 'cards'];
export const slugOk = (s) => typeof s === 'string' && SLUG_RE.test(s) && !RESERVED.includes(s);

// ---- sesión ----
const COOKIE = '__Host-morphiq-lab';
const DAYS = 30;
// La firma depende de LAB_KEY: cambiar la clave en Vercel cierra todas las sesiones abiertas.
const sign = (exp) => createHmac('sha256', digest('morphiq-lab-session:' + process.env.LAB_KEY)).update(String(exp)).digest('base64url');
const attrs = 'Path=/; HttpOnly; Secure; SameSite=Strict';
export const sessionCookie = () => { const exp = Date.now() + DAYS * 864e5; return `${COOKIE}=${exp}.${sign(exp)}; Max-Age=${DAYS * 86400}; ${attrs}`; };
export const clearCookie = () => `${COOKIE}=; Max-Age=0; ${attrs}`;
export function hasSession(req) {
  if (!configured()) return false;
  const raw = String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  return Boolean(exp && sig && Number(exp) > Date.now() && safeEq(sig, sign(exp)));
}
/** Defensa CSRF además de SameSite: lo que cambia estado debe venir de este mismo origen. */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.host; } catch (_) { return false; }
}

// Freno contra adivinar la clave: 8 fallos por IP y minuto (por instancia; una clave larga hace el resto).
const fails = new Map();
const ipOf = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida';
export function tooMany(req) { const f = fails.get(ipOf(req)); return Boolean(f && f.n >= 8 && Date.now() - f.t < 60_000); }
export function noteFail(req) {
  const ip = ipOf(req), f = fails.get(ip);
  if (!f || Date.now() - f.t > 60_000) fails.set(ip, { n: 1, t: Date.now() }); else f.n += 1;
  if (fails.size > 5000) fails.clear();
}

/** Devuelve true si la petición viene de una sesión válida; si no, responde y devuelve false. */
export function guard(req, res) {
  if (!configured()) { json(res, 503, { error: 'Falta configurar la clave del laboratorio (LAB_KEY) en Vercel.' }); return false; }
  if (req.method !== 'GET' && !sameOrigin(req)) { json(res, 403, { error: 'Origen no permitido.' }); return false; }
  if (!hasSession(req)) { json(res, 401, { error: 'Entra con la clave del laboratorio.' }); return false; }
  return true;
}
export function needStore(res) {
  if (hasStore()) return true;
  json(res, 503, { error: 'Falta conectar el almacenamiento (Vercel Blob) a este proyecto.' });
  return false;
}
