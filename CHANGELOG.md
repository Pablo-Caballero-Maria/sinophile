# Registro de cambios

Todos los cambios relevantes de sinophile se anotan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/). Cada versión tiene su etiqueta (`vX.Y.Z`) en el
repositorio.

## [Sin publicar]

## [1.3.0] - 2026-11-26

### Añadido

- **Lección 7**: 23 palabras nuevas de la clase (谁, 你呢, 英语, 很, 百, 千, 电脑, 原子笔, 铅笔, 橡皮擦,
  办公室, 门, 窗户, 铅笔盒, 抽屉, 柜子, 衣柜, 灯, 背包, 钱包, 包裹, 美国 y 口), con notas, frases de
  ejemplo y ejercicios. 几 ya estaba en la lección 4. La nota de 书包 menciona 背包.
- **Tarjetas que empiezan por la cara que elijas** (en Practicar): español (detrás, el hanzi, el pinyin y la
  pronunciación), hanzi, pinyin o sonido (detrás, el resto), o una mezcla. La de sonido entrena la
  escucha y no se ofrece en modo silencioso.
- **Cabeceras de seguridad** en todas las respuestas: Content Security Policy (solo la propia web y los
  servicios que usa), HSTS, `nosniff`, sin incrustar, `Referrer-Policy`, `Cross-Origin-Opener-Policy` y
  `Permissions-Policy` (el micrófono, solo para la propia web). Los tests de extremo a extremo fallan ante
  cualquier violación del CSP.
- **Firewall de Vercel**: una regla que registra las sondas de escáneres (WordPress, `.env`, `.git`…) y
  _Bot Protection_ y _AI Bots_ en modo registro.
- `favicon.ico`.

### Cambiado

