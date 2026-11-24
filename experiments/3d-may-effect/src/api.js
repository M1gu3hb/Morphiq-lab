// Cliente de las funciones del experimento (sesión, enlaces compartidos y portada).
const BASE = '/api/3d-may-effect';
const timeout = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (_) {}
  if (!res.ok) { const err = new Error((data && data.error) || `Error ${res.status}`); err.status = res.status; throw err; }
  return data;
}

// Nombre corto de un enlace: minúsculas, números y guiones (mantener igual que en api/_lib/lab.js).
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
export const RESERVED = ['lab', 'c', 'js', 'assets', 'api', 'index', 'default', 'cards'];
export const cleanSlug = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
export const slugOk = (s) => SLUG_RE.test(s) && !RESERVED.includes(s);
export const linkFor = (id) => `${location.origin}/3d-may-effect/${id}`;

async function fetchConfig(path) {
  try {
    const r = await fetch(BASE + path, { signal: timeout(6000) }); if (!r.ok) return null;
    const j = await r.json(); if (!j || !j.url) return null;
    const v = j.uploadedAt ? '?v=' + Date.parse(j.uploadedAt) : ''; // si el enlace se actualizó, no sirve la copia en caché
    const c = await fetch(j.url + v); return c.ok ? await c.json() : null;
  } catch (_) { return null; }
}
export const fetchDefault = () => fetchConfig('/default');
export const fetchCard = (id) => fetchConfig('/card?id=' + encodeURIComponent(id));
export const cardExists = (id) => call('/card?id=' + encodeURIComponent(id)).then(() => true, (e) => { if (e.status === 404) return false; throw e; });

// La sesión vive en una cookie HttpOnly: la clave se escribe una vez y no se guarda en el navegador.
export const session = () => call('/session');
export const login = (key) => call('/session', { method: 'POST', body: { key } });
export const logout = () => call('/session', { method: 'DELETE' });
export const listCards = () => call('/cards');
export const deleteCard = (id) => call('/card?id=' + encodeURIComponent(id), { method: 'DELETE' });
export const resetDefault = () => call('/default', { method: 'DELETE' });
export const pruneDefault = () => call('/default?keep=1', { method: 'DELETE' }).catch(() => {}); // limpia portadas anteriores

/** Sube la carta (ya portátil) directo al almacenamiento; la función sólo valida la sesión y firma la subida. */
export async function publish(kind, cfg, onProgress, slug) {
  const { upload } = await import('@vercel/blob/client');
  const id = kind === 'default' ? String(Date.now()) : slug;
  const pathname = `3d-may-effect/${kind === 'default' ? 'default' : 'cards'}/${id}.json`;
  const blob = new Blob([JSON.stringify(cfg)], { type: 'application/json' });
  await upload(pathname, blob, {
    access: 'public', contentType: 'application/json', handleUploadUrl: BASE + '/upload', multipart: blob.size > 8e6,
    clientPayload: JSON.stringify({ kind }),
    onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
  });
  return { id, size: blob.size, url: linkFor(id) };
}
