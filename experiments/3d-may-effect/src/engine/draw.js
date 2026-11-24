// Todo lo que se dibuja en canvas 2D y luego se usa como textura: marcos, texto, atlas ASCII y sombras.

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; };

function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const hex = (h) => { const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const shade = (h, k) => { // k<0 oscurece, k>0 aclara
  const [r, g, b] = hex(h), t = k < 0 ? 0 : 255, a = Math.abs(k);
  return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`;
};
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const FONT_FALLBACK = 'ui-monospace, Menlo, Consolas, monospace';

/** Marco de la carta con la ventana recortada. `card` = { ratio, radius, winRadius, inset }. */
export function drawFrame(cfg, card, img, px = 1024) {
  const W = px, H = Math.round(px / card.ratio), u = W;
  const cv = mk(W, H), g = cv.getContext('2d');
  const ins = card.inset, R = card.radius * u;
  const win = { x: ins.l * u, y: ins.t * u, w: W - (ins.l + ins.r) * u, h: H - (ins.t + ins.b) * u, r: card.winRadius * u };
  const accent = cfg.accent || '#1e5bff', base = cfg.color || '#1a2030';
  const style = cfg.style || 'metal';
  const cut = () => { g.save(); g.globalCompositeOperation = 'destination-out'; rr(g, win.x, win.y, win.w, win.h, win.r); g.fillStyle = '#000'; g.fill(); g.restore(); };

  if (style === 'none') return cv;

  if (style === 'image') {
    if (img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.max(W / iw, H / ih);
      g.save(); rr(g, 0, 0, W, H, R); g.clip();
      g.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k); g.restore();
    }
    if (cfg.cut) cut();
    return cv;
  }

  if (style === 'glass') {
    g.save(); rr(g, 0, 0, W, H, R); g.clip();
    const lg = g.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, rgba(base, 0.5)); lg.addColorStop(0.45, rgba(base, 0.12)); lg.addColorStop(1, rgba(base, 0.34));
    g.fillStyle = lg; g.fillRect(0, 0, W, H); g.restore();
    cut();
    g.lineWidth = Math.max(1.5, u * 0.0022);
    g.strokeStyle = rgba(base, 0.75); rr(g, g.lineWidth, g.lineWidth, W - g.lineWidth * 2, H - g.lineWidth * 2, R - g.lineWidth); g.stroke();
    g.strokeStyle = rgba(accent, 0.9); g.shadowColor = accent; g.shadowBlur = u * 0.012;
    rr(g, win.x, win.y, win.w, win.h, win.r); g.stroke();
    return cv;
  }

  if (style === 'window') {
    // Ventana de sistema clásica, dibujada a mano: barra de título, menú y barra de estado.
    const light = shade(base, 0.55), dark = shade(base, -0.45), darker = shade(base, -0.7);
    g.save(); rr(g, 0, 0, W, H, R); g.clip();
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const b = Math.max(2, u * 0.004);
    g.fillStyle = light; g.fillRect(0, 0, W, b); g.fillRect(0, 0, b, H);
    g.fillStyle = darker; g.fillRect(0, H - b, W, b); g.fillRect(W - b, 0, b, H);
    g.restore();
    const pad = u * 0.014, th = Math.min(ins.t * u * 0.5, u * 0.075);
    const tg = g.createLinearGradient(pad, 0, W - pad, 0);
    tg.addColorStop(0, shade(accent, -0.35)); tg.addColorStop(1, shade(accent, 0.25));
    g.fillStyle = tg; g.fillRect(pad, pad, W - pad * 2, th);
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = `700 ${Math.round(th * 0.5)}px "JetBrains Mono", ${FONT_FALLBACK}`;
    g.fillText(cfg.title || '', pad + th * 0.4, pad + th * 0.54);
    const bs = th * 0.72, by = pad + (th - bs) / 2;
    ['_', '□', '×'].forEach((ch, i) => {
      const bx = W - pad - (th - bs) / 2 - bs * (3 - i) - (2 - i) * bs * 0.14;
      g.fillStyle = i === 2 ? '#d83a3a' : base; g.fillRect(bx, by, bs, bs);
      g.fillStyle = light; g.fillRect(bx, by, bs, 2); g.fillRect(bx, by, 2, bs);
      g.fillStyle = darker; g.fillRect(bx, by + bs - 2, bs, 2); g.fillRect(bx + bs - 2, by, 2, bs);
      g.fillStyle = i === 2 ? '#fff' : '#10131a'; g.textAlign = 'center';
      g.font = `700 ${Math.round(bs * 0.7)}px "JetBrains Mono", ${FONT_FALLBACK}`;
      g.fillText(ch, bx + bs / 2, by + bs * (i === 0 ? 0.36 : 0.54));
    });
    const my = pad + th, mh = Math.max(0, win.y - my);
    g.fillStyle = shade(base, -0.72); g.textAlign = 'left';
    g.font = `500 ${Math.round(Math.min(mh * 0.46, u * 0.034))}px "JetBrains Mono", ${FONT_FALLBACK}`;
    ['Archivo', 'Editar', 'Ver', 'Ayuda'].reduce((x, t) => { g.fillText(t, x, my + mh * 0.5); return x + g.measureText(t).width + u * 0.034; }, pad + u * 0.012);
    // hundido alrededor de la ventana y barra de estado
    const s = Math.max(2, u * 0.0035);
    g.fillStyle = dark; g.fillRect(win.x - s, win.y - s, win.w + s * 2, s); g.fillRect(win.x - s, win.y - s, s, win.h + s * 2);
    g.fillStyle = light; g.fillRect(win.x - s, win.y + win.h, win.w + s * 2, s); g.fillRect(win.x + win.w, win.y - s, s, win.h + s * 2);
    const sy = win.y + win.h + s + u * 0.012, sh = H - sy - pad;
    if (sh > u * 0.02) {
      g.fillStyle = shade(base, -0.08); g.fillRect(pad, sy, W - pad * 2, sh);
      g.fillStyle = dark; g.fillRect(pad, sy, W - pad * 2, 2); g.fillRect(pad, sy, 2, sh);
      g.fillStyle = light; g.fillRect(pad, sy + sh - 2, W - pad * 2, 2);
      g.fillStyle = shade(base, -0.75); g.textAlign = 'left';
      g.font = `500 ${Math.round(sh * 0.5)}px "JetBrains Mono", ${FONT_FALLBACK}`;
      g.fillText(cfg.caption || '', pad + u * 0.016, sy + sh * 0.54);
    }
    cut();
    return cv;
  }

  // «metal»: bisel de acero cepillado con filo de color.
  g.save(); rr(g, 0, 0, W, H, R); g.clip();
  const lg = g.createLinearGradient(0, 0, W * 0.35, H);
  lg.addColorStop(0, shade(base, 0.34)); lg.addColorStop(0.16, shade(base, -0.1)); lg.addColorStop(0.5, shade(base, -0.55));
  lg.addColorStop(0.84, shade(base, -0.05)); lg.addColorStop(1, shade(base, 0.26));
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < H; y += 1) { const v = rnd(); g.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.09})` : `rgba(0,0,0,${(0.5 - v) * 0.16})`; g.fillRect(0, y, W, 1); }
  g.restore();
  cut();
  const hw = Math.max(1.5, u * 0.002);
  const og = g.createLinearGradient(0, 0, W, H);
  og.addColorStop(0, 'rgba(255,255,255,.7)'); og.addColorStop(0.4, 'rgba(255,255,255,.08)'); og.addColorStop(1, 'rgba(255,255,255,.35)');
  g.strokeStyle = og; g.lineWidth = hw; rr(g, hw, hw, W - hw * 2, H - hw * 2, R - hw); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineWidth = u * 0.006; rr(g, win.x - u * 0.004, win.y - u * 0.004, win.w + u * 0.008, win.h + u * 0.008, win.r + u * 0.004); g.stroke();
  g.save(); g.shadowColor = accent; g.shadowBlur = u * 0.014; g.strokeStyle = accent; g.lineWidth = u * 0.0032;
  rr(g, win.x, win.y, win.w, win.h, win.r); g.stroke(); g.stroke(); g.restore();
  g.strokeStyle = rgba('#ffffff', 0.55); g.lineWidth = Math.max(1, u * 0.001); rr(g, win.x, win.y, win.w, win.h, win.r); g.stroke();
  return cv;
}

