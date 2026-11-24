// Laboratorio: editor de cartas con profundidad. Estado = la configuración de la carta; el motor la pinta en vivo.
import { MorphCard, normalizeConfig, newLayer, cloneConfig, uid, FRAME_STYLES, SHAPES } from '../engine/index.js';
import { FIELDS, CARD_FIELDS, TYPE_INFO, ACCEPT } from '../lab/fields.js';
import { h, icon, toast, modal, confirmBox, renderFields, fieldSignature } from '../lab/ui.js';
import * as store from '../lab/store.js';
import { TEMPLATES } from '../lab/templates.js';
import { standaloneHTML, download, slugify } from '../export.js';
import * as api from '../api.js';

const $ = (s) => document.querySelector(s);
const S = { cfg: null, id: null, sel: null, tab: 'layers', mode: 'tilt', hist: [], redo: [], sig: '' };
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };
const MAX_FILE = 40 * 1024 * 1024;
let card, saveT, histT;

// ---------- arranque ----------
async function boot() {
  try { card = new MorphCard($('#stage'), { offsetY: 0.07, fitScale: 0.86 }); } catch (e) { $('#pane').append(h('p', { class: 'muted pad', text: 'Tu navegador no soporta WebGL, que es lo que usa el editor.' })); return; }
  window.morphCard = card; window.morphLab = S; // a mano para depurar desde la consola
  bindChrome();
  const from = new URLSearchParams(location.search).get('from');
  let cfg = null, id = null;
  if (from) { cfg = await api.fetchCard(from); if (cfg) history.replaceState(null, '', location.pathname); else toast('No se encontró esa carta compartida', 'err'); }
  if (!cfg) { id = store.getLast(); if (id) cfg = await store.getCard(id).catch(() => null); }
  if (!cfg) { id = null; cfg = TEMPLATES.morphiq.make(); }
  await openCard(cfg, id);
  document.documentElement.classList.add('is-ready');
}

async function openCard(cfg, id, keepHistory = false) {
  (cfg.layers || []).forEach((l) => delete l.baked); // las cartas compartidas traen el texto ya dibujado; aquí vuelve a ser editable
  S.cfg = normalizeConfig(cfg); S.id = id || uid();
  if (!S.cfg.layers.some((l) => l.id === S.sel)) S.sel = null;
  await card.load(S.cfg);
  if (!keepHistory) { S.hist = [snap()]; S.redo = []; }
  store.setLast(S.id);
  $('#name').value = S.cfg.name; updateHistoryButtons(); render(); updateSelBox();
}

// ---------- guardado e historial ----------
const snap = () => { const { assets, ...rest } = S.cfg; return JSON.stringify(rest); };
function dirty(final = true) {
  clearTimeout(saveT); saveT = setTimeout(save, 1200); $('#saved').textContent = '';
  if (!final) return;
  clearTimeout(histT); histT = setTimeout(() => { const s = snap(); if (s !== S.hist[S.hist.length - 1]) { S.hist.push(s); if (S.hist.length > 60) S.hist.shift(); S.redo = []; updateHistoryButtons(); } }, 350);
}
async function save() {
  clearTimeout(saveT);
  try { S.thumb = card.snapshot(280); await store.saveCard(S.id, S.cfg, S.thumb); $('#saved').textContent = 'Guardado'; }
  catch (e) { $('#saved').textContent = 'Sin guardar'; console.warn(e); }
}
async function travel(fromStack, toStack) {
  clearTimeout(histT);
  if (fromStack === S.hist) { const s = snap(); if (s !== S.hist[S.hist.length - 1]) { S.hist.push(s); S.redo.length = 0; } } // un cambio de hace un instante también cuenta
  if (fromStack === S.hist ? S.hist.length < 2 : !S.redo.length) return;
  let target;
  if (fromStack === S.hist) { toStack.push(S.hist.pop()); target = S.hist[S.hist.length - 1]; } else { target = S.redo.pop(); S.hist.push(target); }
  const next = JSON.parse(target); next.assets = S.cfg.assets;
  await openCard(next, S.id, true); dirty(false);
}
function updateHistoryButtons() { $('#undo').disabled = S.hist.length < 2; $('#redo').disabled = !S.redo.length; }

