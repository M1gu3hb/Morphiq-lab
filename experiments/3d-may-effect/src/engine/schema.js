// Esquema de una carta: valores por defecto de cada tipo de capa y normalización.
// Unidades: 1 = ancho de la carta. x→derecha, y→arriba, depth<0 = detrás del plano de la carta.

export const uid = () => Math.random().toString(36).slice(2, 9);

const FOIL = { on: false, type: 'sheen', amount: 0.6, scale: 1, sat: 1, tint: '#ffffff' };
const SHADOW = { on: false, dist: 0.1, blur: 0.5, alpha: 0.55, dx: 0.012, dy: -0.02 };

export const COMMON = {
  visible: true, x: 0, y: 0, w: 0.6, depth: 0, rot: 0, opacity: 1,
  blend: 'normal', clip: 'window', fit: 'free', zoom: 1,
};

export const LAYER_DEFAULTS = {
  fill: {
    name: 'Relleno', fit: 'cover', ar: 1, kind: 'radial',
    a: '#12306e', aAlpha: 1, b: '#02040a', bAlpha: 1, angle: 90, cx: 0, cy: 0, spread: 1,
    radius: 0, stroke: '#ffffff', strokeW: 0, strokeAlpha: 0.5,
  },
  ascii: {
    name: 'ASCII', fit: 'cover', ar: 1, cells: 34, speed: 1, density: 1, glow: 0.6,
    c1: '#0d2a63', c2: '#1d6ee0', c3: '#38e1ff', c4: '#d9f4ff', bg: '#03050b', bgAlpha: 1,
    chars: ' .·:-=+*#%@',
  },
  image: { name: 'Imagen', asset: null, tint: '#ffffff', foil: { ...FOIL }, shadow: { ...SHADOW } },
  video: { name: 'Video', asset: null, fit: 'cover', tint: '#ffffff', foil: { ...FOIL } },
  text: {
    name: 'Texto', text: 'MORPHIQ', font: 'Michroma', weight: 400, size: 0.07, spacing: 0.08,
    align: 'center', style: 'solid', color: '#ffffff', color2: '#1e5bff',
    stroke: '#000000', strokeW: 0, glow: 0, glowColor: '#1e5bff', upper: false, clip: 'card',
    foil: { ...FOIL }, shadow: { ...SHADOW },
  },
  holo: {
    name: 'Holo', fit: 'cover', ar: 1, blend: 'add', mask: null,
    foil: { on: true, type: 'glitter', amount: 0.8, scale: 1, sat: 1, tint: '#ffffff' },
  },
  sparkles: {
    name: 'Partículas', count: 120, size: 0.02, zNear: -0.05, zFar: -0.6, speed: 0.3,
    color: '#8fd0ff', color2: '#ffffff', twinkle: 0.7, blend: 'add',
  },
  frame: {
    name: 'Marco', style: 'metal', clip: 'card', color: '#1a2030', accent: '#1e5bff',
    title: 'morphiq.exe', caption: 'Astral Morphiq Systems', asset: null, cut: true,
    foil: { on: true, type: 'sheen', amount: 0.45, scale: 1, sat: 0.25, tint: '#ffffff' },
  },
  model: {
    name: 'Modelo 3D', asset: null, w: 0.7, depth: -0.15, clip: 'auto',
    rx: 0, ry: 0, rz: 0, spin: 0, bob: 0.008, follow: 0.5,
    material: 'original', color: '#1e5bff', metal: 0.9, rough: 0.25, env: 1,
  },
  relief: {
    name: 'Relieve 3D', asset: null, w: 0.7, depth: 0.02, clip: 'auto',
    thickness: 0.08, bevel: 0.006, side: '#0b2a6e', metal: 0.55, rough: 0.4, glow: 0.5,
    float: 0.1, threshold: 0.5, detail: 0.6, follow: 0.25, rx: 0, ry: 0,
    shadow: { ...SHADOW, on: true },
  },
};

// Formas y marcos predefinidos (el marco define cuánto mide la «ventana» de la carta).
export const FRAME_STYLES = {
  metal:  { label: 'Metal',   color: '#1a2030', inset: { t: 0.035, r: 0.035, b: 0.035, l: 0.035 }, radius: 0.05, winRadius: 0.03 },
  window: { label: 'Ventana', color: '#c9cdd6', inset: { t: 0.15, r: 0.03, b: 0.085, l: 0.03 }, radius: 0.012, winRadius: 0.004 },
  glass:  { label: 'Cristal', color: '#ffffff', inset: { t: 0.022, r: 0.022, b: 0.022, l: 0.022 }, radius: 0.06, winRadius: 0.045 },
  image:  { label: 'Tu imagen', color: '#ffffff', inset: { t: 0.06, r: 0.06, b: 0.06, l: 0.06 }, radius: 0.045, winRadius: 0.02 },
  none:   { label: 'Sin marco', color: '#000000', inset: { t: 0, r: 0, b: 0, l: 0 }, radius: 0.05, winRadius: 0.05 },
};

export const SHAPES = {
  carta:      { label: 'Carta 63×88', ratio: 0.716 },
  ventana:    { label: 'Ventana 4:5', ratio: 0.8 },
  cuadrado:   { label: 'Cuadrado', ratio: 1 },
  historia:   { label: 'Vertical 9:16', ratio: 0.5625 },
  horizontal: { label: 'Horizontal 88:63', ratio: 1.397 },
};

export const BASE = {
  v: 1,
  name: 'Sin título',
  card: { ratio: 0.716, radius: 0.05, winRadius: 0.03, inset: { t: 0.035, r: 0.035, b: 0.035, l: 0.035 } },
  stage: { bg1: '#07102a', bg2: '#03050b', glow: '#1e5bff', glowAmt: 0.14, fit: 0.84 },
  motion: { maxTilt: 22, idle: 1, idleSpeed: 1, lift: 1 },
  light: { x: 0.55, y: 0.85, intensity: 0.55, env: 0.9 },
  assets: {},
  layers: [],
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const fillIn = (target, defaults) => {
  for (const k in defaults) {
    const d = defaults[k];
    if (target[k] === undefined) target[k] = (d && typeof d === 'object') ? clone(d) : d;
    else if (d && typeof d === 'object' && !Array.isArray(d) && target[k] && typeof target[k] === 'object') fillIn(target[k], d);
  }
  return target;
};

export function newLayer(type, extra = {}) {
  return fillIn({ id: uid(), type, ...clone(extra) }, { ...COMMON, ...LAYER_DEFAULTS[type] });
}

// Completa lo que falte sin tocar lo que ya viene; devuelve el mismo objeto.
export function normalizeConfig(cfg) {
  fillIn(cfg, BASE);
  cfg.layers = (cfg.layers || []).filter((l) => l && LAYER_DEFAULTS[l.type]);
  for (const l of cfg.layers) {
    if (!l.id) l.id = uid();
    fillIn(l, { ...COMMON, ...LAYER_DEFAULTS[l.type] });
  }
  return cfg;
}

export const cloneConfig = clone;
