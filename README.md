# Morphiq Lab

Laboratorio de componentes, interfaces y animaciones de Morphiq. Cada idea vive en su propia ruta y la raíz muestra la librería completa.

| Ruta | Qué es |
| --- | --- |
| `/` | Librería: todos los experimentos |
| `/3d-may-effect` | Portada del experimento 001 (la carta predeterminada) |
| `/3d-may-effect/lab` | Editor de cartas |
| `/3d-may-effect/<nombre>` | Una carta compartida por enlace (el nombre lo eliges al publicar). Pública |

Todo lo demás pide el código de acceso (ver «Acceso privado»).

## Estructura

```
experiments/<slug>/        un experimento = una carpeta
  meta.json                ficha que aparece en la librería (título, resumen, etiquetas, portada)
  *.html                   páginas → /<slug>/…
  assets/                  estáticos → /<slug>/assets/
  src/pages/*.js           un módulo por página (ESM, comparten código)
  src/standalone/*.js      bundles autónomos (IIFE con todo dentro)
site/                      librería, estilos base, tipografías y marca (compartido)
api/<slug>/                funciones de Vercel del experimento
scripts/build.mjs          construye todo en dist/
scripts/dev.mjs            servidor local con las mismas URL que producción
```

**Experimento nuevo:** crea `experiments/<slug>/` con `meta.json` e `index.html`. Al hacer push a `main` aparece en la librería y queda en `/<slug>`. No hay que registrar nada más.

## Desarrollo

```
npm install
npm run dev        # http://localhost:4321 (reconstruye al guardar)
npm run build      # genera dist/
npm run check      # sintaxis de las funciones
npm test           # pruebas de las funciones (sesión, origen, rutas)
```

`npm run dev` también ejecuta las funciones de `/api` con las variables de entorno que tenga la terminal. Con `LAB_FAKE_STORE=1 npm run dev` la clave se guarda en memoria, para probar el alta y el acceso sin tocar Vercel. `npm test` comprueba sesión, origen y reglas de rutas sin tocar la red.

## 3D May Effect

Una carta es una ventana: las capas viven a distinta profundidad dentro (o delante) de ella y, al inclinarla, se desplazan como en una caja de sombras. El motor está en `experiments/3d-may-effect/src/engine/` y no depende del editor:

```js
import { MorphCard } from './engine/index.js';
const card = new MorphCard(document.querySelector('#stage'));
await card.load(config);            // config = JSON de la carta
card.patch(idDeCapa, 'depth', -0.4); // cambios en vivo
const copia = await card.portable(); // todo incrustado, lista para exportar
```

- `engine/schema.js` — formato de la carta y valores por defecto de cada tipo de capa.
- `engine/layers.js` — capas: relleno, ASCII, imagen, video, texto, holo, partículas, marco, modelo 3D (GLB, GLTF, OBJ, FBX, STL, PLY) y relieve (una imagen con transparencia convertida en pieza con volumen).
- `engine/shaders.js` — recorte por la ventana, efectos holo y fondo ASCII.
- `lab/fields.js` — los controles del editor se generan desde aquí: un ajuste nuevo se declara en una línea.
- `export.js` — genera el `.html` autónomo (visor + carta en un solo archivo, sin internet).

Unidades: `1` = ancho de la carta; `depth < 0` es hacia adentro y `depth > 0` se sale del marco.

### Enlaces y portada

Los enlaces compartidos y la carta fijada como portada se guardan en **Vercel Blob** (almacén público `morphiqlab-blob`, conectado al proyecto). Ver una carta es público; publicar, cambiar la portada o borrar exige entrar con la clave del laboratorio.

**La clave se crea desde el propio laboratorio**, en *Salida → Sesión → Crear clave*. La primera vez pide un código de configuración que el servidor escribe en los registros de Vercel (Logs del proyecto, busca «Código de configuración»): así sólo quien tiene acceso al proyecto puede crearla. La clave se guarda como hash scrypt con sal, nunca en texto claro, y se puede cambiar después desde el mismo sitio (eso cierra las demás sesiones). Al entrar, el servidor entrega una cookie de sesión firmada (HttpOnly, 30 días): la clave no se guarda en el navegador.

Variables de entorno en Vercel:

- `BLOB_READ_WRITE_TOKEN` — la crea Vercel al conectar el almacén Blob. Además de dar acceso al almacén, es la raíz con la que se firman las sesiones.
- `LAB_KEY` — opcional. Si existe, ésa es la clave y se desactiva crearla o cambiarla desde el laboratorio.

**Si olvidas la clave:** borra el archivo de `3d-may-effect/_auth/` en el almacén (Vercel → Storage → morphiqlab-blob → Manage Blobs) y vuelve a crearla con el código de configuración.

Sin almacén el sitio funciona igual: sólo se desactivan los enlaces y el cambio de portada. La exportación a HTML no depende de él.

### Acceso privado

La librería (`/`), la portada del experimento y el editor piden un **código de acceso** una vez por dispositivo (dura 180 días). Los enlaces compartidos (`/3d-may-effect/<nombre>`) siguen públicos, sin código.

- `middleware.js` decide qué rutas son privadas (lista `matcher`). **Experimento nuevo → añade ahí sus páginas privadas.**
- `api/gate.js` comprueba el código y entrega la cookie de acceso; la pantalla está en `site/gate/`.
- El código no está en el repositorio: sólo su hash, y la sal depende de un secreto del servidor. Para cambiarlo, define `GATE_PIN` en las variables de entorno de Vercel (tiene prioridad sobre el hash) y vuelve a desplegar.
- Es un candado contra curiosos, no una caja fuerte: un código de 4 dígitos se puede adivinar con paciencia. Lo que de verdad importa (publicar, cambiar la portada, borrar) sigue protegido por la clave del laboratorio.

### Seguridad

- Cabeceras en `vercel.json`: CSP, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. `style-src` permite estilos en línea porque el visor inyecta su hoja de estilos (la misma que viaja dentro del HTML exportado).
- Las funciones validan sesión y origen en todo lo que cambia estado; las subidas sólo aceptan JSON, hasta 60 MB, en rutas exactas.
- El almacén es público (los enlaces compartidos lo necesitan); el registro de la clave lleva un sufijo aleatorio en su dirección y sólo contiene hash y sal.
- El freno de intentos de clave vive en memoria de cada instancia: para un límite duro, añade una regla de rate limiting en el Firewall de Vercel sobre `/api/3d-may-effect/session`.

## Despliegue

Proyecto de Vercel `morphiqlab` vinculado a `M1gu3hb/Morphiq-lab`: cada push a `main` se publica solo. Framework **Other**, `npm run build`, salida `dist` (ver `vercel.json`).

**Volver atrás:** en Vercel → Deployments, elige el despliegue anterior y usa *Instant Rollback*; o revierte el commit en `main`.
