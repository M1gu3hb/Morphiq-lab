# Morphiq Lab

Laboratorio de componentes, interfaces y animaciones de Morphiq. Cada idea vive en su propia ruta y la raíz muestra la librería completa.

| Ruta | Qué es |
| --- | --- |
| `/` | Librería: todos los experimentos |
| `/3d-may-effect` | Portada del experimento 001 (la carta predeterminada) |
| `/3d-may-effect/lab` | Editor de cartas |
| `/3d-may-effect/c/<id>` | Una carta compartida por enlace |

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
```

Las funciones de `/api` no corren en `npm run dev`; para probarlas en local usa `vercel dev` con las variables de entorno.

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

Los enlaces compartidos y la carta fijada como portada se guardan en **Vercel Blob**. Publicar, cambiar la portada o borrar exige la clave del laboratorio; ver una carta es público.

Variables de entorno en Vercel:

- `BLOB_READ_WRITE_TOKEN` — la crea Vercel al conectar el almacén Blob al proyecto.
- `LAB_KEY` — clave del laboratorio (sólo en variables de entorno, nunca en Git). Para cambiarla, edítala en Vercel y vuelve a desplegar.

Sin esas variables el sitio funciona igual: sólo se desactivan los enlaces y el cambio de portada (la exportación a HTML no depende de ellas).

## Despliegue

Proyecto de Vercel vinculado a `M1gu3hb/Morphiq-lab`: cada push a `main` se publica solo. Framework **Other**, `npm run build`, salida `dist` (ver `vercel.json`).
