// Pruebas de las funciones sin red: clave, sesión, origen (CSRF) y reglas de rutas de subida.
// Uso: npm test
import assert from 'node:assert/strict';

process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_storeprueba_secretodeprueba'; // ficticio: sólo para firmar en local
delete process.env.LAB_KEY;
const HOST = 'lab.test', ORIGIN = 'https://lab.test';
const lab = await import('../api/_lib/lab.js');
const session = (await import('../api/3d-may-effect/session.js')).default;
const upload = (await import('../api/3d-may-effect/upload.js')).default;
const cards = (await import('../api/3d-may-effect/cards.js')).default;
const card = (await import('../api/3d-may-effect/card.js')).default;
const def = (await import('../api/3d-may-effect/default.js')).default;

// Almacén en memoria con la misma forma que @vercel/blob.
const store = new Map(); let seq = 0, down = false;
lab.__setBackend({
  list: async ({ prefix }) => { if (down) throw new Error('almacén caído'); return { blobs: [...store.values()].filter((b) => b.pathname.startsWith(prefix)) }; },
  put: async (pathname, body, opts) => { assert.equal(opts.addRandomSuffix, true); const url = `https://x.test/${pathname}-${++seq}`; store.set(url, { url, pathname, body, uploadedAt: new Date(Date.now() + seq) }); return { url }; },
  del: async (urls) => { for (const u of [].concat(urls)) store.delete(u); },
  fetch: async (u) => ({ ok: store.has(u), json: async () => JSON.parse(store.get(u).body) }),
});

async function call(fn, { method = 'GET', body, query = {}, origin, cookie, ip = '1.1.1.1' } = {}) {
  const headers = { host: HOST, 'x-forwarded-for': ip, ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) };
  const req = { method, headers, body, query, url: '/' };
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(t) { this.text = t; } };
  await fn(req, res);
  return { status: res.statusCode, json: res.text ? JSON.parse(res.text) : null, cookie: res.headers['set-cookie'] };
}
const post = (body, extra = {}) => call(session, { method: 'POST', body, origin: ORIGIN, ...extra });
const tokenReq = (pathname, kind) => ({ type: 'blob.generate-client-token', payload: { pathname, clientPayload: JSON.stringify({ kind }), multipart: false } });
let n = 0; const ok = (name) => { n += 1; console.log(`  ✓ ${name}`); };
const logs = []; const realLog = console.log;

console.log('Primera clave');
assert.deepEqual((await call(session)).json, { ok: false, configured: false, storage: true, setup: true }); ok('sin clave creada: pide configuración');
console.log = (...a) => logs.push(a.join(' ')); await call(session, { query: { setup: '1' } }); console.log = realLog;
const code = (logs.join('\n').match(/configuración: ([a-z0-9-]+)/) || [])[1];
assert.match(code, /^[a-z2-9]{4}-[a-z2-9]{4}$/); assert.equal(code, lab.setupCode()); ok('el código de configuración sólo sale en los registros');
assert.equal((await post({ key: 'lo-que-sea' })).status, 503); ok('no se puede entrar antes de crear la clave');
assert.equal((await post({ setup: { code: 'aaaa-bbbb', key: 'mi clave larga' } })).status, 401); ok('código incorrecto → 401');
assert.equal((await post({ setup: { code, key: 'corta' } })).status, 400); ok('clave de menos de 8 caracteres → 400');
assert.equal((await call(session, { method: 'POST', body: { setup: { code, key: 'mi clave larga' } }, origin: 'https://otro.sitio' })).status, 403); ok('crear la clave desde otro origen → 403');
assert.equal(store.size, 0); ok('los intentos fallidos no guardan nada');
const made = await post({ setup: { code: code.toUpperCase().replace('-', ' '), key: 'mi clave larga' } });
assert.equal(made.status, 200); assert.match(made.cookie, /^__Host-morphiq-lab=\d+\.[a-z0-9]+\.[\w-]+; Max-Age=\d+; Path=\/; HttpOnly; Secure; SameSite=Strict$/); ok('código correcto → clave creada y cookie HttpOnly/Secure/SameSite=Strict');
const saved = [...store.values()][0]; const rec = JSON.parse(saved.body);
assert.ok(saved.pathname.startsWith('3d-may-effect/_auth/')); assert.ok(!saved.body.includes('mi clave larga')); assert.match(rec.hash, /^[0-9a-f]{64}$/); assert.match(rec.salt, /^[0-9a-f]{32}$/); ok('se guarda sólo el hash con sal, nunca la clave');
assert.equal((await post({ setup: { code, key: 'otra clave larga' } })).status, 409); ok('la clave sólo se crea una vez');
assert.equal((await call(session)).json.setup, false); ok('con clave creada ya no se ofrece configuración');

