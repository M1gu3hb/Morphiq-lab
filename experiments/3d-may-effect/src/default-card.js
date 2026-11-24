// Carta de portada: fondo ASCII azul/negro, el monograma MH con volumen saliendo del marco
// y el nombre completo de la marca. Es el punto de partida del laboratorio.
const A = '/3d-may-effect/assets/';

export const MORPHIQ_CARD = {
  v: 1,
  name: 'Astral Morphiq Systems',
  card: { ratio: 0.716, radius: 0.05, winRadius: 0.03, inset: { t: 0.035, r: 0.035, b: 0.035, l: 0.035 } },
  stage: { bg1: '#07102a', bg2: '#03050b', glow: '#1e5bff', glowAmt: 0.14, fit: 0.84 },
  motion: { maxTilt: 22, idle: 1, idleSpeed: 1, lift: 1 },
  light: { x: 0.55, y: 0.85, intensity: 0.55, env: 0.9 },
  assets: {
    mono: { name: 'mh-monogram.webp', type: 'image/webp', src: A + 'mh-monogram.webp' },
    word: { name: 'morphiq-wordmark.webp', type: 'image/webp', src: A + 'morphiq-wordmark.webp' },
    sub: { name: 'morphiq-subtitle.webp', type: 'image/webp', src: A + 'morphiq-subtitle.webp' },
  },
  layers: [
    { id: 'bg', type: 'fill', name: 'Fondo', fit: 'cover', depth: -0.9, kind: 'radial', a: '#0a2360', b: '#01030a', cy: 0.12, spread: 1.4 },
    { id: 'ascii', type: 'ascii', name: 'ASCII', fit: 'cover', depth: -0.5, cells: 26, density: 1.2, bgAlpha: 0, glow: 0.7 },
    { id: 'dust', type: 'sparkles', name: 'Partículas', count: 90, size: 0.022, zNear: 0.04, zFar: -0.5, speed: 0.35 },
    { id: 'aura', type: 'fill', name: 'Aura', fit: 'free', x: 0, y: 0.19, w: 1.15, ar: 1, depth: -0.28, blend: 'add', kind: 'radial', a: '#2b7bff', aAlpha: 0.4, b: '#2b7bff', bAlpha: 0 },
    { id: 'glitter', type: 'holo', name: 'Glitter', fit: 'cover', depth: -0.2, foil: { on: true, type: 'glitter', amount: 0.9, scale: 1, sat: 0.85, tint: '#ffffff' } },
    { id: 'scrim', type: 'fill', name: 'Sombra inferior', fit: 'free', x: 0, y: -0.42, w: 1.3, ar: 2.1, depth: -0.06, kind: 'linear', angle: 90, a: '#01030a', aAlpha: 0.9, b: '#01030a', bAlpha: 0 },
    { id: 'logo', type: 'relief', name: 'Logo MH 3D', asset: 'mono', x: 0, y: 0.19, w: 0.9, depth: 0.015, clip: 'auto', thickness: 0.1, bevel: 0.005, side: '#0a2a78', metal: 0.55, rough: 0.4, glow: 0.5, float: 0.16, follow: 0.2, shadow: { on: true, dist: 0.16, blur: 1, alpha: 0.45, dx: 0.02, dy: -0.03 } },
    { id: 'frame', type: 'frame', name: 'Marco', style: 'metal', depth: 0, color: '#1a2030', accent: '#1e5bff', foil: { on: true, type: 'sheen', amount: 0.3, scale: 1, sat: 0.25, tint: '#ffffff' } },
    { id: 'word', type: 'image', name: 'MorpHiq', asset: 'word', x: 0, y: -0.385, w: 0.8, depth: 0.06, clip: 'none', shadow: { on: true, dist: 0.1, blur: 0.7, alpha: 0.45, dx: 0.01, dy: -0.016 } },
    { id: 'sub', type: 'image', name: 'Astral Morphiq Systems', asset: 'sub', x: 0, y: -0.53, w: 0.7, depth: 0.03, clip: 'card' },
    { id: 'tag', type: 'text', name: 'Lema', text: 'DIGITAL BUILDER  •  WEB DESIGN', font: 'JetBrains Mono', weight: 500, size: 0.02, spacing: 0.22, x: 0, y: -0.6, depth: 0.02, color: '#8fb4ff', clip: 'card' },
    { id: 'shine', type: 'holo', name: 'Brillo', fit: 'cover', clip: 'card', depth: 0.012, foil: { on: true, type: 'sheen', amount: 0.22, scale: 1, sat: 0.35, tint: '#ffffff' } },
  ],
};
