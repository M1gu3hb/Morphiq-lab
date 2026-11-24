// Contorno de una imagen con transparencia → polígonos (marching squares sobre el canal alfa).
// Sirve para convertir cualquier PNG/WebP con fondo transparente en una pieza con volumen.

const T = [0.5, 0], R = [1, 0.5], B = [0.5, 1], L = [0, 0.5];
const CORNER = { tl: [0, 0], tr: [1, 0], br: [1, 1], bl: [0, 1] };
const BIT = { tl: 1, tr: 2, br: 4, bl: 8 };
// Para cada caso: pares de aristas y la esquina que sirve de referencia para orientar el segmento.
const PAIRS = {
  1: [['L', 'T', 'tl']], 2: [['T', 'R', 'tr']], 3: [['L', 'R', 'tl']], 4: [['R', 'B', 'br']],
  5: [['L', 'T', 'tl'], ['R', 'B', 'br']], 6: [['T', 'B', 'tr']], 7: [['L', 'B', 'bl']],
  8: [['B', 'L', 'bl']], 9: [['T', 'B', 'tl']], 10: [['T', 'R', 'tr'], ['B', 'L', 'bl']],
  11: [['R', 'B', 'br']], 12: [['L', 'R', 'bl']], 13: [['T', 'R', 'tr']], 14: [['L', 'T', 'tl']],
};
const MID = { T, R, B, L };
// Tabla orientada: el interior siempre queda del mismo lado al recorrer el segmento.
const TABLE = (() => {
  const out = [];
  for (let c = 0; c < 16; c++) {
    out[c] = (PAIRS[c] || []).map(([e1, e2, ref]) => {
      const p1 = MID[e1], p2 = MID[e2], rc = CORNER[ref];
      const cross = (p2[0] - p1[0]) * (rc[1] - p1[1]) - (p2[1] - p1[1]) * (rc[0] - p1[0]);
      const inside = (c & BIT[ref]) !== 0;
      return (cross > 0) === inside ? [e1, e2] : [e2, e1];
    });
  }
  return out;
})();

function simplify(pts, eps) {
  // Douglas–Peucker sobre un anillo cerrado: se parte en dos mitades por el punto más lejano al primero.
  const n = pts.length;
  if (n < 8 || eps <= 0) return pts;
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) {
    const dx = pts[i][0] - pts[0][0], dy = pts[i][1] - pts[0][1], d = dx * dx + dy * dy;
    if (d > fd) { fd = d; far = i; }
  }
  const dp = (arr) => {
    const keep = new Uint8Array(arr.length); keep[0] = keep[arr.length - 1] = 1;
    const stack = [[0, arr.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const ax = arr[a][0], ay = arr[a][1], bx = arr[b][0], by = arr[b][1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      let mi = -1, md = eps;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((arr[i][0] - ax) * dy - (arr[i][1] - ay) * dx) / len;
        if (d > md) { md = d; mi = i; }
      }
      if (mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return arr.filter((_, i) => keep[i]);
  };
  const a = dp(pts.slice(0, far + 1)), b = dp(pts.slice(far).concat([pts[0]]));
  return a.slice(0, -1).concat(b.slice(0, -1));
}

const area = (p) => { let s = 0; for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const inside = (pt, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

/**
 * @returns {{ w:number, h:number, shapes: Array<{ outer:number[][], holes:number[][][], area:number }> }}
 * Coordenadas en píxeles de la imagen reducida (y hacia abajo). `shapes` va de mayor a menor.
 */
export function traceAlpha(img, { threshold = 0.5, detail = 0.6, maxSize = 480 } = {}) {
  const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height;
  const k = Math.min(1, maxSize / Math.max(iw, ih));
  const w = Math.max(2, Math.round(iw * k)), h = Math.max(2, Math.round(ih * k));
  const W = w + 2, H = h + 2; // margen transparente de 1 px para cerrar los contornos del borde
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 1, 1, w, h);
  const data = ctx.getImageData(0, 0, W, H).data;
  const A = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) A[i] = data[i * 4 + 3] / 255 - threshold;

  const next = new Map(), pos = new Map(), HX = 0, VY = W * H;
  const edge = (name, x, y) => {
    let id, px, py;
    if (name === 'T' || name === 'B') {
      const yy = name === 'T' ? y : y + 1; id = HX + yy * W + x;
      if (!pos.has(id)) { const a0 = A[yy * W + x], a1 = A[yy * W + x + 1]; px = x + a0 / (a0 - a1); py = yy; pos.set(id, [px - 1, py - 1]); }
    } else {
      const xx = name === 'L' ? x : x + 1; id = VY + y * W + xx;
      if (!pos.has(id)) { const a0 = A[y * W + xx], a1 = A[(y + 1) * W + xx]; px = xx; py = y + a0 / (a0 - a1); pos.set(id, [px - 1, py - 1]); }
    }
    return id;
  };
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const c = (A[y * W + x] > 0 ? 1 : 0) | (A[y * W + x + 1] > 0 ? 2 : 0) | (A[(y + 1) * W + x + 1] > 0 ? 4 : 0) | (A[(y + 1) * W + x] > 0 ? 8 : 0);
      if (c === 0 || c === 15) continue;
      for (const [e1, e2] of TABLE[c]) next.set(edge(e1, x, y), edge(e2, x, y));
    }
  }

  const loops = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const pts = [];
    let cur = start, guard = 0;
    while (cur !== undefined && !seen.has(cur) && guard++ < 1e6) { seen.add(cur); pts.push(pos.get(cur)); cur = next.get(cur); }
    if (cur !== start || pts.length < 3) continue;
    const s = simplify(pts, detail);
    const ar = area(s);
    if (s.length >= 3 && Math.abs(ar) > 6) loops.push({ pts: s, area: Math.abs(ar) });
  }

  // Anidado: profundidad par = sólido, impar = hueco del sólido más pequeño que lo contiene.
  loops.sort((a, b) => b.area - a.area);
  const shapes = [];
  loops.forEach((lp, i) => {
    const parents = [];
    for (let j = 0; j < i; j++) if (inside(lp.pts[0], loops[j].pts)) parents.push(loops[j]);
    lp.depth = parents.length;
    if (lp.depth % 2 === 0) { lp.shape = { outer: lp.pts, holes: [], area: lp.area }; shapes.push(lp.shape); }
    else { const owner = parents.filter((p) => p.shape).pop(); if (owner) owner.shape.holes.push(lp.pts); }
  });
  return { w, h, shapes };
}