// ---------- capas ----------
const layer = (id = S.sel) => S.cfg.layers.find((l) => l.id === id);
const zOf = (l) => (l.type === 'sparkles' ? Math.max(l.zNear, l.zFar) : l.depth);
const sorted = () => S.cfg.layers.map((l, i) => ({ l, i })).sort((a, b) => zOf(b.l) - zOf(a.l) || b.i - a.i).map((x) => x.l);

function fileToDataURL(file) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(file); }); }
/** Las imágenes enormes se reducen a 2048 px: pesan menos al compartir y no saturan la memoria del teléfono. */
async function prepareImage(file) {
  const url = await fileToDataURL(file);
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return url;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer la imagen')); i.src = url; });
  const max = Math.max(img.naturalWidth, img.naturalHeight);
  if (max <= 2048 && file.size < 1.5e6) return url;
  const k = Math.min(1, 2048 / max), c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const out = c.toDataURL('image/webp', 0.92);
  return out.startsWith('data:image/webp') && out.length < url.length ? out : url;
}
async function ingest(file, kind) {
  if (file.size > MAX_FILE) throw new Error('El archivo pesa más de 40 MB');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (kind === 'model' && !['glb', 'gltf', 'obj', 'fbx', 'stl', 'ply'].includes(ext)) throw new Error('Formato no soportado. Usa GLB, GLTF, OBJ, FBX, STL o PLY');
  const is = (prefix, exts) => (file.type ? file.type.startsWith(prefix) : exts.includes(ext)); // algunos selectores de Android no informan el tipo
  if (kind === 'image' && !is('image/', ['png', 'jpg', 'jpeg', 'webp', 'svg', 'avif'])) throw new Error('Ese archivo no es una imagen');
  if (kind === 'video' && !is('video/', ['mp4', 'webm', 'mov'])) throw new Error('Ese archivo no es un video');
  const src = kind === 'image' ? await prepareImage(file) : await fileToDataURL(file);
  const id = uid(); S.cfg.assets[id] = { name: file.name, type: file.type, src };
  return id;
}
function pick(accept) {
  return new Promise((res) => {
    const i = h('input', { type: 'file', accept, style: 'position:fixed;left:-999px' });
    i.addEventListener('change', () => { res(i.files[0] || null); i.remove(); });
    i.addEventListener('cancel', () => { res(null); i.remove(); });
    document.body.append(i); i.click();
  });
}

const PRESET = {
  image: { w: 0.6, depth: -0.2 }, relief: { w: 0.6, depth: 0.02 }, model: { w: 0.7, depth: -0.15 }, video: { depth: -0.7 },
  text: { depth: 0.03, y: -0.3 }, holo: { depth: -0.3 }, sparkles: {}, ascii: { depth: -0.6, bgAlpha: 0 }, fill: { depth: -0.85 }, frame: {},
};
async function addLayer(type) {
  const info = TYPE_INFO[type];
  if (type === 'frame') { const f = S.cfg.layers.find((l) => l.type === 'frame'); if (f) { select(f.id); return toast('La carta ya tiene marco: lo edito'); } }
  let asset = null;
  if (info.file) {
    const file = await pick(ACCEPT[info.file]); if (!file) return;
    try { asset = await ingest(file, info.file); } catch (e) { return toast(e.message, 'err'); }
  }
  const lc = newLayer(type, { ...PRESET[type], ...(asset ? { asset, name: S.cfg.assets[asset].name.replace(/\.[^.]+$/, '').slice(0, 28) } : {}) });
  S.cfg.layers.push(lc);
  await card.sync();
  const L = card.layers.get(lc.id);
  if (L && L.error) toast('No se pudo cargar: ' + (L.error.message || 'archivo dañado'), 'err');
  select(lc.id); dirty();
}
async function removeLayer(id) {
  const l = layer(id); if (!l) return;
  S.cfg.layers = S.cfg.layers.filter((x) => x.id !== id); card.cfg.layers = S.cfg.layers;
  if (S.sel === id) S.sel = null;
  await card.sync(); render(); updateSelBox(); dirty(); toast(`«${l.name}» eliminada. Puedes deshacer`);
}
async function duplicateLayer(id) {
  const l = layer(id); if (!l) return;
  const c = cloneConfig(l); c.id = uid(); c.name = (l.name + ' copia').slice(0, 40); c.x += 0.04; c.y -= 0.04;
  S.cfg.layers.splice(S.cfg.layers.indexOf(l) + 1, 0, c);
  await card.sync(); select(c.id); dirty();
}
function select(id, tab = 'edit') { S.sel = id; S.tab = tab; render(); updateSelBox(); }

