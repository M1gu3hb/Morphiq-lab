// Cartas guardadas en este dispositivo (IndexedDB): «meta» para listar rápido y «cards» con la configuración completa.
const DB = 'morphiq-lab-3d-may-effect';
let dbp = null;
const open = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('cards', { keyPath: 'id' }); r.result.createObjectStore('meta', { keyPath: 'id' }); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const tx = async (stores, mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => { const t = db.transaction(stores, mode); const out = fn(t); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
};
export const saveCard = (id, cfg, thumb) => tx(['cards', 'meta'], 'readwrite', (t) => { t.objectStore('cards').put({ id, cfg }); t.objectStore('meta').put({ id, name: cfg.name, updated: Date.now(), thumb }); });
export const getCard = async (id) => { const r = await tx(['cards'], 'readonly', (t) => t.objectStore('cards').get(id)); return r ? r.cfg : null; };
export const listCards = async () => ((await tx(['meta'], 'readonly', (t) => t.objectStore('meta').getAll())) || []).sort((a, b) => b.updated - a.updated);
export const removeCard = (id) => tx(['cards', 'meta'], 'readwrite', (t) => { t.objectStore('cards').delete(id); t.objectStore('meta').delete(id); });
const LAST = 'morphiq-lab:3d:last';
export const getLast = () => { try { return localStorage.getItem(LAST); } catch (_) { return null; } };
export const setLast = (id) => { try { localStorage.setItem(LAST, id); } catch (_) {} };