- **La lista del inicio es la del HSK 2 del HSK 3.0**: las 500 palabras del temario de 2025 (300 del nivel 1
  y 200 del nivel 2, de [ofou/hsk](https://github.com/ofou/hsk)) en lugar de las 150 del HSK 1 de HSK 2.0;
  se muestran por nivel, y las que se escriben igual (点, 花, 过) con su categoría gramatical.
- **Zod** valida los formularios, el cuerpo de las peticiones a la API, las variables de entorno del
  servidor y todo lo descargado (ejercicios, CC-CEDICT, trazos y las respuestas de los traductores); los
  ajustes se sanean con un esquema. Va sin `eval`, como exige el CSP.
- **Zustand** es el motor de los stores (ajustes, progreso y cuenta), con selectores para que cada
  componente solo se actualice con lo que lee.
- **TanStack Query** carga los ejercicios, CC-CEDICT, los trazos y las traducciones (una descarga por
  recurso, compartida por toda la app) y lleva las acciones de la cuenta.
- **React Hook Form** en los formularios de la cuenta y en el traductor del diccionario.
- **Motion** anima la hoja de corrección tras cada respuesta (entra y sale; mientras sale ya no responde)
  y los errores de los formularios; nada si el sistema pide reducir el movimiento.
- El portfolio está ahora en pablo-caballero.vercel.app.

## [1.2.0] - 2026-11-22

### Añadido

- **Cuentas con [Better Auth](https://www.better-auth.com)** (usuario y contraseña, con su plugin
  `username`) en `/api/auth/*`, sobre su adaptador oficial de MongoDB (colecciones `user`, `account`,
  `session` y `rateLimit`). Siguen el bloqueo de 15 minutos tras 10 contraseñas incorrectas seguidas (ahora
  un _hook_ de Better Auth), las sesiones de 180 días en una cookie HttpOnly y borrar la cuenta pidiendo la
  contraseña; Better Auth añade su límite de intentos por IP y la comprobación del origen. Requiere
  `BETTER_AUTH_SECRET`.
- **Migración de las cuentas de antes** (colecciones `users` y `sessions`): cada una pasa sola a Better Auth
  la primera vez que entra o que alguien intenta registrar su nombre, con el mismo id (su progreso sigue
  enlazado), la misma contraseña (su hash scrypt se sigue comprobando) y sus ajustes; o todas a la vez con
  `npm run migrate:auth`. Sus sesiones abiertas no se pueden pasar: hay que volver a entrar una vez.
- **Funciona sin conexión**: un _service worker_ (Serwist, `src/sw/`) precachea el build, las lecciones, los
  ejercicios y los trazos, y descarga todas las páginas al instalarse; las páginas van primero a la red y
  sin conexión salen de la caché, la API nunca se cachea y CC-CEDICT se guarda tras su primer uso. Página
  `/~offline` para lo que no esté guardado.
- Botón de tema (claro/oscuro) en la barra superior y esqueleto de carga de cada página (`loading.tsx`).
- Tests: los flujos de Better Auth contra MongoDB en memoria (registro, entrada, salida, bloqueo, borrar
  la cuenta, migración de cuentas antiguas), las contraseñas antiguas, el enrutado del _service worker_ y el
  tema (132 tests de Vitest); en Playwright, abrir páginas no visitadas sin conexión y el tema (16 e2e).
- **Prettier** (110 columnas, con `prettier-plugin-tailwindcss` para el orden de las clases) y
  `eslint-config-prettier`: `npm run format` y `npm run format:check`, que la CI también comprueba. Todo
  el código y la documentación están formateados con él (`data/` no: las lecciones se escriben a mano).
- `npm run check`: tipos, lint, formato y tests, como en las otras webs.
- Tests de componentes con **Testing Library** (`@testing-library/react`, `jest-dom` y `user-event`) en
  jsdom, como en las otras webs: el control segmentado, el interruptor y la casilla del modo silencioso
  (118 tests en total).

### Cambiado

- **El tema es claro por defecto** y ya no sigue al del sistema: claro u oscuro, a elegir (la opción
  «Automático» desaparece; las cuentas que la tenían pasan a claro).
- **Consultas tipadas**: cada colección de MongoDB es un `Collection<…>` con el tipo de su documento,
  también las de Better Auth que se tocan (`user` y `account`), y las heredadas (`users`, `sessions`).
- Los esqueletos de carga son utilidades de Tailwind (animación `animate-shimmer`) en lugar de la clase
  CSS `.skeleton`.
- La web ya no envía la cabecera `X-Powered-By: Next.js` (`poweredByHeader: false`).
- Los ficheros de los componentes (`src/components/`) se llaman en PascalCase (`UI.tsx`, `Hanzi.tsx`,
  `session/Player.tsx`…), como en las otras webs; `exercises/index.tsx` sigue siendo la entrada de su carpeta.

### Eliminado

- `POST /api/auth/register`, `/api/auth/login` y `/api/auth/logout` y `DELETE /api/account`: los
  sustituyen las rutas de Better Auth.

## [1.1.0] - 2026-11-21

### Añadido

- **Tests de extremo a extremo con Playwright** (`e2e/`, `npm run test:e2e`): 14 tests en Chromium contra el
  build de producción, con la API real y MongoDB: el inicio como invitado, que cada lección de `data/` tenga
  su página con todas sus palabras, el principio de una lección, el modo silencioso, la configuración del
  examen, el diccionario (español, pinyin sin tonos y CC-CEDICT), la ficha de palabra, el traductor, crear
  una cuenta, cerrar sesión y volver a entrar, una contraseña incorrecta y que los ajustes se guarden en la
  cuenta. Cualquier error en la consola del navegador hace fallar el test.
- La CI ejecuta los tests de extremo a extremo con un servicio `mongo:8`.
- **Vercel Web Analytics** (visitas, sin cookies) y **Speed Insights** (Core Web Vitals de visitas reales),
  solo en el build que hace Vercel.

## [1.0.0] - 2026-11-21

### Añadido

- Integración continua con GitHub Actions: validación de `data/`, ESLint, TypeScript, tests con
  cobertura (Vitest + `@vitest/coverage-v8`, resumen en cada ejecución e insignia en el README) y build
  de Next.js en cada _push_ y _pull request_.
- `npm run test:coverage`.
- Seguridad: análisis con CodeQL, Dependabot (npm y GitHub Actions), escaneo de secretos con protección
  al hacer _push_ y [política de seguridad](SECURITY.md) con avisos privados.
- Licencia [MIT](LICENSE), [código de conducta](CODE_OF_CONDUCT.md), [CITATION.cff](CITATION.cff),
  plantillas de _issues_ (error, mejora y error en los datos de una lección) y de _pull request_.
- [Wiki](https://github.com/Pablo-Caballero-Maria/sinophile/wiki) con la arquitectura, el formato de
  los datos, el aprendizaje, la API y el desarrollo.

### Cambiado

- README reorganizado, con insignias, índice, diagramas y capturas.

## [0.6.0] - 2026-11-19

### Añadido

- Lección 6: 早上好, 想, clasificadores, 是什么颜色的 y más colores.

## [0.5.0] - 2026-11-18

### Añadido

- Lección 5.
- **Tu vocabulario** en el inicio: cuántas palabras conoces, cuántas son del HSK 1 y qué parte del HSK 1
  dominas, con la lista de sus 150 palabras (`data/hsk1.json`, `npm run hsk`).

### Cambiado

- `instructions.txt` permite corregir lecciones anteriores.
- Los invitados solo cuentan las palabras que practican, y cada cuenta las que ha practicado.
- Dependencias actualizadas.

## [0.4.0] - 2026-11-14

### Añadido

- Lección 4: presentaciones, la edad, 周/号 y los colores.

## [0.3.0] - 2026-11-06

### Añadido

- **Modo silencioso**: quita los ejercicios de escucha y de pronunciación y apaga los sonidos.
- Escritura libre de hanzi sin corregir, pensada para iPad y Apple Pencil.

### Cambiado

- La lección 2 se divide en las lecciones 2 y 3, según la lista de hanzi de la clase.
- Nuevos colores por tono y correcciones de vocabulario.

## [0.2.0] - 2026-11-04

### Añadido

- Una carpeta por clase (`data/lección N/`) con su `vocab.json` y su `exercises.json`.
- Cuentas con el progreso y los ajustes guardados en MongoDB Atlas, con una pequeña API en
  `src/app/api/` (la web deja de ser 100 % estática), y modo invitado.
- 这里/那里 y la lección del 3 de noviembre.

### Eliminado

- La migración desde `localStorage`: el navegador ya solo guarda la cookie de sesión.

## [0.1.0] - 2026-11-03

### Añadido

- Primera versión, 100 % estática (`output: "export"`): vocabulario por fechas en `data/vocab.json`,
  ejercicios en `data/exercises.json`, repetición espaciada, escritura de hanzi con Hanzi Writer, voz,
  diccionario CC-CEDICT y progreso en el navegador con sincronización opcional con GitHub
  (`progress.json`).
- Node.js 24.x fijado para los builds de Vercel.

[Sin publicar]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.6.0...v1.0.0
[0.6.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Pablo-Caballero-Maria/sinophile/releases/tag/v0.1.0
