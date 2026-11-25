// Pantalla de acceso: envía el código y, si es correcto, recarga la página que se quería ver.
(() => {
  const form = document.getElementById('gate'), pin = document.getElementById('pin'), msg = document.getElementById('msg');
  const btn = form.querySelector('button');
  const say = (t, err) => { msg.textContent = t; msg.classList.toggle('err', Boolean(err)); };
  pin.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = pin.value.trim();
    if (!value) return say('Escribe el código.', true);
    btn.disabled = true; say('Comprobando…');
    try {
      const res = await fetch('/api/gate', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: value }) });
      if (res.ok) { say('Listo.'); return location.pathname.replace(/\/$/, '') === '/gate' ? location.replace('/') : location.reload(); }
      const data = await res.json().catch(() => ({}));
      say(data.error || 'No se pudo comprobar. Inténtalo de nuevo.', true);
    } catch (_) { say('Sin conexión. Inténtalo de nuevo.', true); }
    btn.disabled = false; pin.value = ''; pin.focus();
  });
})();