function patchLayer(id, path, value, final) {
  card.patch(id, path, value);
  if (path === 'name' || path === 'visible' || path === 'depth') { /* la lista se repinta al cambiar de pestaña */ }
  dirty(final); updateSelBox();
  if (final && fieldSignature(FIELDS[layer(id).type], layer(id)) !== S.sig) renderPane();
}

// ---------- interfaz ----------
function bindChrome() {
  $('#name').addEventListener('input', (e) => { S.cfg.name = e.target.value.slice(0, 60) || 'Sin título'; dirty(false); });
  $('#name').addEventListener('change', () => dirty());
  $('#undo').addEventListener('click', () => travel(S.hist, S.redo));
  $('#redo').addEventListener('click', () => travel(S.redo, S.hist));
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || /input|textarea|select/i.test(e.target.tagName)) return;
    e.preventDefault(); e.shiftKey ? travel(S.redo, S.hist) : travel(S.hist, S.redo);
  });
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { S.tab = b.dataset.tab; render(); }));
  document.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  bindMove();
  window.addEventListener('resize', updateSelBox);
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.cfg) save(); }); // en el teléfono, cambiar de app es la última oportunidad fiable de guardar
}
function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  renderPane();
}
function renderPane() {
  const pane = $('#pane'), top = pane.scrollTop;
  pane.textContent = '';
  ({ layers: paneLayers, edit: paneEdit, card: paneCard, out: paneOut })[S.tab](pane);
  pane.scrollTop = S.tab === pane.dataset.tab ? top : 0; pane.dataset.tab = S.tab;
}

function paneLayers(pane) {
  const grid = h('div', { class: 'addgrid' }, Object.entries(TYPE_INFO).map(([type, t]) =>
    h('button', { class: 'add', type: 'button', onclick: () => addLayer(type) }, h('span', { class: 'add-i', html: icon(t.icon, 20) }), h('span', { class: 'add-t', text: t.label }), h('span', { class: 'add-d', text: t.desc }))));
  const list = h('ul', { class: 'layers' }, sorted().map((l) => {
    const li = h('li', { class: 'lay' + (l.id === S.sel ? ' sel' : '') + (l.visible ? '' : ' hid') });
    li.append(
      h('button', { class: 'ic', type: 'button', 'aria-label': l.visible ? 'Ocultar capa' : 'Mostrar capa', 'aria-pressed': String(!l.visible), html: icon(l.visible ? 'eye' : 'eyeoff'), onclick: () => { patchLayer(l.id, 'visible', !l.visible, true); renderPane(); } }),
      h('button', { class: 'lay-main', type: 'button', onclick: () => select(l.id) },
        h('span', { class: 'lay-i', html: icon(TYPE_INFO[l.type].icon, 17) }), h('span', { class: 'lay-n', text: l.name }),
        h('span', { class: 'lay-z mono', text: l.type === 'sparkles' ? `${Math.min(l.zNear, l.zFar).toFixed(2)}…${Math.max(l.zNear, l.zFar).toFixed(2)}` : (l.depth > 0 ? '+' : '') + l.depth.toFixed(2) })));
    return li;
  }));
  pane.append(
    h('div', { class: 'pane-h' }, h('h2', { text: 'Capas' }), h('span', { class: 'muted small', text: 'De adelante hacia el fondo' })),
    S.cfg.layers.length ? list : h('p', { class: 'muted pad', text: 'Todavía no hay capas. Añade una abajo.' }),
    h('div', { class: 'pane-h' }, h('h2', { text: 'Añadir' })), grid);
}

