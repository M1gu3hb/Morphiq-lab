// Portada del experimento: muestra la carta predeterminada (la de Morphiq, o la que se haya fijado desde el laboratorio).
import { MorphCard } from '../engine/index.js';
import { MORPHIQ_CARD } from '../default-card.js';
import { mountChrome } from '../ui/chrome.js';
import { fetchDefault } from '../api.js';

const el = document.getElementById('stage');
const wide = matchMedia('(min-width: 900px)');
const offsets = () => (wide.matches ? { offsetX: 0.17, offsetY: 0 } : { offsetX: 0, offsetY: 0.12 });

(async () => {
  let card;
  try { card = new MorphCard(el, offsets()); } catch (err) { document.querySelector('.loading').textContent = 'Tu navegador no soporta WebGL'; return; }
  window.morphCard = card;
  wide.addEventListener('change', () => { Object.assign(card.opts, offsets()); card.resize(); });
  const custom = await fetchDefault();
  const base = JSON.parse(JSON.stringify(MORPHIQ_CARD));
  try { await card.load(custom || base); } catch (err) { console.error(err); await card.load(base); }
  if (!wide.matches) card.cfg.stage.fit = Math.min(card.cfg.stage.fit, 0.8), card.resize();
  mountChrome(card, document.body, { hint: false });
  document.documentElement.classList.add('is-ready');
})();
