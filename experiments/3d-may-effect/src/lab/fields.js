// Qué controles muestra el editor para cada tipo de capa. Todo el panel «Editar» se genera a partir de esto:
// para añadir un ajuste nuevo basta declararlo aquí (y que el motor lo lea).

const R = (k, label, min, max, step, extra = {}) => ({ k, t: 'range', label, min, max, step, ...extra });
const C = (k, label, extra = {}) => ({ k, t: 'color', label, ...extra });
const SEG = (k, label, options, extra = {}) => ({ k, t: 'seg', label, options, ...extra });
const SEL = (k, label, options, extra = {}) => ({ k, t: 'select', label, options, ...extra });
const free = (l) => l.fit !== 'cover';
const cover = (l) => l.fit === 'cover';

const DEPTH = R('depth', 'Profundidad', -1.5, 0.6, 0.005, { hint: 'Negativo: dentro de la carta. Positivo: se sale del marco.' });
const OPACITY = R('opacity', 'Opacidad', 0, 1, 0.01);
const BLEND = SEG('blend', 'Mezcla', [['normal', 'Normal'], ['add', 'Sumar'], ['screen', 'Trama'], ['multiply', 'Multiplicar']]);
const CLIP = SEG('clip', 'Recorte', [['window', 'Ventana'], ['card', 'Carta'], ['none', 'Libre']], { hint: 'Ventana: sólo se ve por el hueco del marco. Libre: puede salirse de la carta.' });
const CLIP3D = SEG('clip', 'Recorte', [['auto', 'Auto'], ['window', 'Ventana'], ['none', 'Libre']], { hint: 'Auto: lo que queda dentro se ve por la ventana y lo que sale del plano se libera.' });
const FIT = SEG('fit', 'Ajuste', [['cover', 'Cubrir'], ['free', 'Libre']]);

const PLACE = { title: 'Posición', fields: [
  R('x', 'X', -0.8, 0.8, 0.005), R('y', 'Y', -1, 1, 0.005),
  R('w', 'Tamaño', 0.03, 2, 0.005, { when: free }), R('zoom', 'Zoom', 0.5, 3, 0.01, { when: cover }),
  R('rot', 'Giro', -180, 180, 1, { when: free }), DEPTH,
] };
const LOOK = (clip = CLIP) => ({ title: 'Apariencia', fields: [OPACITY, BLEND, clip] });

const FOIL_TYPES = [['sheen', 'Brillo'], ['rainbow', 'Arcoíris'], ['lines', 'Líneas'], ['glitter', 'Glitter'], ['prism', 'Prisma']];
const FOIL_FIELDS = [
  SEL('foil.type', 'Tipo', FOIL_TYPES), R('foil.amount', 'Intensidad', 0, 2, 0.01), R('foil.scale', 'Escala', 0.2, 4, 0.01),
  R('foil.sat', 'Color', 0, 1, 0.01, { hint: '0 = monocromático (usa el tinte) · 1 = arcoíris completo' }), C('foil.tint', 'Tinte'),
];
const FOIL = { title: 'Efecto holo', toggle: 'foil.on', fields: FOIL_FIELDS };
const SHADOW = { title: 'Sombra', toggle: 'shadow.on', fields: [
  R('shadow.alpha', 'Intensidad', 0, 1, 0.01), R('shadow.dist', 'Distancia al fondo', 0, 0.6, 0.005),
  R('shadow.blur', 'Difuminado', 0.2, 1, 0.2), R('shadow.dx', 'Mover X', -0.1, 0.1, 0.002), R('shadow.dy', 'Mover Y', -0.1, 0.1, 0.002),
] };
const FILE = (k, label, accept, kind, extra = {}) => ({ k, t: 'file', label, accept, kind, ...extra });

export const FONTS = ['Michroma', 'Geist', 'JetBrains Mono', 'Bebas Neue', 'Archivo Black', 'Press Start 2P'];
export const ACCEPT = {
  image: 'image/png,image/webp,image/jpeg,image/svg+xml,image/avif',
  video: 'video/mp4,video/webm,video/quicktime',
  model: '.glb,.gltf,.obj,.fbx,.stl,.ply,model/gltf-binary',
};

