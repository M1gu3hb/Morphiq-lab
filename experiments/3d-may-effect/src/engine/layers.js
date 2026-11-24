import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PLANE_VS, PLANE_FS, POINTS_VS, POINTS_FS, patchPortal } from './shaders.js';
import { drawFrame, drawText, drawAtlas, drawShadow } from './draw.js';
import { traceAlpha } from './trace.js';

const rad = (d) => (d * Math.PI) / 180;
const CLIP = { none: 0, window: 1, card: 2, auto: 3 };
const FOIL = { sheen: 0, rainbow: 1, lines: 2, glitter: 3, prism: 4 };
const PLANE = new THREE.PlaneGeometry(1, 1);
const BITS = '01<>/\\|[]{}$#%&?!';

function setBlend(mat, mode) {
  mat.uniforms.uBlend.value = mode === 'normal' ? 0 : mode === 'multiply' ? 2 : 1;
  if (mode === 'normal') { mat.blending = THREE.NormalBlending; return; }
  mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = mode === 'multiply' ? THREE.DstColorFactor : THREE.OneFactor;
  mat.blendDst = mode === 'add' ? THREE.OneFactor : mode === 'screen' ? THREE.OneMinusSrcColorFactor : THREE.ZeroFactor;
  mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
}

function planeMaterial(e, defines, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...e.G,
      uOpacity: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uClip: { value: 1 }, uBlend: { value: 0 },
      uFoilAmt: { value: 0 }, uFoilType: { value: 0 }, uFoilScale: { value: 1 }, uFoilSat: { value: 1 },
      uFoilTint: { value: new THREE.Color(1, 1, 1) }, ...extra,
    },
    defines, vertexShader: PLANE_VS, fragmentShader: PLANE_FS,
    transparent: true, depthWrite: false, depthTest: true,
  });
}

class Layer {
  static heavy = [];
  constructor(engine, cfg) { this.e = engine; this.cfg = cfg; this.group = new THREE.Group(); this.meshes = []; }
  async build() {}
  apply() {}
  update() {}
  bake() { return null; }
  setOrder(n) { this.group.traverse((o) => { if (o.isMesh || o.isPoints) o.renderOrder = n + (o.userData.orderOffset || 0); }); }
  dispose() {
    this.group.traverse((o) => {
      if (o.geometry && o.geometry !== PLANE) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => {
        const tex = [...Object.values(m), ...Object.values(m.uniforms || {}).map((u) => u && u.value)];
        tex.forEach((t) => { if (t && t.isTexture && !t.userData.shared) t.dispose(); });
        m.dispose();
      });
    });
    if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); }
    this.group.removeFromParent();
  }
}

// ---------- Capas planas ----------
class PlaneLayer extends Layer {
  aspect() { return null; }
  commonUniforms(mat = this.mat) {
    const c = this.cfg, u = mat.uniforms;
    u.uOpacity.value = c.opacity; u.uClip.value = CLIP[c.clip] ?? 1;
    setBlend(mat, c.blend);
    const f = c.foil;
    u.uFoilAmt.value = f && f.on ? f.amount : 0;
    if (f) { u.uFoilType.value = FOIL[f.type] ?? 0; u.uFoilScale.value = f.scale; u.uFoilSat.value = f.sat; u.uFoilTint.value.set(f.tint); }
  }
  /** Coloca el plano. Con «cubrir» llena la ventana (o la carta) y deja margen para que no se vea el borde al inclinar. */
  layout(mesh = this.mesh, aspect = this.aspect(), dz = 0) {
    const e = this.e, c = this.cfg, z = c.depth + dz, s = e.depthScale(z);
    if (c.fit === 'cover') {
      const reg = c.clip === 'window' ? e.win : e.cardRect, pad = Math.abs(z) * e.tiltPad;
      let hw = reg.hw * s + pad, hh = reg.hh * s + pad;
      if (aspect) { if (aspect > hw / hh) hw = hh * aspect; else hh = hw / aspect; }
      const zoom = c.zoom || 1;
      mesh.position.set((reg.cx + c.x) * s, (reg.cy + c.y) * s, z);
      mesh.scale.set(hw * 2 * zoom, hh * 2 * zoom, 1);
    } else {
      const w = c.w * s;
      mesh.position.set(c.x * s, c.y * s, z);
      mesh.scale.set(w, w / (aspect || c.ar || 1), 1);
    }
    mesh.rotation.z = rad(c.rot || 0);
    return mesh;
  }
}