const TEXT_STYLES = {
  chrome: ['#ffffff', '#c9d2e3', '#6f7a90', '#eef2f8', '#9aa6ba'],
  blue: ['#bfe1ff', '#2f8bff', '#0b2f9e', '#3d9bff', '#0f3fc4'],
  gold: ['#fff6cf', '#f1c651', '#8a5a0c', '#ffe58a', '#b98016'],
};

/** Texto a canvas. Devuelve el canvas y cuánto mide en «em» para poder escalarlo en la carta. */
export function drawText(cfg) {
  const raw = String(cfg.text ?? '');
  const lines = (cfg.upper ? raw.toUpperCase() : raw).split('\n');
  const family = `"${cfg.font}", "Geist", system-ui, sans-serif`;
  const probe = mk(4, 4).getContext('2d');
  let fpx = 150;
  const measure = (px) => {
    probe.font = `${cfg.weight || 400} ${px}px ${family}`;
    return lines.map((ln) => { const ch = [...ln]; const ws = ch.map((c) => probe.measureText(c).width); return { ch, ws, w: ws.reduce((a, b) => a + b, 0) + Math.max(0, ch.length - 1) * cfg.spacing * px }; });
  };
  let m = measure(fpx);
  const widest = Math.max(1, ...m.map((l) => l.w));
  if (widest > 1800) { fpx = Math.max(24, Math.floor(fpx * 1800 / widest)); m = measure(fpx); }
  const maxW = Math.max(1, ...m.map((l) => l.w));
  const lh = fpx * 1.22, pad = Math.ceil(fpx * (0.3 + (cfg.glow || 0) * 0.9 + (cfg.strokeW || 0)));
  const cv = mk(maxW + pad * 2, lh * lines.length + pad * 2), g = cv.getContext('2d');
  g.font = `${cfg.weight || 400} ${fpx}px ${family}`; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const stops = TEXT_STYLES[cfg.style];
  const paint = (mode) => {
    m.forEach((ln, i) => {
      const y0 = pad + lh * i, base = y0 + fpx * 0.92;
      let x = pad + (cfg.align === 'left' ? 0 : cfg.align === 'right' ? maxW - ln.w : (maxW - ln.w) / 2);
      if (mode === 'fill') {
        if (stops) { const gr = g.createLinearGradient(0, y0 + fpx * 0.12, 0, y0 + fpx * 1.02); stops.forEach((c, k) => gr.addColorStop(k / (stops.length - 1), c)); g.fillStyle = gr; }
        else if (cfg.style === 'gradient') { const gr = g.createLinearGradient(0, y0 + fpx * 0.15, 0, y0 + fpx); gr.addColorStop(0, cfg.color); gr.addColorStop(1, cfg.color2); g.fillStyle = gr; }
        else g.fillStyle = cfg.color;
      }
      ln.ch.forEach((c, k) => { if (mode === 'fill') g.fillText(c, x, base); else g.strokeText(c, x, base); x += ln.ws[k] + cfg.spacing * fpx; });
    });
  };
  if (cfg.glow > 0) { g.save(); g.shadowColor = cfg.glowColor; g.shadowBlur = cfg.glow * fpx * 0.6; g.fillStyle = cfg.glowColor; paint('fill'); paint('fill'); g.restore(); g.fillStyle = '#000'; }
  if (cfg.strokeW > 0) { g.strokeStyle = cfg.stroke; g.lineWidth = cfg.strokeW * fpx * 2; paint('stroke'); }
  paint('fill');
  return { canvas: cv, em: fpx, padEm: pad / fpx, wEm: cv.width / fpx, hEm: cv.height / fpx, textEm: maxW / fpx };
}