export const FIELDS = {
  fill: [
    { title: 'Relleno', fields: [
      SEG('kind', 'Tipo', [['solid', 'Sólido'], ['linear', 'Lineal'], ['radial', 'Radial']]),
      C('a', 'Color A'), R('aAlpha', 'Opacidad A', 0, 1, 0.01),
      C('b', 'Color B', { when: (l) => l.kind !== 'solid' }), R('bAlpha', 'Opacidad B', 0, 1, 0.01, { when: (l) => l.kind !== 'solid' }),
      R('angle', 'Ángulo', 0, 360, 1, { when: (l) => l.kind === 'linear' }),
      R('cx', 'Centro X', -0.5, 0.5, 0.01, { when: (l) => l.kind === 'radial' }), R('cy', 'Centro Y', -0.5, 0.5, 0.01, { when: (l) => l.kind === 'radial' }),
      R('spread', 'Alcance', 0.1, 3, 0.01, { when: (l) => l.kind !== 'solid' }),
      FIT, R('ar', 'Proporción', 0.2, 6, 0.01, { when: free }), R('radius', 'Esquinas', 0, 0.5, 0.005),
      R('strokeW', 'Borde', 0, 0.03, 0.0005), C('stroke', 'Color del borde', { when: (l) => l.strokeW > 0 }), R('strokeAlpha', 'Opacidad del borde', 0, 1, 0.01, { when: (l) => l.strokeW > 0 }),
    ] }, PLACE, LOOK(),
  ],
  ascii: [
    { title: 'ASCII', fields: [
      R('cells', 'Columnas', 8, 80, 1), R('speed', 'Velocidad', 0, 4, 0.01), R('density', 'Densidad', 0.2, 2.5, 0.01), R('glow', 'Foco al inclinar', 0, 2, 0.01),
      C('c1', 'Tono bajo'), C('c2', 'Tono medio'), C('c3', 'Tono alto'), C('c4', 'Destello'), C('bg', 'Fondo'), R('bgAlpha', 'Opacidad del fondo', 0, 1, 0.01),
      { k: 'chars', t: 'text', label: 'Caracteres (de vacío a lleno)' }, FIT, R('ar', 'Proporción', 0.2, 6, 0.01, { when: free }),
    ] }, PLACE, LOOK(),
  ],
  image: [{ title: 'Imagen', fields: [FILE('asset', 'Cambiar imagen', ACCEPT.image, 'image'), FIT, C('tint', 'Tinte')] }, PLACE, LOOK(), FOIL, SHADOW],
  video: [{ title: 'Video', fields: [FILE('asset', 'Cambiar video', ACCEPT.video, 'video'), FIT, C('tint', 'Tinte')] }, PLACE, LOOK(), FOIL],
  text: [
    { title: 'Texto', fields: [
      { k: 'text', t: 'textarea', label: 'Contenido' }, SEL('font', 'Tipografía', FONTS.map((f) => [f, f])),
      SEG('weight', 'Peso', [[400, 'Normal'], [600, 'Medio'], [800, 'Grueso']], { when: (l) => l.font === 'Geist' || l.font === 'JetBrains Mono' }),
      R('size', 'Tamaño', 0.01, 0.4, 0.001), R('spacing', 'Espaciado', -0.05, 0.6, 0.005), SEG('align', 'Alineación', [['left', 'Izq.'], ['center', 'Centro'], ['right', 'Der.']]),
      SEL('style', 'Estilo', [['solid', 'Color sólido'], ['gradient', 'Degradado'], ['chrome', 'Cromo'], ['blue', 'Cromo azul'], ['gold', 'Oro']]),
      C('color', 'Color', { when: (l) => l.style === 'solid' || l.style === 'gradient' }), C('color2', 'Color inferior', { when: (l) => l.style === 'gradient' }),
      R('strokeW', 'Contorno', 0, 0.12, 0.002), C('stroke', 'Color del contorno', { when: (l) => l.strokeW > 0 }),
      R('glow', 'Resplandor', 0, 0.6, 0.005), C('glowColor', 'Color del resplandor', { when: (l) => l.glow > 0 }),
      { k: 'upper', t: 'toggle', label: 'Mayúsculas' },
    ] },
    { title: 'Posición', fields: [R('x', 'X', -0.8, 0.8, 0.005), R('y', 'Y', -1, 1, 0.005), R('rot', 'Giro', -180, 180, 1), DEPTH] }, LOOK(), FOIL, SHADOW,
  ],
  holo: [
    { title: 'Holo', fields: [...FOIL_FIELDS, FILE('mask', 'Máscara (imagen opcional)', ACCEPT.image, 'image', { clearable: true }), FIT, R('ar', 'Proporción', 0.2, 6, 0.01, { when: free })] },
    PLACE, { title: 'Apariencia', fields: [OPACITY, SEG('blend', 'Mezcla', [['add', 'Sumar'], ['screen', 'Trama']]), CLIP] },
  ],
  sparkles: [
    { title: 'Partículas', fields: [
      R('count', 'Cantidad', 10, 800, 1), R('size', 'Tamaño', 0.004, 0.08, 0.001), R('speed', 'Velocidad', 0, 3, 0.01), R('twinkle', 'Parpadeo', 0, 1, 0.01),
      C('color', 'Color A'), C('color2', 'Color B'), R('zNear', 'Hasta (profundidad)', -1.5, 0.6, 0.005), R('zFar', 'Desde (profundidad)', -1.5, 0.6, 0.005),
    ] }, { title: 'Apariencia', fields: [OPACITY, SEG('blend', 'Mezcla', [['add', 'Sumar'], ['screen', 'Trama']]), CLIP] },
  ],
  frame: [
    { title: 'Marco', fields: [
      C('color', 'Color base', { when: (l) => l.style !== 'image' && l.style !== 'none' }), C('accent', 'Acento', { when: (l) => ['metal', 'glass', 'window'].includes(l.style) }),
      { k: 'title', t: 'text', label: 'Título de la ventana', when: (l) => l.style === 'window' }, { k: 'caption', t: 'text', label: 'Barra de estado', when: (l) => l.style === 'window' },
      FILE('asset', 'Imagen del marco', ACCEPT.image, 'image', { when: (l) => l.style === 'image' }), { k: 'cut', t: 'toggle', label: 'Recortar la ventana en la imagen', when: (l) => l.style === 'image' },
      R('depth', 'Profundidad', -0.3, 0.3, 0.005), OPACITY,
    ], note: 'La forma, el estilo y los márgenes del marco están en la pestaña «Carta».' }, FOIL,
  ],
  model: [
    { title: 'Modelo 3D', fields: [
      FILE('asset', 'Cambiar modelo', ACCEPT.model, 'model'),
      SEL('material', 'Material', [['original', 'Original'], ['solid', 'Color sólido'], ['chrome', 'Cromo'], ['holo', 'Iridiscente'], ['matte', 'Mate'], ['wire', 'Malla']]),
      C('color', 'Color', { when: (l) => !['original', 'chrome'].includes(l.material) }),
      R('metal', 'Metal', 0, 1, 0.01, { when: (l) => !['original', 'matte'].includes(l.material) }), R('rough', 'Rugosidad', 0, 1, 0.01, { when: (l) => !['original', 'matte'].includes(l.material) }),
      R('env', 'Reflejos', 0, 3, 0.01),
    ] },
    { title: 'Posición', fields: [R('x', 'X', -0.8, 0.8, 0.005), R('y', 'Y', -1, 1, 0.005), R('w', 'Tamaño', 0.05, 2.5, 0.005), DEPTH, CLIP3D] },
    { title: 'Orientación y movimiento', fields: [
      R('rx', 'Girar X', -180, 180, 1), R('ry', 'Girar Y', -180, 180, 1), R('rz', 'Girar Z', -180, 180, 1),
      R('follow', 'Seguir la inclinación', 0, 2, 0.01, { hint: 'Cuánto gira de más el modelo al inclinar la carta.' }), R('spin', 'Giro continuo', -180, 180, 1), R('bob', 'Flotar', 0, 0.06, 0.001),
    ] },
  ],
  relief: [
    { title: 'Relieve 3D', fields: [
      FILE('asset', 'Cambiar imagen', ACCEPT.image, 'image'),
      R('thickness', 'Grosor', 0.005, 0.5, 0.005), R('bevel', 'Bisel', 0, 0.03, 0.0005), R('float', 'Piezas pequeñas flotan', 0, 0.6, 0.005),
      C('side', 'Color del canto'), R('metal', 'Metal', 0, 1, 0.01), R('rough', 'Rugosidad', 0, 1, 0.01), R('glow', 'Luz propia', 0, 1.5, 0.01),
      R('threshold', 'Umbral de recorte', 0.05, 0.95, 0.01), R('detail', 'Simplificar contorno', 0, 3, 0.05),
    ], note: 'Convierte una imagen con fondo transparente en una pieza con volumen.' },
    { title: 'Posición', fields: [R('x', 'X', -0.8, 0.8, 0.005), R('y', 'Y', -1, 1, 0.005), R('w', 'Tamaño', 0.05, 2.5, 0.005), DEPTH, CLIP3D] },
    { title: 'Orientación', fields: [R('rx', 'Girar X', -60, 60, 1), R('ry', 'Girar Y', -60, 60, 1), R('follow', 'Seguir la inclinación', 0, 2, 0.01)] }, SHADOW,
  ],
};

