// Utilidades compartidas por las funciones del laboratorio.
// Leer una carta es público. Escribir (publicar enlaces, cambiar la portada, borrar) exige una sesión.
//
// La clave del laboratorio se crea desde el propio laboratorio la primera vez (con un código de configuración
// que sólo aparece en los registros de Vercel) y se guarda como hash scrypt en el almacén; nunca en texto claro.
// Al entrar se entrega una cookie de sesión firmada (HttpOnly), así la clave tampoco queda en el navegador.
// Alternativa: si existe la variable LAB_KEY, ésa es la clave y no hay configuración desde el laboratorio.
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { del, list, put } from '@vercel/blob';

const scryptAsync = promisify(scrypt);

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

const digest = (s) => createHash('sha256').update(String(s)).digest();
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
export const hasStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const envMode = () => Boolean(process.env.LAB_KEY);
// Raíz de las firmas: la clave fija si existe; si no, el token del almacén (sólo lo conoce el servidor).
const root = () => process.env.LAB_KEY || process.env.BLOB_READ_WRITE_TOKEN || '';
const mac = (label, data = '') => createHmac('sha256', digest(`morphiq-lab:${label}:${root()}`)).update(String(data)).digest();

// Nombre corto de un enlace (mantener igual que en experiments/3d-may-effect/src/api.js).
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const RESERVED = ['lab', 'c', 'js', 'assets', 'api', 'index', 'default', 'cards'];
export const slugOk = (s) => typeof s === 'string' && SLUG_RE.test(s) && !RESERVED.includes(s);

// ---- clave guardada en el almacén ----
const AUTH = '3d-may-effect/_auth/';
let backend = { list, put, del, fetch: (u) => fetch(u) }; // sustituible en las pruebas
export const __setBackend = (b) => { backend = b; cache = null; };
let cache = null; // { t, rec }

/** Registro vigente de la clave ({ salt, hash, gen }) o null si aún no se ha creado. Lanza si el almacén falla. */
export async function authRecord(fresh = false) {
  if (envMode() || !hasStore()) return null;
  if (!fresh && cache && Date.now() - cache.t < 60_000) return cache.rec;
  const { blobs } = await backend.list({ prefix: AUTH, limit: 20 });
  let rec = null;
  if (blobs.length) {
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const r = await backend.fetch(blobs[0].url);
    if (!r.ok) throw new Error('No se pudo leer la clave guardada');
    const j = await r.json();
    if (j && typeof j.salt === 'string' && typeof j.hash === 'string' && typeof j.gen === 'string') rec = { ...j, url: blobs[0].url, others: blobs.slice(1).map((b) => b.url) };
  }
  cache = { t: Date.now(), rec };
  return rec;
}
const hashKey = async (key, salt) => (await scryptAsync(String(key), Buffer.from(salt, 'hex'), 32, { N: 16384, r: 8, p: 1 })).toString('hex');
export const keyValid = (key) => typeof key === 'string' && key.length >= 8 && key.length <= 200;

/** Guarda una clave nueva (hash + sal) y retira las anteriores. Devuelve la generación, que va dentro de la cookie. */
export async function saveKey(key) {
  const old = await authRecord(true);
  const salt = randomBytes(16).toString('hex'), gen = Date.now().toString(36);
  const body = JSON.stringify({ v: 1, salt, hash: await hashKey(key, salt), gen });
  // El almacén es público: el sufijo aleatorio hace que la dirección del registro no se pueda adivinar.
  const b = await backend.put(`${AUTH}clave.json`, body, { access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 60 });
  const stale = old ? [old.url, ...old.others] : [];
  if (stale.length) await backend.del(stale).catch(() => {});
  cache = { t: Date.now(), rec: { salt, hash: JSON.parse(body).hash, gen, url: b.url, others: [] } };
  return gen;
}