function paneEdit(pane) {
  const l = layer();
  if (!l) { pane.append(h('div', { class: 'empty' }, h('p', { class: 'muted', text: 'Elige una capa para editarla.' }), h('button', { class: 'btn small', type: 'button', text: 'Ver capas', onclick: () => { S.tab = 'layers'; render(); } }))); return; }
  const name = h('input', { class: 'lname', value: l.name, maxLength: 40, 'aria-label': 'Nombre de la capa', spellcheck: false });
  name.addEventListener('input', () => { l.name = name.value || TYPE_INFO[l.type].label; dirty(false); });
  name.addEventListener('change', () => dirty());
  pane.append(h('div', { class: 'edit-h' },
    h('span', { class: 'lay-i', html: icon(TYPE_INFO[l.type].icon, 18) }), name,
    h('button', { class: 'ic', type: 'button', 'aria-label': 'Duplicar capa', html: icon('copy'), onclick: () => duplicateLayer(l.id) }),
    h('button', { class: 'ic danger', type: 'button', 'aria-label': 'Eliminar capa', html: icon('trash'), onclick: () => removeLayer(l.id) })));
  const L = card.layers.get(l.id);
  if (L && L.error) pane.append(h('p', { class: 'warn', text: 'Esta capa no pudo cargarse: ' + (L.error.message || 'archivo dañado') + '. Cambia el archivo.' }));
  S.sig = renderFields(pane, FIELDS[l.type], l, (path, v, final) => patchLayer(l.id, path, v, final), {
    assetName: (id) => (S.cfg.assets[id] ? S.cfg.assets[id].name : ''),
    pickFile: async (f) => {
      const file = await pick(f.accept); if (!file) return;
      try { const id = await ingest(file, f.kind); patchLayer(l.id, f.k, id, true); renderPane(); } catch (e) { toast(e.message, 'err'); }
    },
  });
}

function setCard(path, v, final) { setPath(S.cfg, path, v); card.refresh(); dirty(final); updateSelBox(); }
function paneCard(pane) {
  const c = S.cfg.card, frame = S.cfg.layers.find((l) => l.type === 'frame');
  const shapeKey = Object.keys(SHAPES).find((k) => Math.abs(SHAPES[k].ratio - c.ratio) < 0.005) || '';
  const style = frame ? frame.style : 'none';
  const sel = (label, options, value, onChange) => { const s = h('select', {}, options.map(([v, t]) => h('option', { value: v, text: t, selected: v === value }))); s.addEventListener('change', () => onChange(s.value)); return h('div', { class: 'fld t-select' }, h('label', {}, label, s)); };
  const ratio = h('input', { type: 'range', min: 0.4, max: 2, step: 0.005, value: c.ratio, 'aria-label': 'Proporción (ancho ÷ alto)' });
  ratio.addEventListener('input', () => setCard('card.ratio', Number(ratio.value), false));
  ratio.addEventListener('change', () => { setCard('card.ratio', Number(ratio.value), true); renderPane(); });
  const box = h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h3', { text: 'Forma y marco' })),
    sel('Forma', [['', 'Personalizada'], ...Object.entries(SHAPES).map(([k, s]) => [k, s.label])], shapeKey, (k) => { if (SHAPES[k]) { setCard('card.ratio', SHAPES[k].ratio, true); renderPane(); } }),
    h('div', { class: 'fld t-range' }, h('div', { class: 'fld-h' }, h('span', { class: 'lab', text: 'Proporción (ancho ÷ alto)' }), h('span', { class: 'mono small', text: c.ratio.toFixed(3) })), ratio),
    sel('Estilo de marco', Object.entries(FRAME_STYLES).map(([k, s]) => [k, s.label]), style, (k) => applyFrameStyle(k)),
    frame ? h('button', { class: 'btn small', type: 'button', text: 'Editar colores y brillo del marco', onclick: () => select(frame.id) }) : null);
  pane.append(box);
  renderFields(pane, CARD_FIELDS, S.cfg, setCard);
}
async function applyFrameStyle(k) {
  const st = FRAME_STYLES[k]; let frame = S.cfg.layers.find((l) => l.type === 'frame');
  if (!frame) { frame = newLayer('frame', {}); S.cfg.layers.push(frame); await card.sync(); }
  Object.assign(S.cfg.card, { radius: st.radius, winRadius: st.winRadius, inset: { ...st.inset } });
  frame.color = st.color; frame.visible = k !== 'none';
  card.patch(frame.id, 'style', k);
  if (k === 'image' && !frame.asset) toast('Sube la imagen del marco desde «Editar»');
  card.refresh(); const L = card.layers.get(frame.id); if (L) L.group.visible = frame.visible;
  dirty(); renderPane(); updateSelBox();
}

