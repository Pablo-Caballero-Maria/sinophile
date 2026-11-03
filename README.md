# sinophile 汉

App web (estilo Duolingo / Trainchinese) para estudiar el vocabulario de chino mandarín que aprendo en clase.
100 % estática: Next.js (`output: "export"`) desplegada en Vercel en cada push a `main`.

## Flujo diario

1. Después de clase, edito **`data/vocab.json`** en GitHub y añado las palabras nuevas:
   ```json
   { "id": "ni-hao", "hanzi": "你好", "pinyin": "nǐ hǎo", "es": "hola", "lesson": "2026-11-03" }
   ```
   Las palabras con la misma fecha (`lesson`) forman una lección. Ya se pueden practicar con los
   ejercicios automáticos.
2. En claude.ai subo `vocab.json`, `exercises.json` e `instructions.txt` y le pido:
   *"read vocab and exercises, read instructions and follow the instructions to load new exercises from vocab if they are missing"*.
3. Sustituyo **`data/exercises.json`** en GitHub por el que me devuelve. En 1-2 minutos la web está actualizada.

Si algún JSON tiene errores, la app ignora lo inválido y lo muestra en **Ajustes → Estado de los datos**
(si el JSON ni siquiera es válido, el build falla y Vercel mantiene la versión anterior).

## Datos (`data/`)

| Archivo | Quién lo escribe | Contenido |
|---|---|---|
| `vocab.json` | yo, a mano | vocabulario por lecciones |
| `exercises.json` | Claude (ver `instructions.txt`) | notas, frases de ejemplo, huecos, traducciones, diálogos y preguntas por palabra |
| `progress.json` | la app (sincronización opcional con GitHub) | XP, rachas, repetición espaciada, exámenes, logros |
| `cedict.json` | `npm run dictionary` | diccionario CC-CEDICT compacto (CC BY-SA 4.0) |
| `instructions.txt` | — | instrucciones para que Claude amplíe `exercises.json` |

El progreso vive en el navegador (localStorage). En **Ajustes → Sincronización con GitHub** se puede
conectar un token *fine-grained* (solo este repo, permiso *Contents: read & write*) para guardarlo en
`data/progress.json` y compartirlo entre dispositivos. Esos commits no disparan un nuevo despliegue
(`vercel.json` → `scripts/vercel-ignore.sh`).

## Funcionalidades

- Lecciones con introducción de palabras nuevas, repetición espaciada (cajas de Leitner por palabra × destreza),
  repaso inteligente, modo infinito (3 vidas), exámenes con nota de 0 a 10, tarjetas.
- Ejercicios: significado, español→chino, escucha, dictado de frases, pinyin y tonos (elegir y escribir),
  emparejar, rellenar huecos, traducir con fichas en ambas direcciones, diálogos, preguntas,
  **escritura de hanzi guiada** (orden de trazos con Hanzi Writer) y **libre** (lienzo en blanco con
  corrección automática trazo a trazo, pensado para iPad + Apple Pencil), pronunciación (reconocimiento de voz
  o grabación + comparación).
- Gamificación: XP, niveles, racha diaria, meta diaria, combos, logros, estrellas por lección, récords.
- Diccionario (tu vocabulario + CC-CEDICT) con búsqueda por hanzi, pinyin con o sin tonos, español o inglés;
  traductor español ⇄ chino; ficha de palabra con trazos animados, ejemplos y dominio por destreza.
- Colores por tono, voz china (TTS del navegador), modo oscuro automático, diseño móvil/iPad.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests unitarios (Vitest), incluida la validación de data/*.json
npm run validate   # valida vocab.json y exercises.json
npm run build      # export estático en out/
```

`scripts/prepare-data.ts` se ejecuta antes de `dev`/`build`: valida los datos, copia los JSON a `public/data/`
y los trazos de cada carácter usado (paquete `hanzi-writer-data`) a `public/strokes/`.

### Estructura

```
src/
  app/            páginas: inicio, leccion, practicar, sesion, diccionario, palabra, progreso, ajustes
  components/     UI (ui.tsx), hanzi (hanzi.tsx), lienzo, ejercicios/, sesión/
  lib/
    data/         carga + validación de vocab/exercises
    exercises/    tipos, generador de sesiones, corrección, máquina de estados de la sesión
    progress/     modelo de progreso (XP, rachas, dominio), logros, store, sincronización GitHub
    pinyin.ts     tonos, comparación tolerante, división en sílabas
    srs.ts        repetición espaciada
    drawing.ts    corrección de dibujo libre
    speech.ts     voz (TTS) y reconocimiento
    dictionary.ts búsqueda
```

Créditos: CC-CEDICT (CC BY-SA 4.0), Make Me a Hanzi / hanzi-writer-data (Arphic Public License),
Hanzi Writer (MIT), pinyin-pro (MIT).