console.log('Sesión');
let cookie = made.cookie.split(';')[0];
assert.equal((await call(session, { cookie })).json.ok, true); ok('la cookie abre sesión');
assert.equal((await post({ key: 'mi clave larga' }, { origin: undefined })).status, 403); ok('entrar sin cabecera Origin se rechaza');
assert.equal((await post({ key: 'mala mala mala' })).status, 401); assert.equal((await post({})).status, 401); ok('clave incorrecta o vacía → 401');
const login = await post({ key: 'mi clave larga' }); assert.equal(login.status, 200); ok('clave correcta → entra');
const [name, val] = cookie.split('='), [exp, gen, sig] = val.split('.');
assert.equal((await call(session, { cookie: `${name}=${Number(exp) + 1}.${gen}.${sig}` })).json.ok, false); ok('cookie con la fecha alterada no vale');
assert.equal((await call(session, { cookie: `${name}=${exp}.${gen}.${sig.slice(0, -2)}xx` })).json.ok, false); ok('cookie con la firma alterada no vale');
assert.equal((await call(session, { cookie: `${name}=1000.${gen}.${sig}` })).json.ok, false); ok('cookie caducada no vale');

console.log('Lo que cambia estado exige sesión y mismo origen');
assert.equal((await call(cards)).status, 401); ok('listar enlaces sin sesión → 401');
assert.equal((await call(upload, { method: 'POST', body: tokenReq('3d-may-effect/cards/demo.json', 'card'), origin: ORIGIN })).status, 401); ok('subir sin sesión → 401');
assert.equal((await call(upload, { method: 'POST', body: tokenReq('3d-may-effect/cards/demo.json', 'card'), cookie, origin: 'https://otro.sitio' })).status, 403); ok('subir desde otro origen → 403');
assert.equal((await call(upload, { method: 'POST', body: tokenReq('3d-may-effect/cards/demo.json', 'card'), cookie })).status, 403); ok('subir sin Origin → 403');
assert.equal((await call(card, { method: 'DELETE', query: { id: 'demo' }, origin: ORIGIN })).status, 401); ok('borrar enlace sin sesión → 401');
assert.equal((await call(def, { method: 'DELETE', cookie, origin: 'https://otro.sitio' })).status, 403); assert.equal((await call(def, { method: 'DELETE', origin: ORIGIN })).status, 401); ok('restaurar portada exige sesión y mismo origen');
assert.equal((await post({ change: { key: 'clave nueva larga' } })).status, 401); ok('cambiar la clave sin sesión → 401');

