// Utilidades compartidas por las funciones del laboratorio.
// Escribir (publicar enlaces, cambiar la portada, borrar) exige la clave LAB_KEY; leer es público.
import { createHash, timingSafeEqual } from 'node:crypto';

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

const digest = (s) => createHash('sha256').update(String(s)).digest();
export function keyOk(key) {
  const real = process.env.LAB_KEY;
  if (!real || typeof key !== 'string' || !key) return false;
  return timingSafeEqual(digest(key), digest(real)); // se comparan los hashes: misma longitud y tiempo constante
}
export const hasStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// Freno contra adivinar la clave: 8 fallos por IP y minuto (por instancia; la clave larga hace el resto).
const fails = new Map();
const ipOf = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconocida';
export function tooMany(req) { const f = fails.get(ipOf(req)); return Boolean(f && f.n >= 8 && Date.now() - f.t < 60_000); }
export function noteFail(req) {
  const ip = ipOf(req), f = fails.get(ip);
  if (!f || Date.now() - f.t > 60_000) fails.set(ip, { n: 1, t: Date.now() }); else f.n += 1;
  if (fails.size > 5000) fails.clear();
}

/** Devuelve true si la petición trae la clave correcta; si no, responde y devuelve false. */
export function guard(req, res) {
  if (!process.env.LAB_KEY) { json(res, 503, { error: 'Falta configurar la clave del laboratorio (LAB_KEY) en Vercel.' }); return false; }
  if (tooMany(req)) { json(res, 429, { error: 'Demasiados intentos. Espera un minuto.' }); return false; }
  if (!keyOk(req.headers['x-lab-key'])) { noteFail(req); json(res, 401, { error: 'Clave incorrecta.' }); return false; }
  return true;
}
export function needStore(res) {
  if (hasStore()) return true;
  json(res, 503, { error: 'El almacenamiento (Vercel Blob) no está conectado a este proyecto.' });
  return false;
}
