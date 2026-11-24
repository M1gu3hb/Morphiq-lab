// Pruebas de las funciones sin red: sesión, origen (CSRF) y reglas de rutas de subida.
// Uso: npm test
import assert from 'node:assert/strict';

process.env.LAB_KEY = 'clave-de-prueba-123';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_storeprueba_secretodeprueba'; // ficticio: sólo para firmar en local
const HOST = 'lab.test', ORIGIN = 'https://lab.test';
const session = (await import('../api/3d-may-effect/session.js')).default;
const upload = (await import('../api/3d-may-effect/upload.js')).default;
const cards = (await import('../api/3d-may-effect/cards.js')).default;
const card = (await import('../api/3d-may-effect/card.js')).default;
const def = (await import('../api/3d-may-effect/default.js')).default;

async function call(fn, { method = 'GET', body, query = {}, origin, cookie, ip = '1.1.1.1' } = {}) {
  const headers = { host: HOST, 'x-forwarded-for': ip, ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) };
  const req = { method, headers, body, query, url: '/' };
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(t) { this.text = t; } };
  await fn(req, res);
  return { status: res.statusCode, json: res.text ? JSON.parse(res.text) : null, cookie: res.headers['set-cookie'] };
}
const tokenReq = (pathname, kind) => ({ type: 'blob.generate-client-token', payload: { pathname, clientPayload: JSON.stringify({ kind }), multipart: false } });
let n = 0; const ok = (name) => console.log(`  ✓ ${name}`, ++n && '');

// --- sesión ---
assert.deepEqual((await call(session)).json, { ok: false, configured: true, storage: true }); ok('sin cookie no hay sesión');
assert.equal((await call(session, { method: 'POST', body: { key: 'clave-de-prueba-123' } })).status, 403); ok('entrar sin cabecera Origin se rechaza');
assert.equal((await call(session, { method: 'POST', body: { key: 'clave-de-prueba-123' }, origin: 'https://otro.sitio' })).status, 403); ok('entrar desde otro origen se rechaza');
assert.equal((await call(session, { method: 'POST', body: { key: 'mala' }, origin: ORIGIN })).status, 401); ok('clave incorrecta → 401');
assert.equal((await call(session, { method: 'POST', body: {}, origin: ORIGIN })).status, 401); ok('sin clave → 401');
const login = await call(session, { method: 'POST', body: { key: 'clave-de-prueba-123' }, origin: ORIGIN });
assert.equal(login.status, 200); assert.match(login.cookie, /^__Host-morphiq-lab=\d+\.[\w-]+; Max-Age=\d+; Path=\/; HttpOnly; Secure; SameSite=Strict$/); ok('clave correcta → cookie HttpOnly/Secure/SameSite=Strict');
const cookie = login.cookie.split(';')[0];
assert.equal((await call(session, { cookie })).json.ok, true); ok('la cookie abre sesión');
const [name, val] = cookie.split('='), [exp, sig] = val.split('.');
assert.equal((await call(session, { cookie: `${name}=${Number(exp) + 1}.${sig}` })).json.ok, false); ok('cookie con la fecha alterada no vale');
assert.equal((await call(session, { cookie: `${name}=${exp}.${sig.slice(0, -2)}xx` })).json.ok, false); ok('cookie con la firma alterada no vale');
assert.equal((await call(session, { cookie: `${name}=1000.${sig}` })).json.ok, false); ok('cookie caducada no vale');

// --- lo que cambia estado exige sesión y mismo origen ---
assert.equal((await call(cards)).status, 401); ok('listar enlaces sin sesión → 401');
assert.equal((await call(upload, { method: 'POST', body: tokenReq('3d-may-effect/cards/demo.json', 'card'), origin: ORIGIN })).status, 401); ok('subir sin sesión → 401');
assert.equal((await call(upload, { method: 'POST', body: tokenReq('3d-may-effect/cards/demo.json', 'card'), cookie, origin: 'https://otro.sitio' })).status, 403); ok('subir desde otro origen → 403');
assert.equal((await call(upload, { method: 'POST', body: tokenReq('3d-may-effect/cards/demo.json', 'card'), cookie })).status, 403); ok('subir sin Origin → 403');
assert.equal((await call(card, { method: 'DELETE', query: { id: 'demo' }, origin: ORIGIN })).status, 401); ok('borrar enlace sin sesión → 401');
assert.equal((await call(def, { method: 'DELETE', cookie, origin: 'https://otro.sitio' })).status, 403); assert.equal((await call(def, { method: 'DELETE', origin: ORIGIN })).status, 401); ok('restaurar portada exige sesión y mismo origen');

// --- reglas de rutas de subida ---
const up = (pathname, kind) => call(upload, { method: 'POST', body: tokenReq(pathname, kind), cookie, origin: ORIGIN });
for (const good of ['3d-may-effect/cards/demo.json', '3d-may-effect/cards/mi-carta-2.json', '3d-may-effect/cards/x.json']) {
  const r = await up(good, 'card'); assert.equal(r.status, 200, good); assert.equal(r.json.type, 'blob.generate-client-token'); assert.ok(r.json.clientToken.startsWith('vercel_blob_client_'));
}
ok('nombres válidos reciben token de subida');
assert.equal((await up(`3d-may-effect/default/${Date.now()}.json`, 'default')).status, 200); ok('la portada recibe token de subida');
for (const bad of ['3d-may-effect/cards/lab.json', '3d-may-effect/cards/c.json', '3d-may-effect/cards/Demo.json', '3d-may-effect/cards/-a.json', '3d-may-effect/cards/a-.json', '3d-may-effect/cards/a/b.json', '3d-may-effect/cards/../x.json', '3d-may-effect/cards/demo.html', 'otro/cards/demo.json', '3d-may-effect/default/hola.json', `3d-may-effect/cards/${'a'.repeat(33)}.json`]) {
  assert.equal((await up(bad, 'card')).status, 400, bad);
}
ok('nombres reservados, mayúsculas, rutas raras u otras extensiones se rechazan');
assert.equal((await up('3d-may-effect/cards/demo.json', 'default')).status, 400); assert.equal((await up(`3d-may-effect/default/${Date.now()}.json`, 'card')).status, 400); ok('el tipo debe coincidir con la ruta');
assert.equal((await up('3d-may-effect/cards/demo.json', 'otro')).status, 400); ok('tipo desconocido se rechaza');

// --- lectura pública: sólo nombres válidos ---
for (const bad of ['', 'lab', '../x', 'A', 'a b']) assert.equal((await call(card, { query: { id: bad } })).status, 400, bad);
ok('leer una carta valida el nombre');

// --- freno de intentos ---
let last; for (let i = 0; i < 10; i++) last = await call(session, { method: 'POST', body: { key: 'no' }, origin: ORIGIN, ip: '9.9.9.9' });
assert.equal(last.status, 429); ok('tras 8 claves malas seguidas → 429');
assert.equal((await call(session, { method: 'POST', body: { key: 'clave-de-prueba-123' }, origin: ORIGIN, ip: '9.9.9.9' })).status, 429); ok('durante el freno ni la clave buena entra');

console.log(`\n${n} comprobaciones correctas`);
