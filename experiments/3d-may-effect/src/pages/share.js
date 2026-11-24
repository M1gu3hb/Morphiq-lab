// Visor de una carta compartida: /3d-may-effect/c/<id>
import { MorphCard } from '../engine/index.js';
import { mountChrome } from '../ui/chrome.js';
import { fetchCard } from '../api.js';

(async () => {
  const id = (location.pathname.split('/c/')[1] || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
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
    document.getElementById('remix').href = '/3d-may-effect/lab?from=' + id;
    mountChrome(card, document.body, { hint: true });
    root.classList.add('is-ready');
  } catch (e) { console.error(e); missing(); }
})();