class FillLayer extends PlaneLayer {
  async build() {
    this.mat = planeMaterial(this.e, { SRC_FILL: 1 }, {
      uA: { value: new THREE.Vector4() }, uB: { value: new THREE.Vector4() }, uKind: { value: 2 },
      uDir: { value: new THREE.Vector2(0, 1) }, uCenter: { value: new THREE.Vector2() }, uSpread: { value: 1 },
      uAspect: { value: 1 }, uRadius: { value: 0 }, uStroke: { value: new THREE.Vector4(1, 1, 1, 0) }, uStrokeW: { value: 0 },
    });
    this.mesh = new THREE.Mesh(PLANE, this.mat); this.group.add(this.mesh);
  }
  apply() {
    const c = this.cfg, u = this.mat.uniforms, col = new THREE.Color();
    this.commonUniforms(); this.layout();
    col.set(c.a); u.uA.value.set(col.r, col.g, col.b, c.aAlpha);
    col.set(c.b); u.uB.value.set(col.r, col.g, col.b, c.bAlpha);
    col.set(c.stroke); u.uStroke.value.set(col.r, col.g, col.b, c.strokeAlpha);
    u.uKind.value = { solid: 0, linear: 1, radial: 2 }[c.kind] ?? 0;
    u.uDir.value.set(Math.cos(rad(c.angle)), Math.sin(rad(c.angle)));
    u.uCenter.value.set(c.cx, c.cy); u.uSpread.value = c.spread; u.uRadius.value = c.radius;
    u.uAspect.value = this.mesh.scale.x / this.mesh.scale.y;
    u.uStrokeW.value = c.strokeW / this.mesh.scale.y;
  }
}

class AsciiLayer extends PlaneLayer {
  static heavy = ['chars'];
  async build() {
    await this.e.fonts(['600 48px "JetBrains Mono"']);
    const at = drawAtlas(this.cfg.chars || ' .:-=+*#%@', BITS);
    const tex = new THREE.CanvasTexture(at.canvas); tex.anisotropy = this.e.maxAniso;
    this.mat = planeMaterial(this.e, { SRC_ASCII: 1 }, {
      uAtlas: { value: tex }, uGlyphs: { value: at.total }, uRampN: { value: at.rampN }, uCols: { value: 34 }, uAspect: { value: 1 },
      uSpeed: { value: 1 }, uDensity: { value: 1 }, uGlow: { value: 0.6 },
      uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() }, uC4: { value: new THREE.Color() },
      uBg: { value: new THREE.Vector4() },
    });
    this.mesh = new THREE.Mesh(PLANE, this.mat); this.group.add(this.mesh);
  }
  apply() {
    const c = this.cfg, u = this.mat.uniforms, col = new THREE.Color();
    this.commonUniforms(); this.layout();
    u.uCols.value = Math.max(4, Math.round(c.cells * this.mesh.scale.x));
    u.uAspect.value = this.mesh.scale.x / this.mesh.scale.y;
    u.uSpeed.value = c.speed; u.uDensity.value = c.density; u.uGlow.value = c.glow;
    u.uC1.value.set(c.c1); u.uC2.value.set(c.c2); u.uC3.value.set(c.c3); u.uC4.value.set(c.c4);
    col.set(c.bg); u.uBg.value.set(col.r, col.g, col.b, c.bgAlpha);
  }
}

class HoloLayer extends PlaneLayer {
  static heavy = ['mask'];
  async build() {
    const a = this.e.asset(this.cfg.mask);
    const defines = { SRC_HOLO: 1 }, extra = {};
    if (a) { defines.USE_MASK = 1; extra.uMask = { value: await this.e.texture(a.src) }; }
    this.mat = planeMaterial(this.e, defines, extra);
    this.mesh = new THREE.Mesh(PLANE, this.mat); this.group.add(this.mesh);
  }
  apply() {
    this.commonUniforms(); this.layout();
    if (this.cfg.blend === 'normal' || this.cfg.blend === 'multiply') setBlend(this.mat, 'add'); // un holo siempre suma luz
  }
}

