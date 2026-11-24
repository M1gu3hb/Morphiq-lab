// Exportación: un solo .html con el visor y la carta dentro. No necesita internet ni archivos aparte.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function standaloneHTML(card, { title } = {}) {
  const [cfg, res] = await Promise.all([card.portable(), fetch('/3d-may-effect/js/viewer.js')]);
  if (!res.ok) throw new Error('No se pudo cargar el visor');
  const js = (await res.text()).replace(/<\/(script)/gi, '<\\/$1');
  // «<» y los separadores de línea Unicode se escapan para que el JSON no pueda cerrar la etiqueta ni romper el script
  const LS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c').replace(LS, (c) => '\\u' + c.charCodeAt(0).toString(16));
  const name = esc(title || cfg.name || 'Carta 3D');
  const bg = /^#[0-9a-f]{6}$/i.test(cfg.stage.bg2) ? cfg.stage.bg2 : '#03050b';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="${bg}">
<meta name="generator" content="Morphiq Lab · 3D May Effect">
<title>${name}</title>
<style>
html,body{margin:0;height:100%;background:${bg};overflow:hidden;overscroll-behavior:none}
#wrap{position:fixed;inset:0}
#stage{position:absolute;inset:0;opacity:0;transition:opacity .7s ease}
.ready #stage{opacity:1}
#load{position:absolute;inset:0;display:grid;place-items:center;font:500 11px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.2em;color:#5d6a8c;text-transform:uppercase;transition:opacity .4s}
.ready #load{opacity:0;pointer-events:none}
</style>
</head>
<body>
<div id="wrap"><div id="stage"></div><div id="load">Cargando…</div></div>
<script type="application/json" id="card">${json}</script>
<script>${js}</script>
</body>
</html>
`;
}

export function download(name, data, type = 'text/html') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const slugify = (s) => String(s || 'carta').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'carta';