console.log('Reglas de rutas de subida');
const up = (pathname, kind) => call(upload, { method: 'POST', body: tokenReq(pathname, kind), cookie, origin: ORIGIN });
for (const good of ['3d-may-effect/cards/demo.json', '3d-may-effect/cards/mi-carta-2.json', '3d-may-effect/cards/x.json']) {
  const r = await up(good, 'card'); assert.equal(r.status, 200, good); assert.equal(r.json.type, 'blob.generate-client-token'); assert.ok(r.json.clientToken.startsWith('vercel_blob_client_'));
}
ok('nombres válidos reciben token de subida');
assert.equal((await up(`3d-may-effect/default/${Date.now()}.json`, 'default')).status, 200); ok('la portada recibe token de subida');
for (const bad of ['3d-may-effect/cards/lab.json', '3d-may-effect/cards/c.json', '3d-may-effect/cards/Demo.json', '3d-may-effect/cards/-a.json', '3d-may-effect/cards/a-.json', '3d-may-effect/cards/a/b.json', '3d-may-effect/cards/../x.json', '3d-may-effect/cards/demo.html', 'otro/cards/demo.json', '3d-may-effect/default/hola.json', '3d-may-effect/_auth/clave.json', `3d-may-effect/cards/${'a'.repeat(33)}.json`]) {
  assert.equal((await up(bad, 'card')).status, 400, bad);
}
ok('nombres reservados, mayúsculas, rutas raras, la carpeta de la clave u otras extensiones se rechazan');
assert.equal((await up('3d-may-effect/cards/demo.json', 'default')).status, 400); assert.equal((await up(`3d-may-effect/default/${Date.now()}.json`, 'card')).status, 400); assert.equal((await up('3d-may-effect/cards/demo.json', 'otro')).status, 400); ok('el tipo debe coincidir con la ruta');
for (const bad of ['', 'lab', '../x', 'A', 'a b', '_auth']) assert.equal((await call(card, { query: { id: bad } })).status, 400, bad);
ok('leer una carta valida el nombre');

console.log('Cambio de clave');
const changed = await post({ change: { key: 'clave nueva larga' } }, { cookie });
assert.equal(changed.status, 200); assert.equal(store.size, 1); ok('con sesión se cambia y se retira el registro anterior');
assert.equal((await call(session, { cookie })).json.ok, false); assert.equal((await call(cards, { cookie })).status, 401); ok('la sesión anterior deja de valer');
cookie = changed.cookie.split(';')[0];
assert.equal((await call(session, { cookie })).json.ok, true); ok('la sesión nueva vale');
assert.equal((await post({ key: 'mi clave larga' })).status, 401); assert.equal((await post({ key: 'clave nueva larga' })).status, 200); ok('la clave vieja ya no entra; la nueva sí');

console.log('Freno de intentos');
let last; for (let i = 0; i < 10; i++) last = await post({ key: 'no es la clave' }, { ip: '9.9.9.9' });
assert.equal(last.status, 429); ok('tras 8 claves malas seguidas → 429');
assert.equal((await post({ key: 'clave nueva larga' }, { ip: '9.9.9.9' })).status, 429); ok('durante el freno ni la clave buena entra');

console.log('Fallos');
down = true; lab.__setBackend({ list: async () => { throw new Error('almacén caído'); }, put: async () => { throw new Error('x'); }, del: async () => {}, fetch: async () => ({ ok: false }) });
const realErr = console.error; console.error = () => {};
assert.equal((await call(session)).status, 503); assert.equal((await post({ setup: { code, key: 'mi clave larga' } })).status, 503); assert.equal((await call(cards, { cookie })).status, 503); console.error = realErr;
ok('si el almacén falla no se abre nada: 503, nunca «sin clave»');

console.log('Clave fija por variable de entorno (LAB_KEY)');
process.env.LAB_KEY = 'clave-de-entorno-123';
assert.deepEqual((await call(session)).json, { ok: false, configured: true, storage: true, setup: false }); ok('con LAB_KEY no hay configuración desde el laboratorio');
assert.equal((await post({ key: 'clave nueva larga' })).status, 401); ok('la clave guardada deja de valer');
const envLogin = await post({ key: 'clave-de-entorno-123' }); assert.equal(envLogin.status, 200);
assert.equal((await call(session, { cookie: envLogin.cookie.split(';')[0] })).json.ok, true); ok('entra con LAB_KEY');
assert.equal((await call(session, { cookie })).json.ok, false); ok('las cookies firmadas con la otra raíz no valen');
assert.equal((await post({ change: { key: 'otra clave larga' } }, { cookie: envLogin.cookie.split(';')[0] })).status, 409); ok('con LAB_KEY la clave no se cambia desde el laboratorio');