// Ajustes de la carta (pestaña «Carta»). Rutas relativas a la configuración completa.
export const CARD_FIELDS = [
  { title: 'Márgenes de la ventana', fields: [
    R('card.inset.t', 'Arriba', 0, 0.4, 0.005), R('card.inset.b', 'Abajo', 0, 0.4, 0.005), R('card.inset.l', 'Izquierda', 0, 0.3, 0.005), R('card.inset.r', 'Derecha', 0, 0.3, 0.005),
    R('card.radius', 'Esquinas de la carta', 0, 0.5, 0.005), R('card.winRadius', 'Esquinas de la ventana', 0, 0.5, 0.005),
  ] },
  { title: 'Escenario', fields: [C('stage.bg1', 'Fondo (centro)'), C('stage.bg2', 'Fondo (orilla)'), C('stage.glow', 'Halo'), R('stage.glowAmt', 'Intensidad del halo', 0, 1, 0.01), R('stage.fit', 'Tamaño de la carta', 0.4, 1, 0.01)] },
  { title: 'Movimiento', fields: [R('motion.maxTilt', 'Inclinación máxima', 4, 40, 1), R('motion.idle', 'Vaivén en reposo', 0, 1.5, 0.01), R('motion.idleSpeed', 'Velocidad del vaivén', 0.2, 3, 0.01), R('motion.lift', 'Levantar al tocar', 0, 3, 0.05)] },
  { title: 'Luz', fields: [R('light.x', 'Dirección X', -1.5, 1.5, 0.01), R('light.y', 'Dirección Y', -1.5, 1.5, 0.01), R('light.intensity', 'Intensidad', 0, 2.5, 0.01), R('light.env', 'Reflejos del entorno', 0, 3, 0.01)] },
];

export const TYPE_INFO = {
  image: { label: 'Imagen', desc: 'PNG, WebP o JPG', icon: 'image', file: 'image' },
  model: { label: 'Modelo 3D', desc: 'GLB, OBJ, FBX, STL, PLY', icon: 'cube', file: 'model' },
  relief: { label: 'Relieve 3D', desc: 'Tu logo PNG con volumen', icon: 'extrude', file: 'image' },
  text: { label: 'Texto', desc: 'Con cromo, oro o holo', icon: 'type' },
  video: { label: 'Video', desc: 'Loop de fondo', icon: 'video', file: 'video' },
  holo: { label: 'Holo', desc: 'Glitter, arcoíris, prisma', icon: 'sparkle' },
  sparkles: { label: 'Partículas', desc: 'Polvo con profundidad', icon: 'dots' },
  ascii: { label: 'ASCII', desc: 'Fondo animado', icon: 'ascii' },
  fill: { label: 'Relleno', desc: 'Color, degradado o panel', icon: 'square' },
  frame: { label: 'Marco', desc: 'Sólo uno por carta', icon: 'frame' },
};