export async function isConfigured() { return envMode() || Boolean(await authRecord()); }
/** Comprueba la clave. Devuelve la generación de la sesión ('0' con LAB_KEY) o null si no coincide. */
export async function checkKey(key) {
  if (typeof key !== 'string' || !key || key.length > 200) return null;
  if (envMode()) return timingSafeEqual(digest(key), digest(process.env.LAB_KEY)) ? '0' : null;
  const rec = await authRecord(true);
  if (!rec) return null;
  return safeEq(await hashKey(key, rec.salt), rec.hash) ? rec.gen : null;
}
/** Código para crear la primera clave: sale del token del almacén, así que sólo lo ve quien entra a Vercel. */
export function setupCode() {
  const A = 'abcdefghjkmnpqrstuvwxyz23456789', b = mac('setup');
  const s = [...b.subarray(0, 8)].map((n) => A[n % A.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
export const setupCodeOk = (code) => typeof code === 'string' && safeEq(code.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), setupCode().replace('-', ''));

// ---- candado del sitio (código de acceso) ----
// La librería, la portada y el editor piden un código una vez por dispositivo (lo aplica middleware.js).
// Aquí sólo vive el hash del código. Su sal incluye el código de configuración, que sale del token del almacén:
// sin ese secreto del servidor el hash no se puede atacar por fuerza bruta aunque el repositorio sea público.
// Para cambiar el código: define GATE_PIN en Vercel (tiene prioridad) o vuelve a generar este hash.
const GATE_HASH = '94c284476014b2af60308c723cff76f3f59de494dfccff233acd9f7e8a702696';
const GATE_COOKIE = '__Host-morphiq-gate';
const GATE_DAYS = 180;
export const gateOn = () => Boolean(root());
export async function gatePinOk(pin) {
  if (typeof pin !== 'string' || pin.length < 4 || pin.length > 64 || !root()) return false;
  if (process.env.GATE_PIN) return timingSafeEqual(digest(pin), digest(process.env.GATE_PIN));
  const h = await scryptAsync(pin, 'morphiq-gate:' + setupCode().replace('-', ''), 32, { N: 16384, r: 8, p: 1 });
  return safeEq(h.toString('hex'), GATE_HASH);
}
// La firma se calcula igual en middleware.js: HMAC-SHA256(sha256('morphiq-lab:gate:' + raíz), caducidad).
export const gateCookie = () => { const exp = Date.now() + GATE_DAYS * 864e5; return `${GATE_COOKIE}=${exp}.${mac('gate', exp).toString('base64url')}; Max-Age=${GATE_DAYS * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax`; };

// ---- sesión ----
const COOKIE = '__Host-morphiq-lab';
const DAYS = 30;
const sign = (exp, gen) => mac('session', `${exp}.${gen}`).toString('base64url');
const attrs = 'Path=/; HttpOnly; Secure; SameSite=Strict';
export const sessionCookie = (gen) => { const exp = Date.now() + DAYS * 864e5; return `${COOKIE}=${exp}.${gen}.${sign(exp, gen)}; Max-Age=${DAYS * 86400}; ${attrs}`; };
export const clearCookie = () => `${COOKIE}=; Max-Age=0; ${attrs}`;
/** Firma y caducidad de la cookie (sin tocar el almacén). Devuelve la generación o null. */
function cookieGen(req) {
  if (!root()) return null;
  const raw = String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [exp, gen, sig] = raw.slice(COOKIE.length + 1).split('.');
  return exp && gen && sig && Number(exp) > Date.now() && safeEq(sig, sign(exp, gen)) ? gen : null;
}
/** Sesión válida: cookie bien firmada y de la clave vigente (cambiar la clave cierra las sesiones anteriores). */
export async function hasSession(req) {
  const gen = cookieGen(req);
  if (!gen) return false;
  if (envMode()) return gen === '0';
  const rec = await authRecord();
  return Boolean(rec && rec.gen === gen);
}
/** Defensa CSRF además de SameSite: lo que cambia estado debe venir de este mismo origen. */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.host; } catch (_) { return false; }
}

// Freno contra adivinar la clave o el código: 8 fallos por IP y minuto (por instancia).
const fails = new Map();
const ipOf = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida';
export function tooMany(req) { const f = fails.get(ipOf(req)); return Boolean(f && f.n >= 8 && Date.now() - f.t < 60_000); }
export function noteFail(req) {
  const ip = ipOf(req), f = fails.get(ip);
  if (!f || Date.now() - f.t > 60_000) fails.set(ip, { n: 1, t: Date.now() }); else f.n += 1;
  if (fails.size > 5000) fails.clear();
}

/** Devuelve true si la petición viene de una sesión válida; si no, responde y devuelve false. */
export async function guard(req, res) {
  if (req.method !== 'GET' && !sameOrigin(req)) { json(res, 403, { error: 'Origen no permitido.' }); return false; }
  try {
    if (!(await isConfigured())) { json(res, 503, { error: hasStore() ? 'Aún no has creado la clave del laboratorio.' : 'Falta conectar el almacenamiento (Vercel Blob) a este proyecto.' }); return false; }
    if (!(await hasSession(req))) { json(res, 401, { error: 'Entra con la clave del laboratorio.' }); return false; }
  } catch (err) { console.error('[auth]', err); json(res, 503, { error: 'No se pudo consultar el almacenamiento. Inténtalo de nuevo.' }); return false; }
  return true;
}
export function needStore(res) {
  if (hasStore()) return true;
  json(res, 503, { error: 'Falta conectar el almacenamiento (Vercel Blob) a este proyecto.' });
  return false;
}