// ---------- salida ----------
async function withBusy(btn, label, fn) {
  const old = btn.innerHTML; btn.disabled = true; btn.textContent = label;
  try { return await fn(); } catch (e) { console.error(e); toast(e.message || 'Algo falló', 'err'); return null; } finally { btn.disabled = false; btn.innerHTML = old; }
}
function askKey() {
  return modal('Clave del laboratorio', (close) => {
    const i = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Clave', 'aria-label': 'Clave del laboratorio' });
    const msg = h('p', { class: 'hint', text: 'Sólo con la clave se pueden publicar enlaces o cambiar la portada. La sesión queda abierta 30 días en este dispositivo; la clave no se guarda.' });
    const go = h('button', { class: 'btn small primary', type: 'button', text: 'Entrar' });
    const run = async () => {
      const key = i.value.trim(); if (!key) return;
      go.disabled = true; go.textContent = 'Comprobando…';
      try { const st = await api.login(key); S.auth = true; S.storage = st.storage; close(true); }
      catch (e) { msg.textContent = e.status === 401 ? 'Clave incorrecta.' : (e.message || 'No se pudo comprobar.'); msg.classList.add('err'); go.disabled = false; go.textContent = 'Entrar'; }
    };
    go.addEventListener('click', run); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    return [i, msg, h('div', { class: 'row end' }, go)];
  });
}
async function needSession(storage = false) {
  if (!S.auth) {
    const st = await api.session().catch(() => null);
    if (!st) { toast('No se pudo contactar al servidor', 'err'); return false; }
    if (!st.configured) { toast('Falta configurar la clave del laboratorio (LAB_KEY) en Vercel', 'err'); return false; }
    S.storage = st.storage; S.auth = st.ok;
    if (!S.auth && !(await askKey())) return false;
  }
  if (storage && S.storage === false) { toast('Falta conectar el almacenamiento (Vercel Blob) al proyecto en Vercel', 'err'); return false; }
  return true;
}
async function publish(kind, btn) {
  if (!(await needSession(true))) return null;
  return withBusy(btn, 'Preparando…', async () => {
    const cfg = await card.portable();
    try { return await api.publish(kind, cfg, (p) => { btn.textContent = `Subiendo ${Math.round(p)}%`; }); }
    catch (e) {
      const st = await api.session().catch(() => null); // ¿falló por la sesión o por la red?
      if (st && !st.ok) { S.auth = false; throw new Error('La sesión caducó. Vuelve a intentarlo.'); }
      throw new Error('No se pudo subir la carta. Revisa tu conexión e inténtalo de nuevo.');
    }
  });
}
async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Enlace copiado'); } catch (_) { toast(text); } }

