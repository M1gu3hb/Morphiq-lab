// Visor de una carta compartida: /3d-may-effect/<nombre>
import { MorphCard } from '../engine/index.js';
import { mountChrome } from '../ui/chrome.js';
import { fetchCard, slugOk } from '../api.js';

(async () => {
  const parts = location.pathname.split('/').filter(Boolean), last = parts.length > 1 ? parts[parts.length - 1] : '';
  const id = slugOk(last) ? last : '';
  const root = document.documentElement, missing = () => root.classList.add('is-missing');
  if (!id) return missing();
  const cfg = await fetchCard(id);
  if (!cfg) return missing();
  try {
    const card = new MorphCard(document.getElementById('stage'), { offsetY: 0.04 });
    window.morphCard = card;
    await card.load(cfg);
    document.getElementById('title').textContent = cfg.name || 'Carta 3D';
    document.title = `${cfg.name || 'Carta 3D'} · Morphiq Lab`;
    mountChrome(card, document.body, { hint: true });
    root.classList.add('is-ready');
  } catch (e) { console.error(e); missing(); }
})();
