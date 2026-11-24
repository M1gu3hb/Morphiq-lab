// Cliente de las funciones del experimento (sesión, enlaces compartidos y portada).
const BASE = '/api/3d-may-effect';
const timeout = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (_) {}
  if (!res.ok) { const err = new Error((data && data.error) || `Error ${res.status}`); err.status = res.status; throw err; }
  return data;
}

async function fetchConfig(path) {
  try {
    const r = await fetch(BASE + path, { signal: timeout(6000) }); if (!r.ok) return null;
    const j = await r.json(); if (!j || !j.url) return null;
    const c = await fetch(j.url); return c.ok ? await c.json() : null;
  } catch (_) { return null; }
}
export const fetchDefault = () => fetchConfig('/default');
export const fetchCard = (id) => fetchConfig('/card?id=' + encodeURIComponent(id));

// La sesión vive en una cookie HttpOnly: la clave se escribe una vez y no se guarda en el navegador.
export const session = () => call('/session');
export const login = (key) => call('/session', { method: 'POST', body: { key } });
export const logout = () => call('/session', { method: 'DELETE' });
export const listCards = () => call('/cards');
export const deleteCard = (id) => call('/card?id=' + encodeURIComponent(id), { method: 'DELETE' });
export const resetDefault = () => call('/default', { method: 'DELETE' });

const newId = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map((n) => 'abcdefghijkmnpqrstuvwxyz23456789'[n % 32]).join(''); };

/** Sube la carta (ya portátil) directo al almacenamiento; la función sólo valida la clave y firma la subida. */
export async function publish(kind, cfg, onProgress) {
  const { upload } = await import('@vercel/blob/client');
  const id = kind === 'default' ? String(Date.now()) : newId();
  const pathname = `3d-may-effect/${kind === 'default' ? 'default' : 'cards'}/${id}.json`;
  const blob = new Blob([JSON.stringify(cfg)], { type: 'application/json' });
  await upload(pathname, blob, {
    access: 'public', contentType: 'application/json', handleUploadUrl: BASE + '/upload', multipart: blob.size > 8e6,
    clientPayload: JSON.stringify({ kind }),
    onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
  });
  return { id, size: blob.size, url: `${location.origin}/3d-may-effect/c/${id}` };
}
