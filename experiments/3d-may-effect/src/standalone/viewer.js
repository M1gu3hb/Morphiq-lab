// Visor autónomo (IIFE). Va incrustado en cada HTML exportado: lee la carta del propio documento y la monta.
import { MorphCard } from '../engine/index.js';
import { mountChrome } from '../ui/chrome.js';

window.MorphCard = MorphCard;
async function boot() {
  const el = document.getElementById('stage'), data = document.getElementById('card');
  if (!el || !data) return;
  try {
    const card = new MorphCard(el);
    window.morphCard = card;
    await card.load(JSON.parse(data.textContent));
    mountChrome(card, el.parentElement, { signature: true });
  } catch (err) {
    const l = document.getElementById('load'); if (l) l.textContent = 'Este dispositivo no pudo mostrar la carta';
    console.error(err); return;
  }
  document.documentElement.classList.add('ready');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
