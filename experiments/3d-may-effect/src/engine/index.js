// MorphCard — motor de cartas con profundidad real.
// La carta es una ventana: las capas viven a distintas profundidades dentro (o delante) de ella,
// y al inclinarla se desplazan entre sí como en una caja de sombras. Uso:
//   const card = new MorphCard(elemento); await card.load(config);
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { STAGE_VS, STAGE_FS } from './shaders.js';
import { createLayer, layerClass } from './layers.js';
import { normalizeConfig, cloneConfig } from './schema.js';

export * from './schema.js';

const FOV = 26;
const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[last] = v; };

export class MorphCard {
  constructor(el, opts = {}) {
    this.el = el;
    this.opts = { interactive: true, offsetX: 0, offsetY: 0, fitScale: 1, maxPixelRatio: 2, ...opts };
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxPixelRatio));
    r.toneMapping = THREE.NeutralToneMapping;
    Object.assign(r.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none', outline: 'none' });
    el.appendChild(r.domElement);
    this.maxAniso = r.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
    this.card = new THREE.Group();
    this.scene.add(this.card);
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environmentRotation.set(-0.5, 2.2, 0); // en reposo la cara de los objetos refleja la zona oscura del entorno: color más limpio
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x05070d, 0.7);
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.scene.add(this.hemi, this.key);

    // Uniformes compartidos por todos los materiales (misma referencia → se actualizan una vez por cuadro).
    this.G = {
      uTime: { value: 0 }, uCardInv: { value: new THREE.Matrix4() }, uViewToCard: { value: new THREE.Matrix4() },
      uCamCard: { value: new THREE.Vector3(0, 0, 5) }, uLightCard: { value: new THREE.Vector3(0.3, 0.5, 1) },
      uWin: { value: new THREE.Vector4(0, 0, 0.5, 0.7) }, uWinR: { value: 0.03 },
      uCardHalf: { value: new THREE.Vector2(0.5, 0.7) }, uCardR: { value: 0.05 }, uTilt: { value: new THREE.Vector2() },
    };
    this.stageMat = new THREE.ShaderMaterial({
      uniforms: {
        uBg1: { value: new THREE.Color() }, uBg2: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uGlowAmt: { value: 0.5 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uSize: { value: new THREE.Vector2(0.3, 0.5) }, uAspect: { value: 1 },
      },
      vertexShader: STAGE_VS, fragmentShader: STAGE_FS, depthTest: false, depthWrite: false,
    });
    const stage = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.stageMat);
    stage.frustumCulled = false; stage.renderOrder = -1e4;
    this.scene.add(stage);

    this.layers = new Map();
    this._img = new Map(); this._tex = new Map(); this._tokens = new Map(); this._timers = new Map();
    this.cfg = normalizeConfig({});
    this.D = 5; this.win = { cx: 0, cy: 0, hw: 0.46, hh: 0.66 }; this.cardRect = { cx: 0, cy: 0, hw: 0.5, hh: 0.7 };
    this.tiltPad = 0.5; this.pxPerUnit = 600;
    this.tilt = { x: 0, y: 0 }; this.vel = { x: 0, y: 0 }; this.target = { x: 0, y: 0 };
    this.liftV = 0; this.lift = 0; this.time = 0; this.last = performance.now(); this.lastInput = -1e9;
    this.frozen = false; this.pressing = false; this.hovering = false; this.running = true;
    this.reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._bind();
    this.computeCard(); this.resize();
    this._raf = requestAnimationFrame((t) => this._frame(t));
  }

  // ---------- recursos ----------
  asset(id) { return (id && this.cfg.assets[id]) || null; }
  image(src) {
    if (!this._img.has(src)) {
      this._img.set(src, new Promise((res, rej) => {
        const im = new Image();
        if (!src.startsWith('data:') && !src.startsWith('blob:')) im.crossOrigin = 'anonymous';
        im.onload = () => res(im); im.onerror = () => rej(new Error('No se pudo cargar la imagen'));
        im.src = src;
      }));
    }
    return this._img.get(src);
  }
  async texture(src) {
    if (!this._tex.has(src)) {
      const t = new THREE.Texture(await this.image(src));
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.maxAniso; t.userData.shared = true; t.needsUpdate = true;
      this._tex.set(src, t);
    }
    return this._tex.get(src);
  }
  fonts(list) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([Promise.all(list.map((f) => document.fonts.load(f).catch(() => {}))), new Promise((r) => setTimeout(r, 2500))]);
  }
  onFirstGesture(fn) { window.addEventListener('pointerdown', fn, { once: true }); }

  // ---------- geometría de la carta ----------
  depthScale(z) { return (this.D - z) / this.D; } // compensa la perspectiva: en reposo todo se ve del tamaño diseñado
  computeCard() {
    const c = this.cfg.card, H = 1 / c.ratio, i = c.inset, G = this.G;
    this.cardRect = { cx: 0, cy: 0, hw: 0.5, hh: H / 2 };
    this.win = { cx: (i.l - i.r) / 2, cy: (i.b - i.t) / 2, hw: Math.max(0.02, (1 - i.l - i.r) / 2), hh: Math.max(0.02, (H - i.t - i.b) / 2) };
    G.uCardHalf.value.set(0.5, H / 2); G.uCardR.value = Math.min(c.radius, 0.5, H / 2);
    G.uWin.value.set(this.win.cx, this.win.cy, this.win.hw, this.win.hh);
    G.uWinR.value = Math.min(c.winRadius, this.win.hw, this.win.hh);
    this.tiltPad = Math.tan(rad(this.cfg.motion.maxTilt + 9)) * 1.12;
  }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    const cam = this.camera, st = this.cfg.stage, H = 1 / this.cfg.card.ratio, asp = w / h;
    this.renderer.setSize(w, h, false);
    const fit = st.fit * this.opts.fitScale; // fitScale: margen extra que pide la página (p. ej. el editor) sin tocar la carta
    const visH = Math.max(H / (fit * 0.94), 1 / (asp * fit)), tanH = Math.tan(rad(FOV / 2));
    this.D = visH / (2 * tanH);
    cam.aspect = asp; cam.position.set(0, 0, this.D); cam.far = this.D + 40;
    cam.setViewOffset(w, h, -this.opts.offsetX * w, this.opts.offsetY * h, w, h);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    this.pxPerUnit = this.renderer.domElement.height / (2 * tanH);
    this.unitsPerPx = visH / h;
    const u = this.stageMat.uniforms;
    u.uAspect.value = asp; u.uCenter.value.set(0.5 + this.opts.offsetX, 0.5 + this.opts.offsetY); u.uSize.value.set(1 / (visH * asp), H / visH);
    this.layers.forEach((L) => { try { L.apply(); } catch (e) { /* capa aún sin construir */ } });
  }
  applyStage() {
    const st = this.cfg.stage, li = this.cfg.light, u = this.stageMat.uniforms;
    u.uBg1.value.set(st.bg1); u.uBg2.value.set(st.bg2); u.uGlow.value.set(st.glow); u.uGlowAmt.value = st.glowAmt;
    this.lightDir = new THREE.Vector3(li.x, li.y, 1).normalize();
    this.key.position.copy(this.lightDir).multiplyScalar(10); this.key.intensity = 2.2 * li.intensity;
    this.hemi.intensity = 0.7 * li.intensity; this.scene.environmentIntensity = li.env;
  }

  // ---------- capas ----------
  async load(config) {
    const token = (this._load = (this._load || 0) + 1);
    this.ready = false;
    this.layers.forEach((L) => L.dispose()); this.layers.clear();
    this.cfg = normalizeConfig(config);
    this.computeCard(); this.applyStage(); this.resize();
    await Promise.all(this.cfg.layers.map((lc) => this._create(lc, token)));
    if (token !== this._load) return this;
    this.reorder(); this.ready = true;
    return this;
  }
  async _create(lc, token) {
    const L = createLayer(this, lc);
    try { await L.build(); L.apply(); } catch (err) { L.error = err; console.warn(`[MorphCard] capa «${lc.name}»:`, err.message || err); }
    if (token !== undefined && token !== this._load) { L.dispose(); return null; }
    const old = this.layers.get(lc.id);
    if (old) old.dispose();
    this.layers.set(lc.id, L); this.card.add(L.group); L.group.visible = lc.visible !== false;
    return L;
  }
  reorder() {
    const list = this.cfg.layers.map((c, i) => ({ c, i })).sort((a, b) => a.c.depth - b.c.depth || a.i - b.i);
    list.forEach(({ c }, n) => { const L = this.layers.get(c.id); if (L) L.setOrder(n * 2); });
  }
  /** Tras añadir, quitar o reordenar capas en `cfg.layers`. */
  async sync() {
    const ids = new Set(this.cfg.layers.map((l) => l.id));
    this.layers.forEach((L, id) => { if (!ids.has(id)) { L.dispose(); this.layers.delete(id); } });
    await Promise.all(this.cfg.layers.filter((l) => !this.layers.has(l.id)).map((l) => this._create(l)));
    this.reorder();
  }
  /** Cambia una propiedad de una capa (ruta con puntos: 'foil.amount'). Sólo reconstruye si hace falta. */
  patch(id, path, value) {
    const lc = this.cfg.layers.find((l) => l.id === id); if (!lc) return;
    if (getPath(lc, path) === value) return;
    setPath(lc, path, value);
    const L = this.layers.get(id);
    if (layerClass(lc.type).heavy.includes(path)) return this.rebuild(id, 90);
    if (!L) return;
    if (path === 'visible') L.group.visible = value !== false;
    try { L.apply(); } catch (e) { /* en construcción */ }
    if (path === 'depth') this.reorder();
  }
  rebuild(id, delay = 0) {
    clearTimeout(this._timers.get(id));
    return new Promise((res) => {
      this._timers.set(id, setTimeout(async () => {
        const lc = this.cfg.layers.find((l) => l.id === id); if (!lc) return res();
        const tk = (this._tokens.get(id) || 0) + 1; this._tokens.set(id, tk);
        const L = createLayer(this, lc);
        try { await L.build(); L.apply(); } catch (err) { L.error = err; console.warn(`[MorphCard] capa «${lc.name}»:`, err.message || err); }
        if (this._tokens.get(id) !== tk || !this.cfg.layers.includes(lc)) { L.dispose(); return res(); }
        const old = this.layers.get(id); if (old) old.dispose();
        this.layers.set(id, L); this.card.add(L.group); L.group.visible = lc.visible !== false;
        this.reorder(); res(L);
      }, delay));
    });
  }
  /** Tras cambiar forma, márgenes, escenario, luz o movimiento. */
  refresh() {
    this.computeCard(); this.applyStage(); this.resize();
    this.cfg.layers.forEach((l) => { if (layerClass(l.type).cardBound) this.rebuild(l.id, 120); });
  }

  /** Caja de una capa en unidades de carta (para seleccionarla y moverla en el editor). */
  layerBounds(id) {
    const L = this.layers.get(id), c = L && L.cfg;
    if (!L || c.fit === 'cover' || c.type === 'frame' || c.type === 'sparkles') return null;
    if (L.mesh) { const m = L.mesh, s = this.depthScale(m.position.z); return { x: m.position.x / s, y: m.position.y / s, w: m.scale.x / s, h: m.scale.y / s, rot: m.rotation.z }; }
    if (L.pivot) return { x: c.x, y: c.y, w: c.w, h: c.w / (L.ar || 1), rot: 0 };
    return null;
  }

  // ---------- interacción ----------
  _bind() {
    const el = this.el, on = (t, n, f, o) => { t.addEventListener(n, f, o); (this._off ||= []).push(() => t.removeEventListener(n, f, o)); };
    let drag = null;
    const norm = (e) => { const b = el.getBoundingClientRect(); return { x: clamp(((e.clientX - b.left) / b.width - 0.5 - this.opts.offsetX) * 2.2, -1, 1), y: clamp(((e.clientY - b.top) / b.height - 0.5 + this.opts.offsetY) * 2.2, -1, 1) }; };
    on(el, 'pointerdown', (e) => {
      if (!this.opts.interactive || this.frozen) return;
      this.pressing = true; this.lastInput = performance.now();
      if (e.pointerType !== 'mouse') { drag = { x: e.clientX, y: e.clientY, bx: this.target.x, by: this.target.y, id: e.pointerId }; try { el.setPointerCapture(e.pointerId); } catch (_) {} }
      else Object.assign(this.target, norm(e));
    });
    on(el, 'pointermove', (e) => {
      if (!this.opts.interactive || this.frozen) return;
      this.lastInput = performance.now();
      if (e.pointerType === 'mouse') { this.hovering = true; Object.assign(this.target, norm(e)); }
      else if (drag && drag.id === e.pointerId) {
        const k = Math.min(el.clientWidth, el.clientHeight) * 0.42;
        this.target.x = clamp(drag.bx + (e.clientX - drag.x) / k, -1.15, 1.15);
        this.target.y = clamp(drag.by + (e.clientY - drag.y) / k, -1.15, 1.15);
      }
    });
    const up = () => { this.pressing = false; drag = null; this.lastInput = performance.now(); };
    on(el, 'pointerup', up); on(el, 'pointercancel', up);
    on(el, 'pointerleave', (e) => { if (e.pointerType === 'mouse') { this.hovering = false; this.pressing = false; this.lastInput = performance.now() - 700; } });
    on(document, 'visibilitychange', () => { this.running = !document.hidden; this.last = performance.now(); });
    if (window.ResizeObserver) { this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(el); } else on(window, 'resize', () => this.resize());
  }
  /** Inclinación con el giroscopio del teléfono. En iOS debe llamarse desde un toque. */
  async enableGyro(onState) {
    const DO = window.DeviceOrientationEvent; if (!DO) return false;
    if (typeof DO.requestPermission === 'function') { try { if ((await DO.requestPermission()) !== 'granted') return false; } catch (_) { return false; } }
    const g = { b: null, c: null };
    this._gyro = (e) => {
      if (e.beta == null || e.gamma == null || this.frozen || this.pressing) return;
      if (g.b == null) { g.b = e.beta; g.c = e.gamma; }
      g.b += (e.beta - g.b) * 0.006; g.c += (e.gamma - g.c) * 0.006; // se recentra poco a poco a como sostienes el teléfono
      this.target.x = clamp((e.gamma - g.c) / 20, -1.1, 1.1); this.target.y = clamp((e.beta - g.b) / 20, -1.1, 1.1);
      this.lastInput = performance.now(); this.gyroLive = true; if (onState) onState(true);
    };
    window.addEventListener('deviceorientation', this._gyro);
    return true;
  }
  disableGyro() { if (this._gyro) window.removeEventListener('deviceorientation', this._gyro); this._gyro = null; this.gyroLive = false; }
  /** En el editor: carta de frente y quieta para poder acomodar capas. */
  setFrozen(v) { this.frozen = v; if (v) this.target.x = this.target.y = 0; this.lastInput = performance.now(); }

  // ---------- bucle ----------
  _frame(now) {
    this._raf = requestAnimationFrame((t) => this._frame(t));
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000)); this.last = now; this.time += dt;
    const m = this.cfg.motion, max = rad(m.maxTilt), G = this.G;
    let tx = this.target.x, ty = this.target.y;
    const idle = !this.frozen && !this.pressing && !this.hovering && now - this.lastInput > 1400 && m.idle > 0 && !this.reduce;
    if (idle) { const t = this.time * m.idleSpeed; tx = Math.sin(t * 0.7) * 0.62 * m.idle; ty = Math.sin(t * 0.53 + 1.3) * 0.42 * m.idle; this.target.x = tx; this.target.y = ty; }
    if (this.frozen) tx = ty = 0;
    const K = 90, C = 13; // resorte con un poco de rebote
    for (const [ax, tg] of [['y', tx * max], ['x', ty * max]]) {
      this.vel[ax] += (K * (tg - this.tilt[ax]) - C * this.vel[ax]) * dt;
      this.tilt[ax] += this.vel[ax] * dt;
    }
    this.liftV += (140 * ((this.pressing ? 1 : 0) - this.lift) - 16 * this.liftV) * dt; this.lift += this.liftV * dt;
    this.card.rotation.set(this.tilt.x, this.tilt.y, 0);
    this.card.scale.setScalar(1 + this.lift * 0.03 * m.lift);
    this.card.updateMatrixWorld(true);
    G.uTime.value = this.time;
    G.uCardInv.value.copy(this.card.matrixWorld).invert();
    G.uViewToCard.value.multiplyMatrices(G.uCardInv.value, this.camera.matrixWorld);
    G.uCamCard.value.copy(this.camera.position).applyMatrix4(G.uCardInv.value);
    if (this.lightDir) G.uLightCard.value.copy(this.lightDir).transformDirection(G.uCardInv.value);
    G.uTilt.value.set(this.tilt.y / (max || 1), this.tilt.x / (max || 1));
    this.layers.forEach((L) => L.update(dt, this.time));
    this.renderer.render(this.scene, this.camera);
    if (this.onFrame) this.onFrame(this);
  }

  // ---------- salida ----------
  /** Copia autónoma: recursos incrustados como data URL y textos/marco ya dibujados (no depende de tipografías). */
  async portable() {
    const out = cloneConfig(this.cfg);
    const used = new Set();
    out.layers.forEach((l) => { if (l.asset) used.add(l.asset); if (l.mask) used.add(l.mask); delete l.baked; });
    for (const id of Object.keys(out.assets)) {
      if (!used.has(id)) { delete out.assets[id]; continue; }
      const a = out.assets[id];
      if (!a.src.startsWith('data:')) {
        const blob = await (await fetch(a.src)).blob();
        a.src = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
      }
    }
    out.layers.forEach((l) => { const L = this.layers.get(l.id), b = L && L.bake(); if (b) l.baked = b; });
    return out;
  }
  /** Miniatura del cuadro actual. */
  snapshot(maxW = 480, type = 'image/webp', q = 0.86) {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement, k = Math.min(1, maxW / src.width);
    const c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL(type, q);
  }
  dispose() {
    cancelAnimationFrame(this._raf); (this._off || []).forEach((f) => f()); if (this._ro) this._ro.disconnect(); this.disableGyro();
    this.layers.forEach((L) => L.dispose()); this.layers.clear();
    this._tex.forEach((t) => t.dispose()); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