function paneOut(pane) {
  const linkBox = h('div', { class: 'linkbox', hidden: true });
  const showLink = (url) => {
    linkBox.hidden = false; linkBox.textContent = '';
    linkBox.append(h('input', { readOnly: true, value: url, 'aria-label': 'Enlace de la carta', onfocus: (e) => e.target.select() }),
      h('button', { class: 'btn small', type: 'button', text: 'Copiar', onclick: () => copy(url) }),
      navigator.share ? h('button', { class: 'btn small', type: 'button', text: 'Enviar', onclick: () => navigator.share({ title: S.cfg.name, url }).catch(() => {}) }) : null);
  };
  const bHtml = h('button', { class: 'btn primary wide', type: 'button', html: icon('download') + '<span>Descargar HTML</span>' });
  bHtml.addEventListener('click', () => withBusy(bHtml, 'Generando…', async () => { download(slugify(S.cfg.name) + '.html', await standaloneHTML(card, { title: S.cfg.name })); toast('HTML descargado'); }));
  const bLink = h('button', { class: 'btn wide', type: 'button', html: icon('link') + '<span>Crear enlace para compartir</span>' });
  bLink.addEventListener('click', async () => { const r = await publish('card', bLink); if (r) { showLink(r.url); copy(r.url); } });
  const bDef = h('button', { class: 'btn wide', type: 'button', html: icon('star') + '<span>Usar como portada del experimento</span>' });
  bDef.addEventListener('click', async () => { const r = await publish('default', bDef); if (r) toast('Listo: esta carta ya es la portada'); });
  const bReset = h('button', { class: 'btn small ghost', type: 'button', text: 'Volver a la portada original' });
  bReset.addEventListener('click', async () => { if (!(await needSession(true))) return; await withBusy(bReset, 'Restaurando…', async () => { await api.resetDefault(); toast('Portada original restaurada'); }); });
  const bJson = h('button', { class: 'btn small', type: 'button', text: 'Guardar proyecto (.json)' });
  bJson.addEventListener('click', () => withBusy(bJson, 'Generando…', async () => { const p = await card.portable(); p.layers.forEach((l) => delete l.baked); download(slugify(S.cfg.name) + '.morphcard.json', JSON.stringify(p), 'application/json'); }));
  const bOpen = h('button', { class: 'btn small', type: 'button', text: 'Abrir proyecto' });
  bOpen.addEventListener('click', async () => {
    const f = await pick('.json,application/json'); if (!f) return;
    try { const cfg = JSON.parse(await f.text()); if (!cfg || !Array.isArray(cfg.layers)) throw new Error(); await save(); await openCard(cfg, null); dirty(); toast('Proyecto abierto'); } catch (_) { toast('Ese archivo no es un proyecto válido', 'err'); }
  });

  const saved = h('div', { class: 'saved-list' }, h('p', { class: 'muted small', text: 'Cargando…' }));
  store.listCards().then((list) => {
    saved.textContent = '';
    if (!list.length) saved.append(h('p', { class: 'muted small', text: 'Aquí aparecen las cartas que vayas haciendo. Se guardan solas.' }));
    list.forEach((m) => saved.append(h('div', { class: 'scard' + (m.id === S.id ? ' cur' : '') },
      h('button', { class: 'scard-main', type: 'button', 'aria-label': 'Abrir ' + m.name, onclick: async () => { if (m.id === S.id) return; await save(); const cfg = await store.getCard(m.id); if (cfg) { await openCard(cfg, m.id); toast('Carta abierta'); } } },
        m.thumb ? h('img', { src: m.thumb, alt: '', loading: 'lazy' }) : h('span', { class: 'ph' }), h('span', { class: 'scard-n', text: m.name })),
      m.id === S.id ? h('span', { class: 'cur-tag mono', text: 'ABIERTA' }) : h('button', { class: 'ic danger', type: 'button', 'aria-label': 'Eliminar ' + m.name, html: icon('trash', 16), onclick: async () => { if (await confirmBox('Eliminar carta', `«${m.name}» se borrará de este dispositivo.`)) { await store.removeCard(m.id); renderPane(); } } }))));
  }).catch(() => { saved.textContent = ''; saved.append(h('p', { class: 'muted small', text: 'Este navegador no permite guardar cartas (¿modo privado?).' })); });

  const links = h('div', { class: 'links' });
  const bLinks = h('button', { class: 'btn small ghost', type: 'button', text: 'Ver mis enlaces publicados' });
  bLinks.addEventListener('click', async () => {
    if (!(await needSession(true))) return;
    await withBusy(bLinks, 'Cargando…', async () => {
      const { cards } = await api.listCards(); links.textContent = '';
      if (!cards.length) links.append(h('p', { class: 'muted small', text: 'Aún no has publicado enlaces.' }));
      cards.forEach((c) => { const url = `${location.origin}/3d-may-effect/c/${c.id}`; links.append(h('div', { class: 'lrow' },
        h('a', { href: url, target: '_blank', rel: 'noopener', class: 'mono small', text: '/c/' + c.id }), h('span', { class: 'muted small', text: `${(c.size / 1e6).toFixed(1)} MB · ${new Date(c.uploadedAt).toLocaleDateString('es-MX')}` }),
        h('button', { class: 'ic', type: 'button', 'aria-label': 'Copiar enlace', html: icon('copy', 16), onclick: () => copy(url) }),
        h('button', { class: 'ic danger', type: 'button', 'aria-label': 'Eliminar enlace', html: icon('trash', 16), onclick: async () => { if (await confirmBox('Eliminar enlace', 'El enlace dejará de funcionar para todos.')) { try { await api.deleteCard(c.id); bLinks.click(); } catch (e) { toast(e.message, 'err'); } } } }))); });
    });
  });

  const auth = h('div', { class: 'row' }, h('span', { class: 'muted small', text: 'Comprobando…' }));
  api.session().then((st) => {
    S.auth = st.ok; S.storage = st.storage; auth.textContent = '';
    auth.append(h('span', { class: 'muted small', text: !st.configured ? 'Falta configurar la clave (LAB_KEY) en Vercel.' : st.ok ? 'Sesión abierta en este dispositivo.' : 'Sin sesión: se pedirá la clave al publicar.' }));
    if (st.configured) auth.append(h('button', { class: 'btn small ghost', type: 'button', text: st.ok ? 'Cerrar sesión' : 'Entrar', onclick: async () => { if (st.ok) { await api.logout().catch(() => {}); S.auth = false; toast('Sesión cerrada'); } else await askKey(); renderPane(); } }));
    if (st.configured && !st.storage) auth.append(h('p', { class: 'hint', text: 'Falta conectar el almacenamiento (Vercel Blob): sin él no se pueden crear enlaces ni cambiar la portada. Exportar HTML funciona siempre.' }));
  }).catch(() => { auth.textContent = ''; auth.append(h('span', { class: 'muted small', text: 'Sin conexión con el servidor. Exportar HTML funciona igual.' })); });
  const tpl = h('div', { class: 'tpl' }, Object.entries(TEMPLATES).map(([k, t]) => h('button', { class: 'add', type: 'button', onclick: async () => { await save(); await openCard(t.make(), null); dirty(); S.tab = 'layers'; render(); toast('Carta nueva: ' + t.label); } }, h('span', { class: 'add-t', text: t.label }), h('span', { class: 'add-d', text: t.desc }))));
  pane.append(
    h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h3', { text: 'Exportar' })), h('p', { class: 'note', text: 'Un solo archivo con todo dentro: se abre en cualquier teléfono o computadora, sin internet.' }), bHtml),
    h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h3', { text: 'Compartir' })), bLink, linkBox, bDef, h('div', { class: 'row' }, bReset, bLinks), links),
    h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h3', { text: 'Carta nueva' })), tpl),
    h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h3', { text: 'Mis cartas' })), saved, h('div', { class: 'row' }, bJson, bOpen)),
    h('section', { class: 'sec' }, h('div', { class: 'sec-h' }, h('h3', { text: 'Sesión' })), auth));
}