/** Base de las capas con textura (imagen, video, texto, marco): añade sombra proyectada opcional. */
class TexLayer extends PlaneLayer {
  aspect() { return this.ar || 1; }
  makeMesh(tex, defines = {}) {
    this.mat = planeMaterial(this.e, { SRC_TEX: 1, ...defines }, { uMap: { value: tex } });
    this.mesh = new THREE.Mesh(PLANE, this.mat); this.group.add(this.mesh);
  }
  makeShadow(src) {
    if (!this.cfg.shadow || !this.cfg.shadow.on || !src) return;
    const sh = drawShadow(src, this.cfg.shadow.blur);
    const tex = new THREE.CanvasTexture(sh.canvas);
    this.shMat = planeMaterial(this.e, { SRC_TEX: 1, ALPHA_ONLY: 1 }, { uMap: { value: tex } });
    this.shMesh = new THREE.Mesh(PLANE, this.shMat); this.shMesh.userData.orderOffset = -0.5; this.shInfo = sh;
    this.group.add(this.shMesh);
  }
  applyShadow(base = this.mesh) {
    if (!this.shMesh) return;
    const c = this.cfg, sh = c.shadow, e = this.e, z = c.depth - sh.dist, k = e.depthScale(z) / e.depthScale(c.depth);
    const u = this.shMat.uniforms;
    u.uOpacity.value = sh.alpha * c.opacity; u.uClip.value = c.clip === 'window' ? 1 : 2; u.uTint.value.set(0, 0, 0);
    setBlend(this.shMat, 'normal');
    this.shMesh.position.set((base.position.x + sh.dx) * k, (base.position.y + sh.dy) * k, z);
    this.shMesh.scale.set(base.scale.x * this.shInfo.scale * k, base.scale.y * this.shInfo.hScale * k, 1);
    this.shMesh.rotation.z = base.rotation.z;
  }
  apply() {
    if (!this.mat) return;
    this.commonUniforms(); this.layout();
    this.mat.uniforms.uTint.value.set(this.cfg.tint || '#ffffff');
    this.applyShadow();
  }
}

class ImageLayer extends TexLayer {
  static heavy = ['asset', 'shadow.on', 'shadow.blur'];
  async build() {
    const a = this.e.asset(this.cfg.asset); if (!a) return;
    const img = await this.e.image(a.src);
    this.ar = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    this.makeShadow(img); this.makeMesh(await this.e.texture(a.src));
  }
}

