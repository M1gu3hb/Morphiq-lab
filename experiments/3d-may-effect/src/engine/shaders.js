// GLSL del motor. Todo se resuelve en «espacio carta»: origen en el centro de la carta,
// 1 = ancho de la carta, z = 0 en su superficie y z < 0 hacia adentro.

// Recorte analítico: cada fragmento se proyecta sobre el plano de la carta a lo largo del rayo de la
// cámara y se compara con la ventana (o la silueta). Así lo que está «dentro» sólo se ve por la ventana
// y lo que está delante puede salirse del marco, sin stencil y con bordes suaves.
export const CLIP = /* glsl */ `
uniform vec3 uCamCard;
uniform vec4 uWin;
uniform float uWinR;
uniform vec2 uCardHalf;
uniform float uCardR;
float mlRR(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
vec2 mlOnCard(vec3 p) {
  float t = uCamCard.z / max(uCamCard.z - p.z, 1e-4);
  return uCamCard.xy + (p.xy - uCamCard.xy) * t;
}
// modo: 0 libre · 1 ventana · 2 silueta de la carta · 3 auto (sólo recorta lo que queda detrás del plano)
float mlClip(vec3 p, int mode) {
  vec2 q = mlOnCard(p);
  float dW = mlRR(q - uWin.xy, uWin.zw, uWinR);
  float dC = mlRR(q, uCardHalf, uCardR);
  float d = (mode == 2) ? dC : dW;
  float aa = max(fwidth(d), 1e-5);
  float a = 1.0 - smoothstep(-aa, aa, d);
  if (mode == 0) a = 1.0;
  if (mode == 3 && p.z >= 0.0) a = 1.0;
  return a;
}
`;

// Efectos holográficos: dependen del ángulo entre la cámara, la luz y la carta, así que cambian al inclinarla.
export const FOIL = /* glsl */ `
uniform vec3 uLightCard;
vec3 mlPal(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
float mlHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 mlHash2(vec2 p) { float n = mlHash(p); return vec2(n, mlHash(p + n + 17.17)); }

// tipo: 0 brillo · 1 arcoíris · 2 líneas · 3 glitter · 4 prisma
vec3 mlFoil(vec3 p, int type, float scale, float sat, vec3 tint, float time) {
  vec3 V = normalize(uCamCard - p);
  vec3 H = normalize(V + normalize(uLightCard));
  vec2 q = p.xy * scale;
  float tk = H.x + H.y * 0.7;
  vec3 col = vec3(0.0);
  if (type == 0) {
    float band = dot(p.xy, vec2(0.857, 0.514)) * 1.4 - (H.x * 3.4 + H.y * 2.4);
    float s = exp(-band * band * 5.0) + exp(-pow(band - 0.62, 2.0) * 60.0) * 0.4;
    col = mix(vec3(1.0), mlPal(band * 0.35 + 0.55), sat) * s;
  } else if (type == 1) {
    float u = dot(q, vec2(0.8, 0.6)) * 0.9 + tk * 5.0;
    float bands = 0.5 + 0.5 * sin(u * 6.28318);
    float mask = smoothstep(0.15, 1.0, 0.5 + 0.5 * sin(u * 2.1 + q.y * 1.3 - tk * 9.0));
    col = mix(vec3(1.0), mlPal(u * 0.35), sat) * (0.35 + 0.65 * bands) * mask;
  } else if (type == 2) {
    float u = q.x + q.y;
    float lines = pow(0.5 + 0.5 * sin(u * 150.0), 4.0);
    float sweep = pow(0.5 + 0.5 * sin(u * 1.6 - tk * 14.0), 2.0);
    col = mix(vec3(1.0), mlPal(u * 0.12 + tk * 1.2), sat) * (lines * 0.9 + 0.1) * sweep;
  } else if (type == 3) {
    for (int o = 0; o < 2; o++) {
      float sc = (o == 0) ? 20.0 : 46.0;
      vec2 g = q * sc;
      vec2 id = floor(g) + float(o) * 31.7;
      vec2 f = fract(g);
      vec2 r = mlHash2(id);
      vec2 d = f - (0.25 + 0.5 * r);
      vec3 N = normalize(vec3((mlHash2(id * 1.37 + 9.1) - 0.5) * 0.95, 1.0));
      float spec = pow(max(dot(N, H), 0.0), 180.0);
      float core = smoothstep(0.2, 0.0, length(d));
      float star = exp(-abs(d.x) * 36.0) * exp(-abs(d.y) * 5.0) + exp(-abs(d.y) * 36.0) * exp(-abs(d.x) * 5.0);
      float tw = 0.75 + 0.25 * sin(time * 2.0 + r.x * 40.0);
      vec3 c3 = mix(vec3(1.0), mlPal(r.y + dot(N.xy, H.xy) * 2.0), sat);
      col += c3 * spec * (core * 1.7 + star * ((o == 0) ? 1.0 : 0.25)) * tw;
    }
  } else {
    vec2 g = q * 9.0;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float md = 8.0;
    float md2 = 8.0;
    vec2 mid = vec2(0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        float d = length(o + mlHash2(id + o) - f);
        if (d < md) { md2 = md; md = d; mid = id + o; } else if (d < md2) { md2 = d; }
      }
    }
    vec3 N = normalize(vec3((mlHash2(mid * 2.3 + 4.4) - 0.5) * 1.1, 1.0));
    float spec = pow(max(dot(N, H), 0.0), 30.0);
    float edge = smoothstep(0.0, 0.07, md2 - md);
    col = mix(vec3(1.0), mlPal(mlHash(mid) + dot(N.xy, H.xy) * 3.0), sat) * spec * (0.35 + 0.65 * edge);
  }
  return col * tint;
}
`;