// ---------- modo mover ----------
function setMode(m) {
  S.mode = m; card.setFrozen(m === 'move');
  document.querySelectorAll('.modes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  $('.stagewrap').classList.toggle('moving', m === 'move');
  $('#stagehint').textContent = m === 'move' ? 'Toca una capa y arrástrala · pellizca o usa la rueda para escalar' : '';
  updateSelBox();
}
function toUnits(e) {
  const b = $('#stage').getBoundingClientRect(), u = card.unitsPerPx;
  return { x: (e.clientX - b.left - b.width * (0.5 + card.opts.offsetX)) * u, y: -(e.clientY - b.top - b.height * (0.5 - card.opts.offsetY)) * u };
}
function updateSelBox() {
  const box = $('#selbox'), b = S.mode === 'move' && S.sel ? card.layerBounds(S.sel) : null;
  if (!b || !card.unitsPerPx) { box.hidden = true; return; }
  const r = $('#stage').getBoundingClientRect(), u = card.unitsPerPx;
  const cx = r.width * (0.5 + card.opts.offsetX) + b.x / u, cy = r.height * (0.5 - card.opts.offsetY) - b.y / u;
  Object.assign(box.style, { width: b.w / u + 'px', height: b.h / u + 'px', left: cx - b.w / u / 2 + 'px', top: cy - b.h / u / 2 + 'px', transform: `rotate(${-b.rot}rad)` });
  box.hidden = false;
}
function bindMove() {
  const el = $('.stagewrap'), pts = new Map();
  let drag = null, pinch = null;
  const scaleKey = (l) => (l.type === 'text' ? 'size' : l.fit === 'cover' ? 'zoom' : 'w');
  const hit = (p) => sorted().find((l) => { if (!l.visible) return false; const b = card.layerBounds(l.id); return b && Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.y - b.y) <= b.h / 2; });
  el.addEventListener('pointerdown', (e) => {
    if (S.mode !== 'move' || e.target.closest('.modes')) return;
    pts.set(e.pointerId, e); try { el.setPointerCapture(e.pointerId); } catch (_) { /* puntero sintético o ya liberado */ }
    if (pts.size === 2 && layer()) { const [a, b] = [...pts.values()]; const l = layer(); pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, v: l[scaleKey(l)] }; drag = null; return; }
    const p = toUnits(e), cur = S.sel && card.layerBounds(S.sel);
    const onCur = cur && Math.abs(p.x - cur.x) <= cur.w / 2 && Math.abs(p.y - cur.y) <= cur.h / 2; // si tocas la capa ya elegida, se queda aunque haya otra encima
    const found = onCur ? null : hit(p);
    if (found && found.id !== S.sel) { S.sel = found.id; if (S.tab === 'edit' || S.tab === 'layers') renderPane(); updateSelBox(); }
    const l = layer(); if (l) drag = { p, x: l.x, y: l.y, moved: false };
  });
  el.addEventListener('pointermove', (e) => {
    if (S.mode !== 'move' || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e); const l = layer(); if (!l) return;
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const k = (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1) / pinch.d; patchLayer(l.id, scaleKey(l), Math.max(0.005, pinch.v * k), false); return; }
    if (!drag) return;
    const p = toUnits(e); drag.moved = true;
    card.patch(l.id, 'x', +(drag.x + p.x - drag.p.x).toFixed(4)); card.patch(l.id, 'y', +(drag.y + p.y - drag.p.y).toFixed(4));
    updateSelBox(); dirty(false);
  });
  const up = (e) => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if ((drag && drag.moved) || pinch) { dirty(); if (S.tab === 'edit') renderPane(); } if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => {
    if (S.mode !== 'move' || !layer()) return; e.preventDefault();
    const l = layer(), k = scaleKey(l); patchLayer(l.id, k, Math.max(0.005, +(l[k] * (e.deltaY < 0 ? 1.04 : 0.96)).toFixed(4)), true); if (S.tab === 'edit') renderPane();
  }, { passive: false });
}

boot();
