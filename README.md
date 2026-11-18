# sinophile 汉

App web (estilo Duolingo / Trainchinese) para estudiar el vocabulario de chino mandarín que aprendo en clase.
Next.js desplegada en Vercel en cada push a `main`: las páginas son estáticas y una pequeña API guarda
las cuentas y el progreso en MongoDB Atlas.

## Flujo diario

1. Después de clase creo en GitHub la carpeta de esa clase, **`data/lección N/`** (`lección 1`, `lección 2`…),
   con su **`vocab.json`**:
   ```json
   [
     { "id": "ni-hao", "hanzi": "你好", "pinyin": "nǐ hǎo", "es": "hola" }
   ]
   ```
   Cada carpeta es una lección; el número del nombre marca el orden. Los `id` no se pueden repetir entre
   clases (solo letras sin tildes, números, `-` y `_`). Las palabras ya se pueden practicar con los
   ejercicios automáticos.
2. Le paso a Claude `instructions.txt`, el `vocab.json` de la clase nueva y los de las anteriores, y le pido
   el `exercises.json` de esa clase.
3. Lo guardo en **`data/lección N/exercises.json`**. En 1-2 minutos la web está actualizada.

Si algún JSON tiene errores, la app ignora lo inválido y lo muestra en **Ajustes → Estado de los datos**
(si el JSON ni siquiera es válido, el build falla y Vercel mantiene la versión anterior).

## Datos (`data/`)

| Ruta | Quién lo escribe | Contenido |
|---|---|---|
| `lección N/vocab.json` | yo, a mano | palabras de esa clase |
| `lección N/exercises.json` | Claude (ver `instructions.txt`) | notas, frases de ejemplo, huecos, traducciones, diálogos y preguntas por palabra |
| `cedict.json` | `npm run dictionary` | diccionario CC-CEDICT compacto (CC BY-SA 4.0) |
| `hsk1.json` | `npm run hsk` | las 150 palabras del HSK 1 (HSK 2.0), para el resumen de vocabulario del inicio |
| `instructions.txt` | — | instrucciones para que Claude escriba el `exercises.json` de una clase |

## Cuentas y progreso

- **Modo invitado**: se puede usar todo sin cuenta, pero no se guarda nada (al cerrar la app se pierde).
- **Con cuenta** (`/cuenta`): el progreso (XP, rachas, repetición espaciada, exámenes, logros) y los ajustes
  se guardan en MongoDB y se comparten entre dispositivos. Al entrar o crear la cuenta se puede añadir
  lo practicado como invitado.
- El navegador no guarda datos de la app: solo la cookie de sesión (HttpOnly).
- **Ajustes → Copia de seguridad** permite exportar/importar `progress.json` y borrar el progreso.

### Base de datos

Variables de entorno (en local, en `.env.local`; en Vercel, en *Settings → Environment Variables*;
ver `.env.example`):

| Variable | |
|---|---|
| `MONGODB_URI` | cadena de conexión del clúster de Atlas (secreta) |
| `MONGODB_DB` | nombre de la base de datos (por defecto `sinophile`; en local uso `sinophile_dev`) |

Colecciones: `users` (credenciales con hash scrypt + ajustes), `sessions` (sesiones; solo se guarda el
SHA-256 del token de la cookie, caducan a los 180 días) y `progress` (un documento por cuenta). Los cambios
de progreso se envían en segundo plano y solo con lo que ha cambiado; el servidor los combina con lo guardado
(nunca se pierde lo hecho en otro dispositivo). Tras 10 contraseñas incorrectas seguidas la cuenta se bloquea
15 minutos. Las funciones de Vercel corren en París (`vercel.json`), junto al clúster (GCP europe-west1).
En Atlas, *Network Access* debe permitir conexiones desde Vercel (IP dinámica: `0.0.0.0/0`).

API (`src/app/api/`): `GET/DELETE /api/account`, `POST /api/auth/register|login|logout`,
`POST/DELETE /api/progress`, `PUT /api/settings`. Todas las peticiones que cambian algo deben ser JSON
(defensa CSRF).

## Funcionalidades

- Lecciones con introducción de palabras nuevas, repetición espaciada (cajas de Leitner por palabra × destreza),
  repaso inteligente, modo infinito (3 vidas), exámenes con nota de 0 a 10, tarjetas.
