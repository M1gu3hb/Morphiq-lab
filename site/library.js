// Pinta la librería a partir de experiments.json (lo genera scripts/build.mjs con el meta.json de cada experimento).
(async () => {
  const grid = document.getElementById('grid'), count = document.getElementById('count');
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  try {
    const list = await (await fetch('/experiments.json', { cache: 'no-cache' })).json();
    grid.textContent = '';
    count.textContent = `${String(list.length).padStart(2, '0')} experimento${list.length === 1 ? '' : 's'}`;
    for (const x of list) {
      const a = el('a', 'xcard'); a.href = '/' + x.slug;
      const cover = el('div', 'cover');
      if (x.cover) { const im = el('img'); im.src = x.cover; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; cover.appendChild(im); }
      if (x.number) cover.appendChild(el('span', 'no', 'EXP·' + x.number));
      const body = el('div', 'body');
      body.append(el('h2', '', x.title), el('p', '', x.summary || ''));
      const meta = el('div', 'meta');
      (x.tags || []).slice(0, 4).forEach((t) => meta.appendChild(el('span', 'tag', t)));
      meta.appendChild(el('span', 'go', 'Abrir →'));
      body.appendChild(meta); a.append(cover, body); grid.appendChild(a);
    }
    grid.appendChild(el('div', 'xcard next', 'Próximo experimento\nen camino'));
  } catch (e) {
    grid.textContent = ''; grid.appendChild(el('p', 'empty', 'No se pudo cargar la librería. Recarga la página.'));
  }
})();
