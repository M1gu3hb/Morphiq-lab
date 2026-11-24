// Piezas de interfaz del editor: creación de nodos, iconos, avisos, diálogos y el generador de controles.

export function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v; // sólo se usa con iconos propios, nunca con texto del usuario
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k in n && k !== 'list') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
}

const P = {
  eye: '<path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.600 5.200A10 10 0 0 1 12 5c6.400 0 10 7 10 7a17 17 0 0 1-3.300 4.200M6.300 6.400A17 17 0 0 0 2 12s3.600 7 10 7a10 10 0 0 0 4.200-.900M9.900 9.900a3 3 0 0 0 4.200 4.200"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.500"/><circle cx="8.500" cy="9.500" r="1.500"/><path d="M21 16l-5-5-9 9"/>',
  cube: '<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9z"/><path d="M12 12l8-4.500M12 12v9M12 12L4 7.500"/>',
  extrude: '<path d="M4 9l6-4h10v9l-6 4H4z"/><path d="M14 9h6M14 9v9M14 9H4"/>',
  type: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.500"/><path d="M16 10l5-3v10l-5-3"/>',
  sparkle: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z"/><path d="M19 15l.700 2.300L22 18l-2.300.700L19 21l-.700-2.300L16 18l2.300-.700z"/>',
  dots: '<circle cx="6" cy="7" r="1.200"/><circle cx="13" cy="5" r="1.600"/><circle cx="18" cy="11" r="1.200"/><circle cx="8" cy="14" r="1.700"/><circle cx="15" cy="18" r="1.300"/>',
  ascii: '<path d="M4 7h3M10 7h4M17 7h3M4 12h5M12 12h2M17 12h3M4 17h2M9 17h6M18 17h2"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  frame: '<rect x="3" y="3" width="18" height="18" rx="3"/><rect x="7" y="7" width="10" height="10" rx="1.500"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  card: '<rect x="5" y="3" width="14" height="18" rx="2.500"/><path d="M9 8h6M9 12h6"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3"/>',
  star: '<path d="M12 3l2.700 5.600 6.100.900-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100-4.400-4.300 6.100-.900z"/>',
};
export const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export function toast(msg, kind = '') {
  const box = document.getElementById('toasts');
  const t = h('div', { class: 'toast ' + kind, role: 'status', text: msg });
  box.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, kind === 'err' ? 5200 : 2600);
}

/** Diálogo modal. `build(close)` devuelve el contenido; la promesa se resuelve con lo que se pase a close(). */
export function modal(title, build) {
  return new Promise((res) => {
    const root = document.getElementById('modal'), prev = document.activeElement;
    const close = (v) => { root.hidden = true; root.textContent = ''; document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); res(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', { class: 'sheet-h' }, h('h2', { text: title }), h('button', { class: 'ic', type: 'button', 'aria-label': 'Cerrar', html: icon('x'), onclick: () => close(null) })),
      h('div', { class: 'sheet-b' }, build(close)));
    root.textContent = ''; root.append(h('div', { class: 'scrim', onclick: () => close(null) }), sheet); root.hidden = false;
    document.addEventListener('keydown', onKey);
    const f = sheet.querySelector('input,textarea,select,button.btn'); if (f) f.focus();
  });
}
export const confirmBox = (title, text, yes = 'Sí, eliminar') => modal(title, (close) => [
  h('p', { class: 'muted', text }),
  h('div', { class: 'row end' }, h('button', { class: 'btn small ghost', type: 'button', text: 'Cancelar', onclick: () => close(false) }), h('button', { class: 'btn small danger', type: 'button', text: yes, onclick: () => close(true) })),
]);

const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const fmt = (v, step) => { const d = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3; return Number(v).toFixed(d); };
let seq = 0;

/**
 * Pinta secciones de controles sobre `obj`. `set(path, value, final)` aplica el cambio;
 * `ctx.pickFile(field)` abre el selector de archivos y `ctx.assetName(id)` devuelve el nombre de un recurso.
 * Devuelve la «firma» de qué campos están visibles, para saber si hay que volver a pintar.
 */