/** Atlas de glifos: una fila, celdas de proporción 1:1.55 (ancho:alto), blanco sobre transparente. */
export function drawAtlas(ramp, bits) {
  const glyphs = [...ramp, ...bits], cw = 40, ch = 62;
  const cv = mk(cw * glyphs.length, ch), g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${Math.round(ch * 0.8)}px "JetBrains Mono", ${FONT_FALLBACK}`;
  glyphs.forEach((c, i) => { g.save(); g.beginPath(); g.rect(i * cw + 1, 0, cw - 2, ch); g.clip(); g.fillText(c, i * cw + cw / 2, ch * 0.54); g.restore(); });
  return { canvas: cv, total: glyphs.length, rampN: [...ramp].length };
}

/** Silueta difuminada de una imagen o canvas (para sombras): se reduce a la mitad varias veces y se vuelve a ampliar. */
export function drawShadow(src, blur = 0.5) {
  const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
  const padK = 0.4, W = 256, H = Math.max(8, Math.round((W * sh) / sw)), px = Math.round(W * padK);
  let cur = mk(W + px * 2, H + px * 2);
  cur.getContext('2d').drawImage(src, px, px, W, H);
  const full = { w: cur.width, h: cur.height }, steps = Math.max(1, Math.round(blur * 5));
  const pass = (from, w, h) => { const c = mk(w, h), g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(from, 0, 0, w, h); return c; };
  for (let i = 0; i < steps; i++) cur = pass(cur, Math.max(4, cur.width / 2), Math.max(4, cur.height / 2));
  for (let i = 0; i < steps; i++) cur = pass(cur, Math.min(full.w, cur.width * 2), Math.min(full.h, cur.height * 2));
  if (cur.width !== full.w) cur = pass(cur, full.w, full.h);
  return { canvas: cur, scale: full.w / W, hScale: full.h / H };
}
