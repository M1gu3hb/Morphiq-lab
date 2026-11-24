// Puntos de partida para una carta nueva.
import { MORPHIQ_CARD } from '../default-card.js';
import { FRAME_STYLES } from '../engine/schema.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const W = FRAME_STYLES.window;

export const TEMPLATES = {
  morphiq: { label: 'Morphiq', desc: 'La carta de portada', make: () => clone(MORPHIQ_CARD) },
  window: {
    label: 'Ventana .exe', desc: 'El objeto se asoma por una ventana',
    make: () => ({
      name: 'morphiq.exe',
      card: { ratio: 0.8, radius: W.radius, winRadius: W.winRadius, inset: { ...W.inset } },
      assets: { mono: clone(MORPHIQ_CARD.assets.mono) },
      layers: [
        { type: 'fill', name: 'Fondo', fit: 'cover', depth: -0.8, kind: 'linear', angle: 60, a: '#2a0f5e', b: '#0b3fae' },
        { type: 'holo', name: 'Arcoíris', fit: 'cover', depth: -0.6, foil: { on: true, type: 'rainbow', amount: 0.45, scale: 1.2, sat: 1, tint: '#ffffff' } },
        { type: 'holo', name: 'Glitter', fit: 'cover', depth: -0.4, foil: { on: true, type: 'glitter', amount: 1.3, scale: 0.8, sat: 1, tint: '#ffffff' } },
        { type: 'fill', name: 'Halo', fit: 'free', x: 0, y: 0.02, w: 1.1, ar: 1, depth: -0.3, blend: 'add', kind: 'radial', a: '#fff3b0', aAlpha: 0.55, b: '#fff3b0', bAlpha: 0 },
        { type: 'relief', name: 'Objeto', asset: 'mono', x: 0, y: 0.03, w: 0.88, depth: -0.1, clip: 'auto', thickness: 0.22, bevel: 0.006, float: 0.2, follow: 0.5, shadow: { on: true, dist: 0.25, blur: 1, alpha: 0.5, dx: 0.02, dy: -0.03 } },
        { type: 'frame', name: 'Marco', style: 'window', color: W.color, accent: '#1e5bff', title: 'morphiq.exe', caption: 'arrastra para ver la profundidad', foil: { on: true, type: 'sheen', amount: 0.25, scale: 1, sat: 0.2, tint: '#ffffff' } },
      ],
    }),
  },
  blank: {
    label: 'En blanco', desc: 'Sólo fondo y marco',
    make: () => ({
      name: 'Sin título',
      layers: [
        { type: 'fill', name: 'Fondo', fit: 'cover', depth: -0.9, kind: 'radial', a: '#12306e', b: '#02040a' },
        { type: 'frame', name: 'Marco', style: 'metal' },
      ],
    }),
  },
};