export const PLANE_VS = /* glsl */ `
uniform mat4 uCardInv;
varying vec2 vUv;
varying vec3 vCardPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vCardPos = (uCardInv * wp).xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// Un solo shader para todas las capas planas; el origen del color se elige con un #define.
export const PLANE_FS = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uTint;
uniform int uClip;
uniform int uBlend;
uniform float uFoilAmt;
uniform int uFoilType;
uniform float uFoilScale;
uniform float uFoilSat;
uniform vec3 uFoilTint;
uniform vec2 uTilt;
varying vec2 vUv;
varying vec3 vCardPos;
${CLIP}
${FOIL}

#ifdef SRC_TEX
uniform sampler2D uMap;
vec4 src(vec2 uv) {
  vec4 c = texture2D(uMap, uv);
  #ifdef VIDEO_SRGB
  c.rgb = pow(c.rgb, vec3(2.2));
  #endif
  #ifdef ALPHA_ONLY
  c.rgb = uTint;
  #else
  c.rgb *= uTint;
  #endif
  return c;
}
#endif

#ifdef SRC_FILL
uniform vec4 uA;
uniform vec4 uB;
uniform int uKind;
uniform vec2 uDir;
uniform vec2 uCenter;
uniform float uSpread;
uniform float uAspect;
uniform float uRadius;
uniform vec4 uStroke;
uniform float uStrokeW;
vec4 src(vec2 uv) {
  vec2 hb = vec2(uAspect, 1.0) * 0.5;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float t = 0.0;
  if (uKind == 1) t = dot(uv - 0.5, uDir) / max(uSpread, 1e-3) + 0.5;
  if (uKind == 2) t = length(p - uCenter * hb * 2.0) / (min(hb.x, hb.y) * max(uSpread, 1e-3));
  t = clamp(t, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec4 c = mix(uA, uB, t);
  float d = mlRR(p, hb, uRadius * min(hb.x, hb.y) * 2.0);
  float aa = max(fwidth(d), 1e-5);
  float edge = smoothstep(-uStrokeW - aa, -uStrokeW + aa, d) * step(1e-5, uStrokeW) * uStroke.a;
  c = mix(c, vec4(uStroke.rgb, 1.0), edge);
  c.a *= 1.0 - smoothstep(-aa, aa, d);
  return c;
}
#endif

#ifdef SRC_ASCII
uniform sampler2D uAtlas;
uniform float uGlyphs;
uniform float uRampN;
uniform float uCols;
uniform float uAspect;
uniform float uSpeed;
uniform float uDensity;
uniform float uGlow;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uC4;
uniform vec4 uBg;
vec3 ramp(float k) {
  if (k < 0.4) return mix(uC1, uC2, k / 0.4);
  if (k < 0.8) return mix(uC2, uC3, (k - 0.4) / 0.4);
  return mix(uC3, uC4, (k - 0.8) / 0.2);
}
vec4 src(vec2 uv) {
  float cols = uCols;
  float rows = max(1.0, floor(cols / uAspect / 1.55));
  vec2 g = vec2(uv.x, 1.0 - uv.y) * vec2(cols, rows);
  vec2 id = floor(g);
  vec2 f = fract(g);
  float t = uTime * uSpeed;
  float nx = id.x / cols;
  float ny = id.y / rows;
  float a = cols / rows;
  float v = sin(nx * 9.0 * a + t * 0.55 + sin(ny * 6.0 + t * 0.4) * 1.6);
  v += sin(ny * 11.0 - t * 0.7 + sin(nx * 5.0 * a - t * 0.3) * 2.1);
  v += sin((nx * a + ny) * 7.0 + t * 0.35);
  v += sin(length(vec2((nx - 0.5) * a, ny - 0.5)) * 16.0 - t * 1.1);
  v = v / 4.0 * 0.5 + 0.5;
  v = pow(max(0.0, v - 0.12) / 0.88, 1.5) * 0.78 * uDensity;
  // foco de luz que acompaña la inclinación, como el cursor en el fondo original
  vec2 hp = vec2(0.5) + vec2(-uTilt.x, uTilt.y) * 0.3;
  vec2 md = (uv - hp) * vec2(cols, cols / uAspect);
  v += exp(-dot(md, md) / 70.0) * 0.75 * uGlow;
  float k = min(1.0, v);
  float idx = min(uRampN - 1.0, floor(k * uRampN));
  if (k > 0.82 && mlHash(id + floor(t * 3.0)) > 0.8) idx = uRampN + floor(mlHash(id.yx + 3.3) * (uGlyphs - uRampN));
  float ga = texture2D(uAtlas, vec2((idx + f.x) / uGlyphs, 1.0 - f.y)).a * step(0.07, v);
  vec3 gc = ramp(min(5.0, floor(k * 6.0)) / 5.0);
  return vec4(mix(uBg.rgb, gc, ga), max(uBg.a, ga));
}
#endif

#ifdef SRC_HOLO
vec4 src(vec2 uv) { return vec4(0.0); }
#endif

#ifdef USE_MASK
uniform sampler2D uMask;
#endif

void main() {
  vec4 c = src(vUv);
  float m = 1.0;
  #ifdef USE_MASK
  vec4 mk = texture2D(uMask, vUv);
  m = mk.a * dot(mk.rgb, vec3(0.299, 0.587, 0.114));
  #endif
  vec3 foil = vec3(0.0);
  if (uFoilAmt > 0.0) foil = mlFoil(vCardPos, uFoilType, uFoilScale, uFoilSat, uFoilTint, uTime) * uFoilAmt;
  #ifdef SRC_HOLO
  c = vec4(foil, m);
  #else
  c.rgb += foil * m;
  #endif
  float a = c.a * uOpacity * mlClip(vCardPos, uClip);
  if (uBlend == 0) gl_FragColor = vec4(c.rgb, a);
  else if (uBlend == 1) gl_FragColor = vec4(c.rgb * a, a);
  else gl_FragColor = vec4(mix(vec3(1.0), c.rgb, a), 1.0);
  #include <colorspace_fragment>
}
`;