class VideoLayer extends TexLayer {
  static heavy = ['asset'];
  async build() {
    const a = this.e.asset(this.cfg.asset); if (!a) return;
    const v = document.createElement('video');
    Object.assign(v, { src: a.src, loop: true, muted: true, playsInline: true, crossOrigin: 'anonymous', preload: 'auto' });
    v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    await new Promise((res) => { v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', res, { once: true }); setTimeout(res, 8000); });
    this.video = v; this.ar = (v.videoWidth || 16) / (v.videoHeight || 9);
    v.play().catch(() => this.e.onFirstGesture(() => v.play().catch(() => {})));
    const tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.NoColorSpace;
    this.makeMesh(tex, { VIDEO_SRGB: 1 });
  }
}

class TextLayer extends TexLayer {
  static heavy = ['text', 'font', 'weight', 'spacing', 'align', 'style', 'color', 'color2', 'stroke', 'strokeW', 'glow', 'glowColor', 'upper', 'shadow.on', 'shadow.blur', 'baked'];
  async build() {
    const c = this.cfg;
    if (c.baked) { // versión portátil: el texto ya viene dibujado y no depende de la tipografía
      const img = await this.e.image(c.baked.src);
      this.info = c.baked; this.canvas = img; this.makeShadow(img); this.makeMesh(await this.e.texture(c.baked.src));
    } else {
      await this.e.fonts([`${c.weight || 400} 48px "${c.font}"`]);
      const t = drawText(c); this.info = t; this.canvas = t.canvas;
      const tex = new THREE.CanvasTexture(t.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = this.e.maxAniso;
      this.makeShadow(t.canvas); this.makeMesh(tex);
    }
    this.ar = this.info.wEm / this.info.hEm;
  }
  layout() {
    const e = this.e, c = this.cfg, i = this.info, s = e.depthScale(c.depth), w = i.wEm * c.size * s;
    const off = c.align === 'left' ? i.textEm / 2 : c.align === 'right' ? -i.textEm / 2 : 0; // el ancla es el borde del texto, no el del lienzo
    const a = rad(c.rot || 0), ox = off * c.size * s;
    this.mesh.position.set(c.x * s + ox * Math.cos(a), c.y * s + ox * Math.sin(a), c.depth);
    this.mesh.scale.set(w, w / this.ar, 1); this.mesh.rotation.z = a;
  }
  bake() {
    if (this.cfg.baked || !this.info) return null;
    const { wEm, hEm, textEm } = this.info;
    return { src: this.canvas.toDataURL('image/png'), wEm, hEm, textEm };
  }
}

class FrameLayer extends TexLayer {
  static heavy = ['style', 'color', 'accent', 'title', 'caption', 'asset', 'cut', 'baked'];
  static cardBound = true; // se redibuja cuando cambian la forma o los márgenes de la carta
  async build() {
    const c = this.cfg, e = this.e;
    if (c.baked) { this.canvas = null; this.makeMesh(await e.texture(c.baked.src)); return; }
    await e.fonts(['700 24px "JetBrains Mono"']);
    const a = e.asset(c.asset), img = c.style === 'image' && a ? await e.image(a.src) : null;
    this.canvas = drawFrame(c, e.cfg.card, img);
    const tex = new THREE.CanvasTexture(this.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = e.maxAniso;
    this.makeMesh(tex);
  }
  layout() {
    const r = this.e.cardRect, z = this.cfg.depth, s = this.e.depthScale(z);
    this.mesh.position.set(0, 0, z); this.mesh.scale.set(r.hw * 2 * s, r.hh * 2 * s, 1); this.mesh.rotation.z = 0;
  }
  bake() { return this.canvas ? { src: this.canvas.toDataURL('image/png') } : null; }
}

// ---------- Partículas con profundidad ----------
class SparklesLayer extends Layer {
  static heavy = ['count'];
  async build() {
    const n = Math.max(1, Math.min(1500, Math.round(this.cfg.count)));
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    let s = 1234567; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { pos.set([rnd() * 2 - 1, rnd() * 2 - 1, rnd()], i * 3); seed.set([rnd(), rnd(), rnd(), rnd()], i * 4); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        ...this.e.G, uOpacity: { value: 1 }, uSize: { value: 0.02 }, uSpeed: { value: 0.3 }, uPx: { value: 600 }, uTwinkle: { value: 0.7 },
        uBox: { value: new THREE.Vector4() }, uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uClip: { value: 1 },
      },
      vertexShader: POINTS_VS, fragmentShader: POINTS_FS, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.group.add(this.points);
  }
  apply() {
    const c = this.cfg, e = this.e, u = this.mat.uniforms, reg = c.clip === 'window' ? e.win : e.cardRect;
    const far = Math.min(c.zNear, c.zFar), near = Math.max(c.zNear, c.zFar), sFar = e.depthScale(far);
    const hw = reg.hw * sFar + Math.abs(far) * e.tiltPad, hh = reg.hh * sFar + Math.abs(far) * e.tiltPad;
    // las posiciones van en [-1,1]×[-1,1]×[0,1]: la escala del objeto las lleva a la caja real
    this.points.position.set(reg.cx, reg.cy, far); this.points.scale.set(hw, hh, near - far || 1e-3);
    u.uBox.value.set(0, 0, 0, 1);
    u.uOpacity.value = c.opacity; u.uSize.value = c.size; u.uSpeed.value = c.speed / hh; u.uTwinkle.value = c.twinkle;
    u.uPx.value = e.pxPerUnit; u.uColA.value.set(c.color); u.uColB.value.set(c.color2); u.uClip.value = CLIP[c.clip] ?? 1;
    this.mat.blendDst = c.blend === 'screen' ? THREE.OneMinusSrcColorFactor : THREE.OneFactor;
  }
}

// ---------- Objetos con volumen ----------
class SolidLayer extends Layer {
  constructor(e, cfg) { super(e, cfg); this.pivot = new THREE.Group(); this.group.add(this.pivot); this.clipU = { value: 3 }; this.spin = 0; }
  patch(mat) { patchPortal(mat, this.e.G, this.clipU); return mat; }
  place() {
    const c = this.cfg, e = this.e, s = e.depthScale(c.depth);
    this.base = new THREE.Vector3(c.x * s, c.y * s, c.depth);
    this.pivot.position.copy(this.base); this.pivot.scale.setScalar(c.w * s);
    this.clipU.value = CLIP[c.clip] ?? 3;
  }
  update(dt, t) {
    const c = this.cfg, e = this.e;
    this.spin += dt * rad(c.spin || 0);
    this.pivot.rotation.set(rad(c.rx || 0) + e.tilt.x * (c.follow || 0), rad(c.ry || 0) + this.spin + e.tilt.y * (c.follow || 0), rad(c.rz || 0));
    if (this.base) this.pivot.position.y = this.base.y + Math.sin(t * 1.3) * (c.bob || 0);
    if (this.mixer) this.mixer.update(dt);
  }
}

async function loadModel(asset) {
  const ext = (asset.name || '').split('.').pop().toLowerCase(), url = asset.src;
  if (ext === 'glb' || ext === 'gltf') {
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    const d = new DRACOLoader(); d.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/'); l.setDRACOLoader(d);
    const g = await l.loadAsync(url); return { object: g.scene, animations: g.animations || [] };
  }
  if (ext === 'obj') return { object: await new OBJLoader().loadAsync(url), animations: [] };
  if (ext === 'fbx') { const o = await new FBXLoader().loadAsync(url); return { object: o, animations: o.animations || [] }; }
  if (ext === 'stl' || ext === 'ply') {
    const g = await (ext === 'stl' ? new STLLoader() : new PLYLoader()).loadAsync(url);
    if (!g.attributes.normal) g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: 0xb8c4d8, metalness: 0.6, roughness: 0.35, vertexColors: !!g.attributes.color });
    return { object: new THREE.Mesh(g, m), animations: [] };
  }
  throw new Error(`Formato no soportado: .${ext}`);
}

class ModelLayer extends SolidLayer {
  static heavy = ['asset'];
  async build() {
    const a = this.e.asset(this.cfg.asset); if (!a) return;
    const { object, animations } = await loadModel(a);
    const box = new THREE.Box3().setFromObject(object), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const inner = new THREE.Group(); inner.add(object); object.position.sub(c);
    inner.scale.setScalar(1 / (Math.max(size.x, size.y, size.z) || 1)); // el lado mayor mide 1 → `w` es su tamaño en la carta
    this.pivot.add(inner);
    this.originals = new Map();
    object.traverse((o) => {
      if (!o.isMesh) return;
      const conv = (m) => (m.isMeshPhongMaterial || m.isMeshLambertMaterial) // OBJ/FBX: a PBR para que refleje el entorno
        ? new THREE.MeshStandardMaterial({ color: m.color, map: m.map, normalMap: m.normalMap, transparent: m.transparent, opacity: m.opacity, side: m.side, metalness: 0.25, roughness: 0.55, vertexColors: m.vertexColors })
        : m;
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => this.patch(m));
      this.originals.set(o, o.material);
    });
    if (animations.length) { this.mixer = new THREE.AnimationMixer(object); this.mixer.clipAction(animations[0]).play(); }
    this.override = this.patch(new THREE.MeshPhysicalMaterial({ color: 0xffffff }));
  }
  apply() {
    if (!this.originals) return;
    const c = this.cfg; this.place();
    const o = this.override, kind = c.material;
    o.color.set(kind === 'chrome' ? '#ffffff' : c.color); o.wireframe = kind === 'wire';
    o.metalness = kind === 'matte' ? 0 : kind === 'chrome' ? 1 : c.metal;
    o.roughness = kind === 'matte' ? 0.9 : kind === 'chrome' ? 0.06 : c.rough;
    o.iridescence = kind === 'holo' ? 1 : 0; o.iridescenceIOR = 1.6; o.envMapIntensity = c.env;
    this.originals.forEach((mat, mesh) => {
      mesh.material = kind === 'original' ? mat : o;
      (Array.isArray(mat) ? mat : [mat]).forEach((m) => { if ('envMapIntensity' in m) m.envMapIntensity = c.env; });
    });
  }
}

class ReliefLayer extends SolidLayer {
  static heavy = ['asset', 'thickness', 'bevel', 'float', 'threshold', 'detail', 'shadow.on', 'shadow.blur'];
  async build() {
    const c = this.cfg, a = this.e.asset(c.asset); if (!a) return;
    const img = await this.e.image(a.src), tex = await this.e.texture(a.src);
    const tr = traceAlpha(img, { threshold: c.threshold, detail: c.detail });
    const W = tr.w, H = tr.h; this.ar = W / H;
    const P = (p) => new THREE.Vector2(p[0] / W - 0.5, (H / 2 - p[1]) / W); // ancho 1, centrado, y hacia arriba
    const uvGen = {
      generateTopUV: (g, v, i, j, k) => [i, j, k].map((n) => new THREE.Vector2(v[n * 3] + 0.5, v[n * 3 + 1] * (W / H) + 0.5)),
      generateSideWallUV: () => [new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1), new THREE.Vector2(0, 1)],
    };
    this.cap = this.patch(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff }));
    this.sideMat = this.patch(new THREE.MeshStandardMaterial());
    const big = tr.shapes[0] ? tr.shapes[0].area : 1;
    const small = tr.shapes.filter((s) => s.area < big * 0.12);
    const T = Math.max(0.002, c.thickness), bv = Math.min(c.bevel, T * 0.45);
    tr.shapes.forEach((s) => {
      const shape = new THREE.Shape(s.outer.map(P));
      s.holes.forEach((h) => shape.holes.push(new THREE.Path(h.map(P))));
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: T - bv * 2, bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 1, UVGenerator: uvGen,
      });
      const mesh = new THREE.Mesh(geo, [this.cap, this.sideMat]);
      const rank = small.indexOf(s); // las piezas pequeñas flotan por delante, escalonadas
      mesh.position.z = bv + (rank >= 0 ? c.float * ((rank + 1) / small.length) : 0);
      this.pivot.add(mesh);
    });
    if (c.shadow && c.shadow.on) {
      const sh = drawShadow(img, c.shadow.blur);
      this.shMat = planeMaterial(this.e, { SRC_TEX: 1, ALPHA_ONLY: 1 }, { uMap: { value: new THREE.CanvasTexture(sh.canvas) } });
      this.shMesh = new THREE.Mesh(PLANE, this.shMat); this.shMesh.userData.orderOffset = -0.5; this.shInfo = sh; this.group.add(this.shMesh);
    }
  }
  apply() {
    if (!this.cap) return;
    const c = this.cfg, e = this.e; this.place();
    this.cap.metalness = c.metal; this.cap.roughness = c.rough; this.cap.emissiveIntensity = c.glow;
    this.sideMat.color.set(c.side); this.sideMat.metalness = c.metal * 0.7; this.sideMat.roughness = Math.min(1, c.rough + 0.12);
    if (this.shMesh) {
      const sh = c.shadow, z = c.depth - sh.dist, s = e.depthScale(z), w = c.w * s, u = this.shMat.uniforms;
      u.uOpacity.value = sh.alpha * c.opacity; u.uClip.value = 2; u.uTint.value.set(0, 0, 0); setBlend(this.shMat, 'normal');
      this.shMesh.position.set((c.x + sh.dx) * s, (c.y + sh.dy) * s, z);
      this.shMesh.scale.set(w * this.shInfo.scale, (w / this.ar) * this.shInfo.hScale, 1);
    }
  }
}

const TYPES = { fill: FillLayer, ascii: AsciiLayer, holo: HoloLayer, image: ImageLayer, video: VideoLayer, text: TextLayer, frame: FrameLayer, sparkles: SparklesLayer, model: ModelLayer, relief: ReliefLayer };
export const createLayer = (engine, cfg) => new (TYPES[cfg.type] || Layer)(engine, cfg);
export const layerClass = (type) => TYPES[type] || Layer;
