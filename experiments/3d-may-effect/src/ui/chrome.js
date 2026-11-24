// Controles mínimos sobre el escenario: pista de «arrastra» y botón de giroscopio.
// Lleva sus propios estilos para funcionar igual dentro del HTML exportado.
const CSS = `
.mc-hint,.mc-gyro,.mc-sign{position:absolute;z-index:5;font:500 11px/1 ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#aebbdc}
.mc-hint{left:0;right:0;margin:0 auto;width:max-content;max-width:calc(100% - 32px);bottom:calc(var(--mc-bottom,34px) + env(safe-area-inset-bottom,0px));padding:10px 15px;border-radius:999px;background:rgba(8,12,24,.82);border:1px solid rgba(140,170,255,.22);pointer-events:none;white-space:nowrap;transition:opacity .5s}
.mc-hint.off{opacity:0}
.mc-gyro{right:14px;top:calc(var(--mc-top,14px) + env(safe-area-inset-top,0px));width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:rgba(8,12,24,.62);border:1px solid rgba(140,170,255,.18);color:#aebbdc;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:color .2s,border-color .2s,background .2s}
.mc-gyro[aria-pressed="true"]{color:#fff;border-color:#1e5bff;background:rgba(30,91,255,.28)}
.mc-gyro:focus-visible{outline:2px solid #38e1ff;outline-offset:2px}
.mc-sign{left:0;right:0;bottom:calc(8px + env(safe-area-inset-bottom,0px));text-align:center;font-size:9.5px;color:#7483a8;pointer-events:none}
.mc-sign b{color:#8fa4d6;font-weight:600}
@media (prefers-reduced-motion:reduce){.mc-hint{transition:none}}
`;

export function mountChrome(card, root, { hint = true, gyro = true, signature = false } = {}) {
  if (!document.getElementById('mc-chrome')) { const st = document.createElement('style'); st.id = 'mc-chrome'; st.textContent = CSS; document.head.appendChild(st); }
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  const touch = matchMedia('(pointer: coarse)').matches;
  let h = null;
  if (hint) {
    h = document.createElement('div'); h.className = 'mc-hint';
    h.textContent = touch ? 'Arrastra para inclinar' : 'Mueve el cursor sobre la carta';
    root.appendChild(h);
    const off = () => { h.classList.add('off'); card.el.removeEventListener('pointerdown', off); };
    card.el.addEventListener('pointerdown', off); setTimeout(off, 7000);
  }
  if (gyro && touch && 'DeviceOrientationEvent' in window) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mc-gyro'; b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', 'Inclinar moviendo el teléfono'); b.title = 'Inclinar moviendo el teléfono';
    b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7.5" y="3.5" width="9" height="17" rx="2.2" transform="rotate(-18 12 12)"/><path d="M3.5 8.5c-1 2-1 4.500 0 6.500M20.500 9c1 2 1 4.500 0 6.500"/></svg>';
    b.addEventListener('click', async () => {
      if (b.getAttribute('aria-pressed') === 'true') { card.disableGyro(); b.setAttribute('aria-pressed', 'false'); return; }
      const ok = await card.enableGyro();
      b.setAttribute('aria-pressed', ok ? 'true' : 'false');
      if (h) { h.textContent = ok ? 'Mueve tu teléfono' : 'Tu navegador no dio acceso al sensor'; h.classList.remove('off'); setTimeout(() => h.classList.add('off'), 3200); }
    });
    root.appendChild(b);
  }
  if (signature) { const s = document.createElement('div'); s.className = 'mc-sign'; s.innerHTML = 'Hecho en <b>Morphiq Lab</b>'; root.appendChild(s); }
}