export function renderFields(root, sections, obj, set, ctx = {}) {
  const sig = [];
  for (const sec of sections) {
    const on = sec.toggle ? !!getPath(obj, sec.toggle) : true;
    const box = h('section', { class: 'sec' + (on ? '' : ' off') });
    const head = h('div', { class: 'sec-h' }, h('h3', { text: sec.title }));
    if (sec.toggle) head.append(toggle(on, (v) => set(sec.toggle, v, true), sec.title));
    box.append(head);
    if (sec.note) box.append(h('p', { class: 'note', text: sec.note }));
    sig.push(on ? 1 : 0);
    if (on) for (const f of sec.fields) {
      const show = !f.when || f.when(obj); sig.push(show ? 1 : 0);
      if (show) box.append(field(f, obj, set, ctx));
    }
    root.append(box);
  }
  return sig.join('');
}
export function fieldSignature(sections, obj) {
  const sig = [];
  for (const sec of sections) { const on = sec.toggle ? !!getPath(obj, sec.toggle) : true; sig.push(on ? 1 : 0); if (on) for (const f of sec.fields) sig.push(!f.when || f.when(obj) ? 1 : 0); }
  return sig.join('');
}

function toggle(value, onChange, label) {
  const b = h('button', { class: 'tog', type: 'button', role: 'switch', 'aria-checked': String(!!value), 'aria-label': label });
  b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); onChange(v); });
  return b;
}

function field(f, obj, set, ctx) {
  const id = 'f' + ++seq, val = getPath(obj, f.k);
  const wrap = h('div', { class: 'fld t-' + f.t });
  const hint = f.hint ? h('p', { class: 'hint', text: f.hint }) : null;
  if (f.t === 'range') {
    const out = h('input', { class: 'num', type: 'number', inputMode: 'decimal', step: f.step, 'aria-label': f.label + ' (valor)', value: fmt(val ?? 0, f.step) });
    const r = h('input', { id, type: 'range', min: f.min, max: f.max, step: f.step, value: val ?? 0 });
    r.addEventListener('input', () => { out.value = fmt(r.value, f.step); set(f.k, Number(r.value), false); });
    r.addEventListener('change', () => set(f.k, Number(r.value), true));
    out.addEventListener('change', () => { const v = Number(out.value); if (Number.isFinite(v)) { r.value = v; set(f.k, v, true); } else out.value = fmt(r.value, f.step); }); // el campo numérico acepta valores fuera del rango del deslizador
    wrap.append(h('div', { class: 'fld-h' }, h('label', { for: id, text: f.label }), out), r);
  } else if (f.t === 'color') {
    const c = h('input', { id, type: 'color', value: /^#[0-9a-f]{6}$/i.test(val) ? val : '#ffffff' });
    const tx = h('input', { class: 'hex', type: 'text', maxLength: 7, spellcheck: false, 'aria-label': f.label + ' (hex)', value: val || '' });
    c.addEventListener('input', () => { tx.value = c.value; set(f.k, c.value, false); });
    c.addEventListener('change', () => set(f.k, c.value, true));
    tx.addEventListener('change', () => { let v = tx.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) { c.value = v; tx.value = v; set(f.k, v, true); } else tx.value = c.value; });
    wrap.append(h('label', { for: id, text: f.label }), h('div', { class: 'color' }, tx, c));
  } else if (f.t === 'seg') {
    const g = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': f.label });
    f.options.forEach(([v, lab]) => g.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === val), text: lab, onclick: () => set(f.k, v, true) })));
    wrap.append(h('span', { class: 'lab', text: f.label }), g);
  } else if (f.t === 'select') {
    const s = h('select', { id }, f.options.map(([v, lab]) => h('option', { value: v, text: lab, selected: v === val })));
    s.addEventListener('change', () => set(f.k, s.value, true));
    wrap.append(h('label', { for: id, text: f.label }), s);
  } else if (f.t === 'toggle') {
    wrap.append(h('span', { class: 'lab', text: f.label }), toggle(val, (v) => set(f.k, v, true), f.label));
  } else if (f.t === 'text' || f.t === 'textarea') {
    const i = h(f.t === 'textarea' ? 'textarea' : 'input', { id, value: val ?? '', rows: 2, spellcheck: false });
    i.addEventListener('input', () => set(f.k, i.value, false));
    i.addEventListener('change', () => set(f.k, i.value, true));
    wrap.append(h('label', { for: id, text: f.label }), i);
  } else if (f.t === 'file') {
    const name = ctx.assetName ? ctx.assetName(val) : '';
    const row = h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', html: icon('file', 16) + `<span>${f.label}</span>`, onclick: () => ctx.pickFile && ctx.pickFile(f) }));
    if (f.clearable && val) row.append(h('button', { class: 'btn small ghost', type: 'button', text: 'Quitar', onclick: () => set(f.k, null, true) }));
    wrap.append(row, h('p', { class: 'hint', text: name ? 'Actual: ' + name : 'Sin archivo' }));
  }
  if (hint) wrap.append(hint);
  return wrap;
}