- Ejercicios: significado, español→chino, escucha, dictado de frases, pinyin y tonos (elegir y escribir),
  emparejar, rellenar huecos, traducir con fichas en ambas direcciones, diálogos, preguntas,
  **escritura de hanzi guiada** (orden de trazos con Hanzi Writer) y **libre** (pensada para iPad + Apple Pencil:
  ves la palabra en español, la dibujas en un lienzo en blanco y se revela el hanzi, sin corrección, con la opción
  de repetirla o pasar a la siguiente; da XP pero no cuenta para la precisión ni para la repetición espaciada),
  pronunciación (reconocimiento de voz o grabación + comparación). La escritura de memoria de los exámenes sí se
  corrige trazo a trazo, porque el examen necesita una nota.
- **Modo silencioso**, para practicar rodeado de gente: una casilla en Inicio, Practicar y cada lección (también en
  Ajustes → Audio y voz) que quita los ejercicios de escucha y de pronunciación y apaga todos los sonidos. Los modos
  Escucha y Pronunciación desaparecen mientras está marcada, y se guarda con los ajustes de la cuenta.
- **Tu vocabulario** (en Inicio): cuántas palabras conoces, cuántas de ellas son del HSK 1 y qué parte del HSK 1
  conoces ya, con la lista de sus 150 palabras (todas, conocidas o por aprender). Una palabra del HSK 1 cuenta como
  conocida si está en tus lecciones o dentro de otra que conoces (书 en 本书, 月 en 一月; 杯 cuenta por 杯子).
- Gamificación: XP, niveles, racha diaria, meta diaria, combos, logros, estrellas por lección, récords.
- Diccionario (tu vocabulario + CC-CEDICT) con búsqueda por hanzi, pinyin con o sin tonos, español o inglés;
  traductor español ⇄ chino; ficha de palabra con trazos animados, ejemplos y dominio por destreza.
- Colores por tono (1.º azul, 2.º verde, 3.º amarillo, 4.º rojo, neutro gris), voz china (TTS del navegador), modo oscuro automático, diseño móvil/iPad.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # y rellena MONGODB_URI
npm run dev        # http://localhost:3000
npm test           # tests (Vitest): datos, lógica y la API contra un MongoDB en memoria
npm run validate   # valida todas las carpetas de data/
npm run build && npm start
```

`scripts/prepare-data.ts` se ejecuta antes de `dev`, `build`, `test` y `typecheck`: valida los datos y genera
`src/generated/lessons.json` (todo el vocabulario, que va dentro del JavaScript), `public/data/exercises.json`
(los ejercicios de todas las clases, que se descargan al usarlos) y los trazos de cada carácter usado
(paquete `hanzi-writer-data`) en `public/strokes/`. Los tests de la API descargan un `mongod` la primera vez.

### Estructura

```
scripts/          prepare-data (genera los datos), data-files (lee data/), diccionario, iconos
src/
  app/            páginas: inicio, leccion, practicar, sesion, diccionario, palabra, progreso, ajustes, cuenta
  app/api/        rutas de la API (cuentas, progreso, ajustes)
  server/         MongoDB, contraseñas y sesiones, operaciones de cuenta (solo servidor)
  components/     UI (ui.tsx), hanzi (hanzi.tsx), lienzo, ejercicios/, sesión/
  lib/
    account/      sesión en el navegador (invitado / cuenta), guardado en segundo plano, llamadas a la API
    data/         carga + validación de las lecciones
    exercises/    tipos, generador de sesiones, corrección, máquina de estados de la sesión, modo silencioso
    progress/     modelo de progreso (XP, rachas, dominio, combinación), logros, store en memoria
    settings/     ajustes (modelo + store en memoria)
    pinyin.ts     tonos, comparación tolerante, división en sílabas (con erhua)
    srs.ts        repetición espaciada
    drawing.ts    dibujo a mano: corrección (exámenes) y conversión de trazos a SVG
    speech.ts     voz (TTS) y reconocimiento
    dictionary.ts búsqueda
    hsk.ts        comparación del vocabulario con la lista del HSK 1
```

Créditos: CC-CEDICT (CC BY-SA 4.0), Make Me a Hanzi / hanzi-writer-data (Arphic Public License),
Hanzi Writer (MIT), pinyin-pro (MIT), lista del HSK 1 de complete-hsk-vocabulary (MIT).