export const POINTS_VS = /* glsl */ `
uniform mat4 uCardInv;
uniform float uTime;
uniform float uSize;
uniform float uSpeed;
uniform float uPx;
uniform vec4 uBox;
attribute vec4 aSeed;
varying vec3 vCardPos;
varying vec4 vSeed;
void main() {
  vec3 p = position;
  float h = uBox.w * 2.0;
  p.y = mod(p.y + uBox.w + uTime * uSpeed * (0.3 + aSeed.x) * 0.1, h) - uBox.w + uBox.y;
  p.x += sin(uTime * (0.4 + aSeed.y) + aSeed.z * 6.28) * 0.012;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vCardPos = (uCardInv * wp).xyz;
  vSeed = aSeed;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.35 + aSeed.w) * uPx / -mv.z;
}
`;

export const POINTS_FS = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uTwinkle;
uniform vec3 uColA;
uniform vec3 uColB;
uniform int uClip;
varying vec3 vCardPos;
varying vec4 vSeed;
${CLIP}
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float core = smoothstep(0.5, 0.0, r);
  float star = exp(-abs(d.x) * 30.0) * exp(-abs(d.y) * 5.0) + exp(-abs(d.y) * 30.0) * exp(-abs(d.x) * 5.0);
  float tw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (1.0 + vSeed.x * 3.0) + vSeed.z * 40.0));
  vec2 q = mlOnCard(vCardPos);
  float dW = (uClip == 2) ? mlRR(q, uCardHalf, uCardR) : mlRR(q - uWin.xy, uWin.zw, uWinR);
  float clip = (uClip == 0) ? 1.0 : 1.0 - smoothstep(-0.004, 0.004, dW);
  float a = (core * core * 0.9 + star * step(0.55, vSeed.w) * 0.8) * tw * uOpacity * clip;
  vec3 col = mix(uColA, uColB, vSeed.y);
  gl_FragColor = vec4(col * a, a);
  #include <colorspace_fragment>
}
`;

// Fondo del escenario: degradado radial + halo detrás de la carta.
export const STAGE_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;
export const STAGE_FS = /* glsl */ `
uniform vec3 uBg1;
uniform vec3 uBg2;
uniform vec3 uGlow;
uniform float uGlowAmt;
uniform vec2 uCenter;
uniform vec2 uSize;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0);
  float r = length(p / max(uSize.y, 1e-3));
  vec3 col = mix(uBg1, uBg2, smoothstep(0.0, 1.5, r));
  col += uGlow * uGlowAmt * (exp(-r * r * 2.6) * 0.55 + exp(-r * r * 9.0) * 0.25);
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

// Parche para materiales estándar de three (modelos y relieves): mismo recorte analítico.
export function patchPortal(material, G, clipUniform) {
  if (material.userData.mlPatched) { material.userData.mlClip = clipUniform; return material; }
  material.userData.mlPatched = true;
  material.userData.mlClip = clipUniform;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uViewToCard: G.uViewToCard, uCamCard: G.uCamCard, uWin: G.uWin, uWinR: G.uWinR,
      uCardHalf: G.uCardHalf, uCardR: G.uCardR, uMlClip: material.userData.mlClip,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uViewToCard;\nvarying vec3 vCardPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCardPos = (uViewToCard * mvPosition).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCardPos;\nuniform int uMlClip;\n${CLIP}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (mlClip(vCardPos, uMlClip) < 0.5) discard;');
  };
  material.customProgramCacheKey = () => 'ml-portal';
  material.needsUpdate = true;
  return material;
}