console.log('Candado del sitio');
delete process.env.LAB_KEY; process.env.GATE_PIN = 'prueba-1234';
const gateApi = (await import('../api/gate.js')).default;
const mw = await import('../middleware.js');
const ROOT = process.env.BLOB_READ_WRITE_TOKEN;
const knock = (pin, extra = {}) => call(gateApi, { method: 'POST', body: { pin }, origin: ORIGIN, ip: '7.7.7.7', ...extra });
assert.equal((await knock('prueba-1234', { origin: undefined })).status, 403); ok('el código sin cabecera Origin se rechaza');
assert.equal((await knock('0000')).status, 401); assert.equal((await knock('')).status, 401); ok('código incorrecto o vacío → 401');
const pass = await knock('prueba-1234');
assert.equal(pass.status, 200); assert.match(pass.cookie, /^__Host-morphiq-gate=\d+\.[\w-]+; Max-Age=15552000; Path=\/; HttpOnly; Secure; SameSite=Lax$/); ok('código correcto → cookie de acceso HttpOnly/Secure (180 días)');
const gc = pass.cookie.split(';')[0], [gname, gval] = gc.split('='), [gexp, gsig] = gval.split('.');
assert.equal(mw.hasAccess(gc, ROOT), true); assert.equal(mw.hasAccess(`otra=1; ${gc}`, ROOT), true); ok('el middleware acepta la cookie firmada por la función');
assert.equal(mw.hasAccess('', ROOT), false); assert.equal(mw.hasAccess(`${gname}=${Number(gexp) + 1}.${gsig}`, ROOT), false); assert.equal(mw.hasAccess(`${gname}=${gexp}.${gsig.slice(0, -2)}xx`, ROOT), false);
assert.equal(mw.hasAccess(`${gname}=1000.${gsig}`, ROOT), false); assert.equal(mw.hasAccess(gc, 'otra-raiz'), false); assert.equal(mw.hasAccess(gc, ''), false); ok('sin cookie, alterada, caducada o de otra raíz → sin acceso');
assert.equal(mw.hasAccess(cookie, ROOT), false); ok('la cookie de sesión del editor no sirve como acceso (son firmas distintas)');
const visit = (path, c) => mw.default(new Request('https://lab.test' + path, { headers: c ? { cookie: c } : {} }));
assert.match(visit('/').headers.get('x-middleware-rewrite'), /\/gate$/); assert.match(visit('/3d-may-effect/lab').headers.get('x-middleware-rewrite'), /\/gate$/); ok('sin acceso, las páginas privadas muestran la pantalla de acceso');
assert.equal(visit('/', gc).headers.get('x-middleware-next'), '1'); assert.equal(visit('/3d-may-effect/lab', gc).headers.get('x-middleware-rewrite'), null); ok('con acceso, pasan');
const M = mw.config.matcher;
assert.ok(M.every((m) => !/[:*(]/.test(m))); for (const pub of ['/3d-may-effect/demo', '/3d-may-effect/c/demo', '/gate', '/api/gate', '/3d-may-effect/js/share.js', '/api/3d-may-effect/card']) assert.ok(!M.includes(pub), pub);
for (const priv of ['/', '/experiments.json', '/3d-may-effect', '/3d-may-effect/lab']) assert.ok(M.includes(priv), priv);
ok('los enlaces compartidos y sus archivos quedan fuera del candado; librería, portada y editor dentro');
delete process.env.GATE_PIN;
assert.equal((await knock('0000', { ip: '7.7.7.8' })).status, 401); ok('sin GATE_PIN se usa el hash guardado (un código cualquiera no entra)');
let g; for (let i = 0; i < 9; i++) g = await knock('1111', { ip: '6.6.6.6' });
assert.equal(g.status, 429); ok('tras 8 códigos malos seguidos → 429');

console.log(`\n${n} comprobaciones correctas`);
